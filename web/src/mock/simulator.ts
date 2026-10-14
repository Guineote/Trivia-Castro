import { POWER_TYPES } from '@/api/types'
import type {
  AdvanceResponse,
  AnswerResponse,
  CreatePlayerResponse,
  CreateRoomResponse,
  Difficulty,
  GameResults,
  GameState,
  JoinRoomResponse,
  LastResult,
  ParticipantStatus,
  Phase,
  PlayerStats,
  PowerResponse,
  PowerType,
  RankingEntry,
  RankingResponse,
  Room,
  RoomSettings,
  RoomStatus,
  RoundResultEntry,
  RoundResults,
  RoundType,
  StartGameResponse,
  StateQuestion,
} from '@/api/types'
import { PHASE_DURATION_MS } from '@/lib/phases'
import { MOCK_CATEGORIES, QUESTION_BANK } from './questions'

/**
 * Simulador del servidor para el modo mock: sala, partida, fases, puntos y bots.
 * Reproduce las reglas del contrato (docs/contrato/README.md). Todo lo que el
 * contrato deja abierto está marcado como SUPUESTO DE MOCK.
 *
 * - El estado es un objeto plano (serializable) para sobrevivir a una recarga.
 * - Las fases se evalúan de forma perezosa: en cada petición se aplican, por orden,
 *   todos los eventos cuya hora ya pasó. Sin setTimeout → no hay deriva en segundo plano.
 */

export class SimError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(code)
    this.name = 'SimError'
    this.status = status
    this.code = code
  }
}

export const DEFAULT_SETTINGS: RoomSettings = { maxPlayers: 8, rounds: 10, lives: 3, categoryIds: [] }
/** D4: mínimo 2 jugadores para iniciar (1 en desarrollo). */
export const MIN_PLAYERS_TO_START = 2

// SUPUESTO DE MOCK: rangos de settings (pendientes con Jared).
const SETTINGS_RANGES = { maxPlayers: [2, 16], rounds: [1, 20], lives: [1, 5] } as const

// SUPUESTO DE MOCK: puntaje base por dificultad y fórmula de velocidad (ambas pendientes).
// 400·(20 s − t)/20 s reproduce el 316 del ejemplo a 4.2 s; no es la fórmula real.
export const MOCK_BASE_POINTS: Record<Difficulty, number> = { EASY: 500, MEDIUM: 800, HARD: 1100 }
export function mockSpeedBonus(answerTimeMs: number): number {
  const window = PHASE_DURATION_MS.QUESTION
  return Math.max(0, Math.round((400 * (window - answerTimeMs)) / window))
}

const BOTS = [
  { nickname: 'Beto', skill: 0.7 },
  { nickname: 'Caro', skill: 0.6 },
  { nickname: 'Dani', skill: 0.4 },
]

// ── Datos planos ────────────────────────────────────────────────────────────
interface SimPlayer {
  playerId: string
  nickname: string
  token: string
}

interface SimRoomParticipant {
  participantId: string
  /** null = bot. */
  playerId: string | null
  nickname: string
  isHost: boolean
  botSkill: number | null
}

interface PendingBot {
  nickname: string
  skill: number
  joinAt: number
}

interface SimRoom {
  code: string
  settings: RoomSettings
  status: RoomStatus
  participants: SimRoomParticipant[]
  currentGameId: string | null
  pendingBots: PendingBot[]
}

interface SimOption {
  id: string
  text: string
  isCorrect: boolean
}

interface SimAnswer {
  optionId: string
  answerTimeMs: number
}

interface SimRound {
  number: number
  type: RoundType
  question: { id: string; text: string; categoryId: string; difficulty: Difficulty; options: SimOption[] }
  answers: Record<string, SimAnswer>
  /** HINT: opciones que el servidor quitó a cada participante. */
  hintRemoved: Record<string, string[]>
  /** null hasta que se cierra la ronda. */
  outcomes: RoundResultEntry[] | null
}

interface SimGamePlayer {
  participantId: string
  playerId: string | null
  nickname: string
  isHost: boolean
  botSkill: number | null
  score: number
  lives: number
  status: ParticipantStatus
  powers: PowerType[]
  activePower: PowerType | null
  lastResult: LastResult | null
  pointsThisRound: number | null
}

