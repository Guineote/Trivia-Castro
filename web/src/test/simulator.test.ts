import { beforeEach, describe, expect, it } from 'vitest'
import { POWER_TYPES } from '@/api/types'
import { PHASE_DURATION_MS } from '@/lib/phases'
import { createSimulator, mockSpeedBonus, SimError, type Simulator } from '@/mock/simulator'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let time = 0
let sim: Simulator

function setup(rounds = 3) {
  time = 1_800_000_000_000
  sim = createSimulator({ now: () => time, random: mulberry32(7), botsInRoom: () => false })
  const ana = sim.authenticate(sim.createPlayer('Ana').token)
  const beto = sim.authenticate(sim.createPlayer('Beto').token)
  const room = sim.createRoom(ana, { rounds })
  sim.joinRoom(beto, room.code)
  const { gameId } = sim.startGame(ana, room.code)
  return { ana, beto, room, gameId }
}

const advanceTime = (ms: number) => {
  time += ms
}

/** Id de la opción correcta, leído del mundo (no está en el state hasta REVEAL). */
function correctOptionId(gameId: string, round: number): string {
  const game = sim.world.games.find((g) => g.id === gameId)!
  return game.rounds[round - 1].question.options.find((o) => o.isCorrect)!.id
}

describe('simulador · fases con tiempos reales', () => {
  beforeEach(() => setup())

  it('recorre ROUND_INTRO → QUESTION → REVEAL → SCOREBOARD → … → FINAL con 3/20/4/6 s', () => {
    const { ana, gameId } = setup(2)
    const seen: string[] = []
    const record = () => {
      const { state } = sim.getState(ana, gameId)
      if (seen[seen.length - 1] !== `${state.round?.number}:${state.phase}`) seen.push(`${state.round?.number}:${state.phase}`)
      return state
    }
    expect(record().phase).toBe('ROUND_INTRO')
    advanceTime(PHASE_DURATION_MS.ROUND_INTRO - 1)
    expect(record().phase).toBe('ROUND_INTRO')
    advanceTime(1)
    expect(record().phase).toBe('QUESTION')
    advanceTime(PHASE_DURATION_MS.QUESTION)
    expect(record().phase).toBe('REVEAL')
    advanceTime(PHASE_DURATION_MS.REVEAL)
    expect(record().phase).toBe('SCOREBOARD')
    advanceTime(PHASE_DURATION_MS.SCOREBOARD)
    expect(record().phase).toBe('ROUND_INTRO')
    expect(record().round?.number).toBe(2)
    advanceTime(3000 + 20000 + 4000 + 6000)
    const final = record()
    expect(final.phase).toBe('FINAL')
    expect(final.round).toBeNull()
    expect(final.winner).not.toBeNull()
    expect(final.ranking).toHaveLength(2)
    expect(seen).toEqual(['1:ROUND_INTRO', '1:QUESTION', '1:REVEAL', '1:SCOREBOARD', '2:ROUND_INTRO', 'undefined:FINAL'])
  })

  it('se pone al día tras una pausa larga (pestaña en segundo plano) sin saltarse efectos', () => {
    const { ana, gameId } = setup(3)
    advanceTime(10 * 60 * 1000)
    const { state } = sim.getState(ana, gameId)
    expect(state.phase).toBe('FINAL')
    // Nadie respondió: todas las rondas fueron timeout → vidas perdidas y paso a espectador.
    expect(state.me.lives).toBe(0)
    expect(state.me.status).toBe('SPECTATOR')
  })

  it('la versión sube con cada cambio y no cambia si no pasa nada (base del 304)', () => {
    const { ana, gameId } = setup()
    const v1 = sim.getState(ana, gameId).version
    expect(sim.getState(ana, gameId).version).toBe(v1)
    advanceTime(PHASE_DURATION_MS.ROUND_INTRO)
    expect(sim.getState(ana, gameId).version).toBeGreaterThan(v1)
  })

  it('advance del host salta la fase; un no-host recibe NOT_HOST', () => {
    const { ana, beto, gameId } = setup()
    expect(() => sim.advance(beto, gameId)).toThrowError(expect.objectContaining({ code: 'NOT_HOST' }))
    expect(sim.advance(ana, gameId).phase).toBe('QUESTION')
  })
})

