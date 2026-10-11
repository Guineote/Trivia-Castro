/**
 * Tipos del contrato (docs/contrato/). Derivados de los JSON de ejemplo y de los
 * enums del README. Si la API real difiere, se arregla aquí y se avisa a Jared.
 * Ids: siempre string. Fechas: ISO 8601 UTC.
 */

// ── Enums ───────────────────────────────────────────────────────────────────
export const PHASES = ['ROUND_INTRO', 'QUESTION', 'REVEAL', 'SCOREBOARD', 'FINAL'] as const
export type Phase = (typeof PHASES)[number]

export const ROUND_TYPES = ['NORMAL', 'DOUBLE'] as const
export type RoundType = (typeof ROUND_TYPES)[number]

export const POWER_TYPES = ['DOUBLE', 'SHIELD', 'HINT'] as const
export type PowerType = (typeof POWER_TYPES)[number]

export const PARTICIPANT_STATUSES = ['ACTIVE', 'SPECTATOR'] as const
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number]

export const ROOM_STATUSES = ['WAITING', 'IN_GAME', 'FINISHED'] as const
export type RoomStatus = (typeof ROOM_STATUSES)[number]

export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

// ── Sesión ──────────────────────────────────────────────────────────────────
export interface CreatePlayerResponse {
  playerId: string
  nickname: string
  token: string
}

// ── Salas ───────────────────────────────────────────────────────────────────
export interface RoomSettings {
  maxPlayers: number
  rounds: number
  lives: number
  /** Vacío = todas las categorías. */
  categoryIds: string[]
}

export interface RoomParticipant {
  participantId: string
  nickname: string
  isHost: boolean
}

export interface Room {
  code: string
  status: RoomStatus
  hostParticipantId: string
  settings: RoomSettings
  participants: RoomParticipant[]
  /** null hasta que el host inicia la partida. */
  currentGameId: string | null
}

/** POST /rooms (201). */
export interface CreateRoomResponse extends Room {
  participantId: string
}

/** POST /rooms/{code}/players (201 nuevo · 200 reconexión). */
export interface JoinRoomResponse {
  participantId: string
  participants: RoomParticipant[]
}

/** POST /rooms/{code}/games (201). */
export interface StartGameResponse {
  gameId: string
  phase: Phase
  version: number
}

// ── Estado de la partida (GET /games/{id}/state) ────────────────────────────
export interface StateOption {
  id: string
  text: string
  /** Solo presente en REVEAL. */
  isCorrect?: boolean
}

export interface StateQuestion {
  id: string
  text: string
  categoryId: string
  difficulty: Difficulty
  /** Con HINT activo, el servidor ya quitó 2 opciones incorrectas (D6). */
  options: StateOption[]
}

export interface StateRound {
  number: number
  totalRounds: number
  type: RoundType
  /** Fin de la fase actual (no solo de la pregunta). */
  endsAt: string
  /** null en ROUND_INTRO y SCOREBOARD. */
  question: StateQuestion | null
}

export interface InventoryPower {
  powerType: PowerType
}

/**
 * Desglose de la última ronda. Supuesto (pendiente con Jared): en timeout,
 * `chosenOptionId` y `answerTimeMs` vienen null (como en round-results.json).
 */
export interface LastResult {
  chosenOptionId: string | null
  isCorrect: boolean
  answerTimeMs: number | null
  basePoints: number
  speedBonus: number
  roundMultiplier: number
  powerMultiplier: number
  pointsAwarded: number
  livesLost: number
  becameSpectator: boolean
}

export interface Me {
  participantId: string
  score: number
  lives: number
  status: ParticipantStatus
  hasAnswered: boolean
  /** Inventario disponible. */
  powers: InventoryPower[]
  /** Forma exacta pendiente con Jared; se asume PowerType | null. */
  activePower: PowerType | null
  lastResult: LastResult | null
}

export interface PublicPlayer {
  participantId: string
  nickname: string
  score: number
  lives: number
  status: ParticipantStatus
  isHost: boolean
  hasAnswered: boolean
  pointsThisRound: number | null
}

export interface RankingEntry {
  position: number
  participantId: string
  nickname: string
  score: number
  /** posiciónAnterior − posiciónActual (positivo = subió). */
  positionDelta: number
}

export interface Winner {
  participantId: string
  nickname: string
  score: number
}

export interface GameState {
  version: number
  phase: Phase
  serverTime: string
  /** null en FINAL. */
  round: StateRound | null
  me: Me
  players: PublicPlayer[]
  /** Solo en SCOREBOARD y FINAL. */
  ranking: RankingEntry[] | null
  /** Solo en FINAL. */
  winner: Winner | null
}

// ── Acciones de partida ─────────────────────────────────────────────────────
export interface AnswerResponse {
  accepted: boolean
}

export interface PowerResponse {
  powerType: PowerType
  /** HINT: removedOptionIds. DOUBLE y SHIELD: {}. */
  effect: { removedOptionIds?: string[] }
}

export interface AdvanceResponse {
  phase: Phase
  version: number
}

// ── Resultados ──────────────────────────────────────────────────────────────
export interface RoundResultEntry {
  participantId: string
  nickname: string
  chosenOptionId: string | null
  isCorrect: boolean
  answerTimeMs: number | null
  pointsAwarded: number
  livesLost: number
}

/** GET /games/{id}/rounds/{n}/results */
export interface RoundResults {
  gameId: string
  round: {
    number: number
    type: RoundType
    question: { id: string; text: string; correctOptionId: string }
  }
  results: RoundResultEntry[]
}

/** GET /games/{id}/ranking */
export interface RankingResponse {
  gameId: string
  afterRound: number
  items: RankingEntry[]
}

export interface FinalRankingEntry {
  position: number
  participantId: string
  nickname: string
  score: number
}

export interface PlayerStats {
  participantId: string
  nickname: string
  correctAnswers: number
  totalAnswers: number
  averageAnswerTimeMs: number
  fastestAnswerMs: number
  bestRound: { number: number; points: number }
}

/** GET /games/{id}/results (en `ranking` no viene positionDelta). */
export interface GameResults {
  gameId: string
  roomCode: string
  totalRounds: number
  winner: Winner
  ranking: FinalRankingEntry[]
  stats: PlayerStats[]
}

export interface Category {
  id: string
  name: string
}

export interface ItemsResponse<T> {
  items: T[]
}