interface BotPlan {
  participantId: string
  at: number
  optionId: string
}

interface SimGame {
  id: string
  roomCode: string
  rounds: SimRound[]
  roundIndex: number
  phase: Phase
  phaseStart: number
  /** null en FINAL (sin límite). */
  phaseEnd: number | null
  version: number
  players: SimGamePlayer[]
  botPlans: BotPlan[]
  /** Orden de participantIds: [inicial, tras ronda 1, tras ronda 2…]. Base de positionDelta. */
  rankHistory: string[][]
}

export interface World {
  counter: number
  players: SimPlayer[]
  rooms: SimRoom[]
  games: SimGame[]
  lastGameId: string | null
}

export interface SimulatorOptions {
  now: () => number
  random: () => number
  /** Formato de las fechas ISO (el DevPanel puede forzar segundos enteros). */
  formatTime?: (ms: number) => string
  /** ¿Entran bots a la sala de espera? */
  botsInRoom?: () => boolean
}

export function emptyWorld(): World {
  return { counter: 0, players: [], rooms: [], games: [], lastGameId: null }
}

// ── Simulador ───────────────────────────────────────────────────────────────
export function createSimulator(options: SimulatorOptions, initial?: World) {
  const { now, random } = options
  const world: World = initial ?? emptyWorld()
  const fmt = (ms: number) => (options.formatTime ? options.formatTime(ms) : new Date(ms).toISOString())

  // ── utilidades
  const nextId = (prefix: string) => `${prefix}${++world.counter}`
  const randomString = (alphabet: string, length: number) =>
    Array.from({ length }, () => alphabet[Math.floor(random() * alphabet.length)]).join('')

  function shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }

  function validNickname(value: unknown): string {
    if (typeof value !== 'string') throw new SimError(422, 'VALIDATION_ERROR')
    const nickname = value.trim()
    if (nickname.length < 2 || nickname.length > 20) throw new SimError(422, 'VALIDATION_ERROR')
    return nickname
  }

  function mergeSettings(base: RoomSettings, input: unknown): RoomSettings {
    if (input === undefined || input === null) return { ...base }
    if (typeof input !== 'object') throw new SimError(422, 'VALIDATION_ERROR')
    const patch = input as Partial<Record<keyof RoomSettings, unknown>>
    const next: RoomSettings = { ...base, categoryIds: [...base.categoryIds] }
    for (const key of ['maxPlayers', 'rounds', 'lives'] as const) {
      const value = patch[key]
      if (value === undefined) continue
      const [min, max] = SETTINGS_RANGES[key]
      if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
        throw new SimError(422, 'VALIDATION_ERROR')
      }
      next[key] = value as number
    }
    if (patch.categoryIds !== undefined) {
      const ids = patch.categoryIds
      const known = new Set(MOCK_CATEGORIES.map((c) => c.id))
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !known.has(id))) {
        throw new SimError(422, 'VALIDATION_ERROR')
      }
      next.categoryIds = ids as string[]
    }
    return next
  }

  // ── jugadores
  function createPlayer(nickname: unknown): CreatePlayerResponse {
    const clean = validNickname(nickname)
    const player: SimPlayer = {
      playerId: nextId('p'),
      nickname: clean,
      token: `tok_${randomString('abcdefghijklmnopqrstuvwxyz0123456789', 24)}`,
    }
    world.players.push(player)
    return { playerId: player.playerId, nickname: clean, token: player.token }
  }

  function authenticate(token: string | null): SimPlayer {
    const player = token ? world.players.find((p) => p.token === token) : undefined
    if (!player) throw new SimError(401, 'UNAUTHORIZED')
    return player
  }

  // ── salas
  function findRoom(code: string): SimRoom {
    const room = world.rooms.find((r) => r.code === code.toUpperCase())
    if (!room) throw new SimError(404, 'ROOM_NOT_FOUND')
    return room
  }

  function toRoom(room: SimRoom): Room {
    return {
      code: room.code,
      status: room.status,
      hostParticipantId: room.participants.find((p) => p.isHost)?.participantId ?? '',
      settings: { ...room.settings, categoryIds: [...room.settings.categoryIds] },
      participants: room.participants.map(({ participantId, nickname, isHost }) => ({
        participantId,
        nickname,
        isHost,
      })),
      currentGameId: room.currentGameId,
    }
  }

  /** Los bots van entrando a la sala de espera según su hora de llegada. */
  function materializeBots(room: SimRoom): void {
    if (room.status !== 'WAITING') return
    const t = now()
    while (
      room.pendingBots.length > 0 &&
      room.pendingBots[0].joinAt <= t &&
      room.participants.length < room.settings.maxPlayers
    ) {
      const bot = room.pendingBots.shift() as PendingBot
      if (room.participants.some((p) => p.nickname.toLowerCase() === bot.nickname.toLowerCase())) continue
      room.participants.push({
        participantId: nextId('pt'),
        playerId: null,
        nickname: bot.nickname,
        isHost: false,
        botSkill: bot.skill,
      })
    }
  }

  function participantOf(room: SimRoom, player: SimPlayer): SimRoomParticipant | undefined {
    return room.participants.find((p) => p.playerId === player.playerId)
  }

  function createRoom(player: SimPlayer, settingsInput?: unknown): CreateRoomResponse {
    const settings = mergeSettings(DEFAULT_SETTINGS, settingsInput)
    let code = ''
    do {
      code = randomString('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6)
    } while (world.rooms.some((r) => r.code === code))
    const host: SimRoomParticipant = {
      participantId: nextId('pt'),
      playerId: player.playerId,
      nickname: player.nickname,
      isHost: true,
      botSkill: null,
    }
    const createdAt = now()
    const room: SimRoom = {
      code,
      settings,
      status: 'WAITING',
      participants: [host],
      currentGameId: null,
      pendingBots: options.botsInRoom?.() === false
        ? []
        : BOTS.map((b, i) => ({ ...b, joinAt: createdAt + 2000 * (i + 1) })),
    }
    world.rooms.push(room)
    return { ...toRoom(room), participantId: host.participantId }
  }

  function getRoom(code: string): Room {
    const room = findRoom(code)
    if (room.currentGameId) {
      const game = world.games.find((g) => g.id === room.currentGameId)
      if (game) tick(game)
    }
    materializeBots(room)
    return toRoom(room)
  }

  function updateRoom(player: SimPlayer, code: string, settingsInput: unknown): Room {
    const room = findRoom(code)
    const me = participantOf(room, player)
    if (!me?.isHost) throw new SimError(403, 'NOT_HOST')
    if (room.status !== 'WAITING') throw new SimError(409, 'GAME_ALREADY_STARTED')
    const settings = mergeSettings(room.settings, settingsInput)
    materializeBots(room)
    if (settings.maxPlayers < room.participants.length) throw new SimError(422, 'VALIDATION_ERROR')
    room.settings = settings
    return toRoom(room)
  }

  function joinRoom(player: SimPlayer, code: string, nicknameInput?: unknown): { created: boolean; body: JoinRoomResponse } {
    const room = findRoom(code)
    materializeBots(room)
    const existing = participantOf(room, player)
    if (existing) {
      // D3: ya era participante → 200 con el mismo participantId (reconexión).
      return { created: false, body: { participantId: existing.participantId, participants: toRoom(room).participants } }
    }
    if (room.status !== 'WAITING') throw new SimError(409, 'GAME_ALREADY_STARTED')
    if (room.participants.length >= room.settings.maxPlayers) throw new SimError(409, 'ROOM_FULL')
    const nickname = validNickname(nicknameInput ?? player.nickname)
    if (room.participants.some((p) => p.nickname.toLowerCase() === nickname.toLowerCase())) {
      throw new SimError(422, 'NICKNAME_TAKEN')
    }
    const participant: SimRoomParticipant = {
      participantId: nextId('pt'),
      playerId: player.playerId,
      nickname,
      isHost: false,
      botSkill: null,
    }
    room.participants.push(participant)
    return { created: true, body: { participantId: participant.participantId, participants: toRoom(room).participants } }
  }

  function leaveRoom(player: SimPlayer, code: string, participantId: string): void {
    const room = findRoom(code)
    const me = participantOf(room, player)
    const target = room.participants.find((p) => p.participantId === participantId)
    if (!me || !target) throw new SimError(me ? 404 : 403, me ? 'ROOM_NOT_FOUND' : 'FORBIDDEN')
    if (target.participantId !== me.participantId && !me.isHost) throw new SimError(403, 'FORBIDDEN')
    // Como la API real: fuera de la sala de espera la fila se conserva (acaba de espectador / sigue en la revancha).
    if (room.status !== 'WAITING') return
    room.participants = room.participants.filter((p) => p.participantId !== target.participantId)
    if (target.isHost) {
      // D11: el rol pasa al participante más antiguo (el primero en la lista).
      const next = room.participants.find((p) => p.playerId !== null) ?? room.participants[0]
      if (next) next.isHost = true
    }
    if (room.participants.every((p) => p.playerId === null)) {
      world.rooms = world.rooms.filter((r) => r.code !== room.code)
    }
  }

  // ── partida: creación y fases
  function findGame(gameId: string): SimGame {
    const game = world.games.find((g) => g.id === gameId)
    if (!game) throw new SimError(404, 'GAME_NOT_FOUND')
    return game
  }

  function gamePlayerOf(game: SimGame, player: SimPlayer): SimGamePlayer {
    const found = game.players.find((p) => p.playerId === player.playerId)
    if (!found) throw new SimError(403, 'NOT_IN_GAME')
    return found
  }

  const currentRound = (game: SimGame): SimRound => game.rounds[game.roundIndex]
  const closedRounds = (game: SimGame): number => game.rankHistory.length - 1

  function standings(game: SimGame): SimGamePlayer[] {
    const order = new Map(game.players.map((p, i) => [p.participantId, i]))
    return [...game.players].sort(
      (a, b) => b.score - a.score || (order.get(a.participantId) ?? 0) - (order.get(b.participantId) ?? 0),
    )
  }

  function startGame(player: SimPlayer, code: string): StartGameResponse {
    const room = findRoom(code)
    materializeBots(room)
    const me = participantOf(room, player)
    if (!me?.isHost) throw new SimError(403, 'NOT_HOST')
    // D13 (revancha): también se puede iniciar desde una sala FINISHED; solo se rechaza con una partida en curso.
    if (room.status === 'IN_GAME') throw new SimError(409, 'GAME_ALREADY_STARTED')
    if (room.participants.length < MIN_PLAYERS_TO_START) throw new SimError(409, 'NOT_ENOUGH_PLAYERS')

    const { categoryIds, rounds: totalRounds, lives } = room.settings
    const pool = QUESTION_BANK.filter((q) => categoryIds.length === 0 || categoryIds.includes(q.categoryId))
    if (pool.length < totalRounds) throw new SimError(409, 'NOT_ENOUGH_QUESTIONS')

    const rounds: SimRound[] = shuffle(pool)
      .slice(0, totalRounds)
      .map((q, i) => ({
        number: i + 1,
        // SUPUESTO DE MOCK: cada tercera ronda es DOUBLE.
        type: (i + 1) % 3 === 0 ? 'DOUBLE' : 'NORMAL',
        question: {
          id: q.id,
          text: q.text,
          categoryId: q.categoryId,
          difficulty: q.difficulty,
          options: shuffle(q.options.map((text, idx) => ({ text, isCorrect: idx === q.correct }))).map((o, idx) => ({
            id: `o${idx + 1}`,
            ...o,
          })),
        },
        answers: {},
        hintRemoved: {},
        outcomes: null,
      }))

    const players: SimGamePlayer[] = room.participants.map((p) => ({
      participantId: p.participantId,
      playerId: p.playerId,
      nickname: p.nickname,
      isHost: p.isHost,
      botSkill: p.botSkill,
      score: 0,
      lives,
      status: 'ACTIVE',
      powers: [...POWER_TYPES],
      activePower: null,
      lastResult: null,
      pointsThisRound: null,
    }))

    const game: SimGame = {
      id: `g${randomString('abcdefghijklmnopqrstuvwxyz0123456789', 3)}`,
      roomCode: room.code,
      rounds,
      roundIndex: 0,
      phase: 'ROUND_INTRO',
      phaseStart: now(),
      phaseEnd: null,
      version: 0,
      players,
      botPlans: [],
      rankHistory: [players.map((p) => p.participantId)],
    }
    world.games.push(game)
    world.lastGameId = game.id
    room.status = 'IN_GAME'
    room.currentGameId = game.id
    enter(game, 'ROUND_INTRO', game.phaseStart)
    return { gameId: game.id, phase: game.phase, version: game.version }
  }

  function enter(game: SimGame, phase: Phase, at: number): void {
    game.phase = phase
    game.phaseStart = at
    game.phaseEnd = phase === 'FINAL' ? null : at + PHASE_DURATION_MS[phase]
    game.version += 1
    if (phase === 'ROUND_INTRO') {
      for (const p of game.players) {
        p.activePower = null
        p.pointsThisRound = null
        p.lastResult = null
      }
    } else if (phase === 'QUESTION') {
      planBots(game, at)
    } else if (phase === 'FINAL') {
      const room = world.rooms.find((r) => r.code === game.roomCode)
      if (room) room.status = 'FINISHED'
    }
  }

  function planBots(game: SimGame, at: number): void {
    const round = currentRound(game)
    const correct = round.question.options.find((o) => o.isCorrect) as SimOption
    const wrong = round.question.options.filter((o) => !o.isCorrect)
    game.botPlans = []
    for (const p of game.players) {
      if (p.botSkill === null || p.status !== 'ACTIVE') continue
      if (random() < 0.08) continue // a veces un bot no alcanza a responder
      const pick = random() < p.botSkill ? correct : wrong[Math.floor(random() * wrong.length)]
      game.botPlans.push({ participantId: p.participantId, at: at + 1500 + Math.floor(random() * 14500), optionId: pick.id })
    }
  }

  /** Cierra la ronda: puntos, vidas, espectadores y resultados. */
  function closeRound(game: SimGame): void {
    const round = currentRound(game)
    const outcomes: RoundResultEntry[] = []
    for (const p of game.players) {
      if (p.status !== 'ACTIVE') {
        p.pointsThisRound = null
        p.lastResult = null
        outcomes.push({
          participantId: p.participantId,
          nickname: p.nickname,
          chosenOptionId: null,
          isCorrect: false,
          answerTimeMs: null,
          pointsAwarded: 0,
          livesLost: 0,
        })
        continue
      }
      const answer = round.answers[p.participantId]
      const isCorrect = Boolean(answer && round.question.options.find((o) => o.id === answer.optionId)?.isCorrect)
      const roundMultiplier = round.type === 'DOUBLE' ? 2 : 1
      const powerMultiplier = p.activePower === 'DOUBLE' ? 2 : 1
      // SUPUESTO DE MOCK: al fallar, base y velocidad valen 0; un timeout se trata como fallo.
      const basePoints = isCorrect ? MOCK_BASE_POINTS[round.question.difficulty] : 0
      const speedBonus = isCorrect && answer ? mockSpeedBonus(answer.answerTimeMs) : 0
      const pointsAwarded = (basePoints + speedBonus) * roundMultiplier * powerMultiplier
      const livesLost = isCorrect || p.activePower === 'SHIELD' ? 0 : 1
      p.lives = Math.max(0, p.lives - livesLost)
      const becameSpectator = p.lives === 0
      if (becameSpectator) p.status = 'SPECTATOR'
      p.score += pointsAwarded
      p.pointsThisRound = pointsAwarded
      p.lastResult = {
        chosenOptionId: answer?.optionId ?? null,
        isCorrect,
        answerTimeMs: answer?.answerTimeMs ?? null,
        basePoints,
        speedBonus,
        roundMultiplier,
        powerMultiplier,
        pointsAwarded,
        livesLost,
        becameSpectator,
        powerUsed: p.activePower,
      }
      outcomes.push({
        participantId: p.participantId,
        nickname: p.nickname,
        chosenOptionId: answer?.optionId ?? null,
        isCorrect,
        answerTimeMs: answer?.answerTimeMs ?? null,
        pointsAwarded,
        livesLost,
      })
    }
    round.outcomes = outcomes
    game.botPlans = []
    game.rankHistory.push(standings(game).map((p) => p.participantId))
  }

  function transition(game: SimGame, at: number): void {
    switch (game.phase) {
      case 'ROUND_INTRO':
        enter(game, 'QUESTION', at)
        break
      case 'QUESTION':
        closeRound(game)
        enter(game, 'REVEAL', at)
        break
      case 'REVEAL':
        enter(game, 'SCOREBOARD', at)
        break
      case 'SCOREBOARD':
        if (game.roundIndex + 1 >= game.rounds.length) {
          enter(game, 'FINAL', at)
        } else {
          game.roundIndex += 1
          enter(game, 'ROUND_INTRO', at)
        }
        break
      case 'FINAL':
        break
    }
  }

  /** Aplica, en orden cronológico, todo lo que ya debió ocurrir (cambios de fase y respuestas de bots). */
  function tick(game: SimGame): void {
    const t = now()
    for (let guard = 0; guard < 500; guard++) {
      const nextBot = game.botPlans.filter((b) => b.at <= t).sort((a, b) => a.at - b.at)[0]
      const phaseDue = game.phaseEnd !== null && game.phaseEnd <= t
      if (phaseDue && (!nextBot || (game.phaseEnd as number) <= nextBot.at)) {
        transition(game, game.phaseEnd as number)
      } else if (nextBot) {
        game.botPlans = game.botPlans.filter((b) => b !== nextBot)
        currentRound(game).answers[nextBot.participantId] = {
          optionId: nextBot.optionId,
          answerTimeMs: nextBot.at - game.phaseStart,
        }
        game.version += 1
      } else {
        return
      }
    }
  }

  // ── partida: lectura
  const hasAnswered = (game: SimGame, p: SimGamePlayer): boolean =>
    (game.phase === 'QUESTION' || game.phase === 'REVEAL' || game.phase === 'SCOREBOARD') &&
    currentRound(game).answers[p.participantId] !== undefined

  function rankingEntries(game: SimGame, afterRound: number, withDelta: boolean): RankingEntry[] {
    const history = game.rankHistory
    const current = history[Math.min(afterRound, history.length - 1)]
    const previous = history[Math.max(Math.min(afterRound, history.length - 1) - 1, 0)]
    return current.map((participantId, index) => {
      const p = game.players.find((x) => x.participantId === participantId) as SimGamePlayer
      const before = previous.indexOf(participantId)
      return {
        position: index + 1,
        participantId,
        nickname: p.nickname,
        score: p.score,
        positionDelta: withDelta ? before - index : 0,
      }
    })
  }

  function stateQuestion(game: SimGame, me: SimGamePlayer): StateQuestion | null {
    const round = currentRound(game)
    const { id, text, categoryId, difficulty, options } = round.question
    if (game.phase === 'QUESTION') {
      const removed = round.hintRemoved[me.participantId] ?? []
      // D6: con HINT el servidor quita 2 opciones incorrectas del estado de ese jugador.
      return {
        id,
        text,
        categoryId,
        difficulty,
        options: options.filter((o) => !removed.includes(o.id)).map(({ id: oid, text: otext }) => ({ id: oid, text: otext })),
      }
    }
    if (game.phase === 'REVEAL') {
      return { id, text, categoryId, difficulty, options: options.map((o) => ({ ...o })) }
    }
    return null
  }

  const toWinner = ({ participantId, nickname, score }: SimGamePlayer) => ({ participantId, nickname, score })

  function getState(player: SimPlayer, gameId: string): { state: GameState; version: number } {
    const game = findGame(gameId)
    const me = gamePlayerOf(game, player)
    tick(game)
    const showResult = game.phase === 'REVEAL' || game.phase === 'SCOREBOARD'
    const isFinal = game.phase === 'FINAL'
    const round = currentRound(game)
    const state: GameState = {
      version: game.version,
      phase: game.phase,
      serverTime: fmt(now()),
      round: isFinal
        ? null
        : {
            number: round.number,
            totalRounds: game.rounds.length,
            type: round.type,
            endsAt: fmt(game.phaseEnd as number),
            question: stateQuestion(game, me),
          },
      me: {
        participantId: me.participantId,
        score: me.score,
        lives: me.lives,
        status: me.status,
        hasAnswered: hasAnswered(game, me),
        powers: me.powers.map((powerType) => ({ powerType })),
        activePower: me.activePower,
        lastResult: showResult ? me.lastResult : null,
      },
      players: game.players.map((p) => ({
        participantId: p.participantId,
        nickname: p.nickname,
        score: p.score,
        lives: p.lives,
        status: p.status,
        isHost: p.isHost,
        hasAnswered: hasAnswered(game, p),
        pointsThisRound: game.phase === 'REVEAL' ? p.pointsThisRound : null,
      })),
      ranking:
        game.phase === 'SCOREBOARD'
          ? rankingEntries(game, closedRounds(game), true)
          : isFinal
            ? rankingEntries(game, closedRounds(game), false)
            : null,
      winner: isFinal ? toWinner(standings(game)[0]) : null,
    }
    return { state, version: game.version }
  }

  // ── partida: acciones
  function answer(player: SimPlayer, gameId: string, roundNumber: number, optionId: unknown): AnswerResponse {
    const game = findGame(gameId)
    const me = gamePlayerOf(game, player)
    tick(game)
    if (me.status === 'SPECTATOR') throw new SimError(403, 'SPECTATOR_CANNOT_ACT')
    const round = currentRound(game)
    if (game.phase !== 'QUESTION' || round.number !== roundNumber) throw new SimError(409, 'ROUND_NOT_ACTIVE')
    if (typeof optionId !== 'string' || !round.question.options.some((o) => o.id === optionId)) {
      throw new SimError(422, 'INVALID_OPTION')
    }
    if (round.answers[me.participantId]) throw new SimError(409, 'ALREADY_ANSWERED')
    // El tiempo lo mide el servidor al recibir la respuesta.
    round.answers[me.participantId] = { optionId, answerTimeMs: now() - game.phaseStart }
    game.version += 1
    return { accepted: true }
  }

  function usePower(player: SimPlayer, gameId: string, roundNumber: number, powerType: unknown): PowerResponse {
    const game = findGame(gameId)
    const me = gamePlayerOf(game, player)
    tick(game)
    if (typeof powerType !== 'string' || !(POWER_TYPES as readonly string[]).includes(powerType)) {
      throw new SimError(422, 'VALIDATION_ERROR')
    }
    const power = powerType as PowerType
    if (me.status === 'SPECTATOR') throw new SimError(403, 'SPECTATOR_CANNOT_ACT')
    const round = currentRound(game)
    if (game.phase !== 'QUESTION' || round.number !== roundNumber) throw new SimError(409, 'ROUND_NOT_ACTIVE')
    if (round.answers[me.participantId]) throw new SimError(409, 'ALREADY_ANSWERED')
    // SUPUESTO DE MOCK: un solo poder activo por ronda (activePower es un único valor).
    if (!me.powers.includes(power) || me.activePower !== null) throw new SimError(409, 'POWER_NOT_AVAILABLE')

    me.powers = me.powers.filter((p) => p !== power)
    me.activePower = power
    game.version += 1
    if (power === 'HINT') {
      const removed = shuffle(round.question.options.filter((o) => !o.isCorrect))
        .slice(0, 2)
        .map((o) => o.id)
      round.hintRemoved[me.participantId] = removed
      return { powerType: power, effect: { removedOptionIds: removed } }
    }
    return { powerType: power, effect: {} }
  }

  function roundResults(player: SimPlayer, gameId: string, roundNumber: number): RoundResults {
    const game = findGame(gameId)
    gamePlayerOf(game, player)
    tick(game)
    const round = game.rounds[roundNumber - 1]
    if (!round || !round.outcomes) throw new SimError(409, 'ROUND_NOT_FINISHED')
    return {
      gameId: game.id,
      round: {
        number: round.number,
        type: round.type,
        question: {
          id: round.question.id,
          text: round.question.text,
          correctOptionId: (round.question.options.find((o) => o.isCorrect) as SimOption).id,
        },
      },
      results: [...round.outcomes].sort((a, b) => b.pointsAwarded - a.pointsAwarded),
    }
  }

  function ranking(player: SimPlayer, gameId: string): RankingResponse {
    const game = findGame(gameId)
    gamePlayerOf(game, player)
    tick(game)
    const afterRound = closedRounds(game)
    return { gameId: game.id, afterRound, items: rankingEntries(game, afterRound, true) }
  }

  function results(player: SimPlayer, gameId: string): GameResults {
    const game = findGame(gameId)
    gamePlayerOf(game, player)
    tick(game)
    if (game.phase !== 'FINAL') throw new SimError(409, 'GAME_NOT_FINISHED')
    const order = standings(game)
    const stats: PlayerStats[] = order.map((p) => {
      const answered = game.rounds
        .map((r) => ({ round: r, answer: r.answers[p.participantId], outcome: r.outcomes?.find((o) => o.participantId === p.participantId) }))
        .filter((x) => x.answer !== undefined)
      const times = answered.map((x) => x.answer.answerTimeMs)
      const best = game.rounds
        .map((r) => ({ number: r.number, points: r.outcomes?.find((o) => o.participantId === p.participantId)?.pointsAwarded ?? 0 }))
        .sort((a, b) => b.points - a.points)[0]
      return {
        participantId: p.participantId,
        nickname: p.nickname,
        correctAnswers: answered.filter((x) => x.outcome?.isCorrect).length,
        totalAnswers: answered.length,
        averageAnswerTimeMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
        fastestAnswerMs: times.length ? Math.min(...times) : 0,
        bestRound: best ?? { number: 0, points: 0 },
      }
    })
    return {
      gameId: game.id,
      roomCode: game.roomCode,
      totalRounds: game.rounds.length,
      winner: { participantId: order[0].participantId, nickname: order[0].nickname, score: order[0].score },
      ranking: order.map((p, i) => ({ position: i + 1, participantId: p.participantId, nickname: p.nickname, score: p.score })),
      stats,
    }
  }

  function advance(player: SimPlayer, gameId: string): AdvanceResponse {
    const game = findGame(gameId)
    const me = gamePlayerOf(game, player)
    if (!me.isHost) throw new SimError(403, 'NOT_HOST')
    tick(game)
    if (game.phase === 'FINAL') throw new SimError(409, 'GAME_FINISHED')
    transition(game, now())
    return { phase: game.phase, version: game.version }
  }

  // ── herramientas de desarrollo (DevPanel)
  const dev = {
    /** Crea una sala con el jugador como host y los 3 bots ya dentro, e inicia la partida. */
    quickStart(player: SimPlayer, rounds: number) {
      const created = createRoom(player, { rounds })
      const room = findRoom(created.code)
      room.pendingBots = []
      for (const bot of BOTS) {
        room.participants.push({ participantId: nextId('pt'), playerId: null, nickname: bot.nickname, isHost: false, botSkill: bot.skill })
      }
      const started = startGame(player, room.code)
      return { code: room.code, gameId: started.gameId, participantId: created.participantId }
    },
    /** Avanza fase a fase (con sus efectos: cierre de ronda, puntos…) hasta llegar a `target`. */
    goToPhase(gameId: string, target: Phase): void {
      const game = findGame(gameId)
      tick(game)
      for (let i = 0; i < 100 && game.phase !== 'FINAL'; i++) {
        transition(game, now())
        if (game.phase === target) return
      }
    },
    setSpectator(gameId: string, playerId: string, on: boolean): void {
      const game = findGame(gameId)
      const me = game.players.find((p) => p.playerId === playerId)
      if (!me) return
      me.status = on ? 'SPECTATOR' : 'ACTIVE'
      me.lives = on ? 0 : Math.max(me.lives, 1)
      game.version += 1
    },
    setRoundType(gameId: string, type: RoundType): void {
      const game = findGame(gameId)
      currentRound(game).type = type
      game.version += 1
    },
    restorePowers(gameId: string, playerId: string): void {
      const game = findGame(gameId)
      const me = game.players.find((p) => p.playerId === playerId)
      if (!me) return
      me.powers = [...POWER_TYPES]
      me.activePower = null
      game.version += 1
    },
    /** Resumen para el monitor del DevPanel. */
    inspect(gameId: string) {
      const game = world.games.find((g) => g.id === gameId)
      if (!game) return null
      tick(game)
      return {
        id: game.id,
        phase: game.phase,
        version: game.version,
        round: game.phase === 'FINAL' ? null : currentRound(game).number,
        totalRounds: game.rounds.length,
        roundType: currentRound(game).type,
        phaseEnd: game.phaseEnd,
      }
    },
  }

  return {
    world,
    categories: () => ({ items: MOCK_CATEGORIES.map((c) => ({ ...c })) }),
    createPlayer,
    authenticate,
    createRoom,
    getRoom,
    updateRoom,
    joinRoom,
    leaveRoom,
    startGame,
    getState,
    answer,
    usePower,
    roundResults,
    ranking,
    results,
    advance,
    dev,
  }
}

export type Simulator = ReturnType<typeof createSimulator>