describe('simulador · reglas de la ronda', () => {
  it('la correcta solo aparece en REVEAL; en QUESTION las opciones no traen isCorrect', () => {
    const { ana, gameId } = setup()
    advanceTime(3000)
    const q = sim.getState(ana, gameId).state.round!.question!
    expect(q.options.every((o) => o.isCorrect === undefined)).toBe(true)
    advanceTime(20000)
    const r = sim.getState(ana, gameId).state.round!.question!
    expect(r.options.filter((o) => o.isCorrect)).toHaveLength(1)
  })

  it('puntos = (base + velocidad) × ronda × poder: ronda DOUBLE + poder DOUBLE = x4', () => {
    const { ana, gameId } = setup(3)
    // Ronda 3 es DOUBLE en el mock. Se avanza hasta ella.
    sim.dev.goToPhase(gameId, 'ROUND_INTRO')
    sim.dev.goToPhase(gameId, 'ROUND_INTRO')
    expect(sim.getState(ana, gameId).state.round?.number).toBe(3)
    sim.dev.goToPhase(gameId, 'QUESTION')
    sim.usePower(ana, gameId, 3, 'DOUBLE')
    advanceTime(4200)
    sim.answer(ana, gameId, 3, correctOptionId(gameId, 3))
    advanceTime(PHASE_DURATION_MS.QUESTION - 4200)
    const { state } = sim.getState(ana, gameId)
    expect(state.phase).toBe('REVEAL')
    const r = state.me.lastResult!
    expect(r.isCorrect).toBe(true)
    expect(r.roundMultiplier).toBe(2)
    expect(r.powerMultiplier).toBe(2)
    expect(r.pointsAwarded).toBe((r.basePoints + r.speedBonus) * 4)
    expect(r.speedBonus).toBe(mockSpeedBonus(4200))
    expect(state.me.activePower).toBe('DOUBLE')
  })

  it('el ejemplo del contrato: 4.2 s → bonus 316', () => {
    expect(mockSpeedBonus(4200)).toBe(316)
  })

  it('fallar: 0 puntos y −1 vida; SHIELD evita perder la vida; el puntaje nunca baja', () => {
    const { ana, gameId } = setup(3)
    sim.dev.goToPhase(gameId, 'QUESTION')
    const wrong = sim.world.games[0].rounds[0].question.options.find((o) => !o.isCorrect)!.id
    sim.answer(ana, gameId, 1, wrong)
    advanceTime(20000)
    let me = sim.getState(ana, gameId).state.me
    expect(me.lastResult).toMatchObject({ isCorrect: false, pointsAwarded: 0, livesLost: 1 })
    expect(me.lives).toBe(2)
    expect(me.score).toBe(0)

    sim.dev.goToPhase(gameId, 'QUESTION') // ronda 2
    sim.usePower(ana, gameId, 2, 'SHIELD')
    sim.answer(ana, gameId, 2, sim.world.games[0].rounds[1].question.options.find((o) => !o.isCorrect)!.id)
    advanceTime(20000)
    me = sim.getState(ana, gameId).state.me
    expect(me.lastResult).toMatchObject({ isCorrect: false, livesLost: 0 })
    expect(me.lives).toBe(2)
  })

  it('HINT quita 2 opciones incorrectas solo del estado de ese jugador', () => {
    const { ana, beto, gameId } = setup()
    sim.dev.goToPhase(gameId, 'QUESTION')
    const res = sim.usePower(ana, gameId, 1, 'HINT')
    expect(res.effect.removedOptionIds).toHaveLength(2)
    const mine = sim.getState(ana, gameId).state.round!.question!.options
    const theirs = sim.getState(beto, gameId).state.round!.question!.options
    expect(mine).toHaveLength(2)
    expect(theirs).toHaveLength(4)
    expect(mine.map((o) => o.id)).toContain(correctOptionId(gameId, 1))
    expect(sim.getState(ana, gameId).state.me.powers.map((p) => p.powerType)).not.toContain('HINT')
  })

  it('errores por código: doble respuesta, fuera de ronda, opción inválida, poder repetido, espectador', () => {
    const { ana, gameId } = setup()
    expect(() => sim.answer(ana, gameId, 1, 'o1')).toThrowError(expect.objectContaining({ code: 'ROUND_NOT_ACTIVE' }))
    sim.dev.goToPhase(gameId, 'QUESTION')
    expect(() => sim.answer(ana, gameId, 1, 'o99')).toThrowError(expect.objectContaining({ code: 'INVALID_OPTION' }))
    sim.answer(ana, gameId, 1, 'o1')
    expect(() => sim.answer(ana, gameId, 1, 'o2')).toThrowError(expect.objectContaining({ code: 'ALREADY_ANSWERED' }))
    expect(() => sim.usePower(ana, gameId, 1, 'SHIELD')).toThrowError(expect.objectContaining({ code: 'ALREADY_ANSWERED' }))
    sim.dev.setSpectator(gameId, ana.playerId, true)
    expect(() => sim.answer(ana, gameId, 1, 'o1')).toThrowError(expect.objectContaining({ code: 'SPECTATOR_CANNOT_ACT' }))
    expect(POWER_TYPES).toContain('SHIELD')
  })

  it('SCOREBOARD trae ranking con positionDelta y FINAL con winner', () => {
    const { ana, beto, gameId } = setup(1)
    sim.dev.goToPhase(gameId, 'QUESTION')
    sim.answer(beto, gameId, 1, correctOptionId(gameId, 1))
    advanceTime(20000)
    sim.dev.goToPhase(gameId, 'SCOREBOARD')
    const { ranking } = sim.getState(ana, gameId).state
    expect(ranking![0]).toMatchObject({ nickname: 'Beto', position: 1, positionDelta: 1 })
    expect(ranking![1]).toMatchObject({ nickname: 'Ana', position: 2, positionDelta: -1 })
    sim.dev.goToPhase(gameId, 'FINAL')
    expect(sim.getState(ana, gameId).state.winner?.nickname).toBe('Beto')
    expect(sim.results(ana, gameId).stats).toHaveLength(2)
  })
})

describe('simulador · salas', () => {
  beforeEach(() => {
    time = 1_800_000_000_000
    sim = createSimulator({ now: () => time, random: mulberry32(3), botsInRoom: () => false })
  })

  it('unirse: 201 nuevo, 200 reconexión con el mismo participantId; 409/422/404 por código', () => {
    const ana = sim.authenticate(sim.createPlayer('Ana').token)
    const beto = sim.authenticate(sim.createPlayer('Beto').token)
    const otro = sim.authenticate(sim.createPlayer('Ana').token)
    const room = sim.createRoom(ana, { maxPlayers: 2 })
    const first = sim.joinRoom(beto, room.code)
    expect(first.created).toBe(true)
    const again = sim.joinRoom(beto, room.code)
    expect(again.created).toBe(false)
    expect(again.body.participantId).toBe(first.body.participantId)
    expect(() => sim.joinRoom(otro, room.code)).toThrowError(expect.objectContaining({ code: 'ROOM_FULL' }))
    expect(() => sim.joinRoom(otro, 'ZZZZZZ')).toThrowError(expect.objectContaining({ code: 'ROOM_NOT_FOUND' }))
    const room2 = sim.createRoom(ana)
    expect(() => sim.joinRoom(otro, room2.code)).toThrowError(expect.objectContaining({ code: 'NICKNAME_TAKEN' }))
    expect(sim.joinRoom(otro, room2.code, 'Ana2').created).toBe(true)
  })

  it('iniciar: NOT_HOST, NOT_ENOUGH_PLAYERS, GAME_ALREADY_STARTED y currentGameId en la sala', () => {
    const ana = sim.authenticate(sim.createPlayer('Ana').token)
    const beto = sim.authenticate(sim.createPlayer('Beto').token)
    const room = sim.createRoom(ana)
    expect(() => sim.startGame(ana, room.code)).toThrowError(expect.objectContaining({ code: 'NOT_ENOUGH_PLAYERS' }))
    sim.joinRoom(beto, room.code)
    expect(() => sim.startGame(beto, room.code)).toThrowError(expect.objectContaining({ code: 'NOT_HOST' }))
    expect(sim.getRoom(room.code).currentGameId).toBeNull()
    const { gameId } = sim.startGame(ana, room.code)
    expect(sim.getRoom(room.code)).toMatchObject({ currentGameId: gameId, status: 'IN_GAME' })
    expect(() => sim.startGame(ana, room.code)).toThrowError(expect.objectContaining({ code: 'GAME_ALREADY_STARTED' }))
  })

  it('NOT_ENOUGH_QUESTIONS si se piden más rondas que preguntas', () => {
    const ana = sim.authenticate(sim.createPlayer('Ana').token)
    const beto = sim.authenticate(sim.createPlayer('Beto').token)
    const room = sim.createRoom(ana, { rounds: 20 })
    sim.joinRoom(beto, room.code)
    expect(() => sim.startGame(ana, room.code)).toThrowError(expect.objectContaining({ code: 'NOT_ENOUGH_QUESTIONS' }))
  })

  it('los errores del simulador son SimError con status HTTP', () => {
    try {
      sim.createPlayer('x')
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(SimError)
      expect(err).toMatchObject({ status: 422, code: 'VALIDATION_ERROR' })
    }
  })
})
