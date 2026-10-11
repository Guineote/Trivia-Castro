import { request, type HttpResult } from './http'
import type {
  AdvanceResponse,
  AnswerResponse,
  Category,
  CreatePlayerResponse,
  CreateRoomResponse,
  GameResults,
  GameState,
  ItemsResponse,
  JoinRoomResponse,
  PowerResponse,
  PowerType,
  RankingResponse,
  Room,
  RoomSettings,
  RoundResults,
  StartGameResponse,
} from './types'

/** Una llamada que siempre devuelve cuerpo (no 304). */
async function call<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await request<T>(method, path, { body, signal })
  return res.data as T
}

const enc = encodeURIComponent

/** Un método por endpoint de docs/contrato/endpoints.md. No hay otros. */
export const api = {
  // Sesión y salas
  createPlayer: (nickname: string) => call<CreatePlayerResponse>('POST', '/players', { nickname }),
  createRoom: (settings?: Partial<RoomSettings>) =>
    call<CreateRoomResponse>('POST', '/rooms', settings ? { settings } : {}),
  getRoom: (code: string, signal?: AbortSignal) =>
    call<Room>('GET', `/rooms/${enc(code)}`, undefined, signal),
  updateRoom: (code: string, settings: Partial<RoomSettings>) =>
    call<Room>('PATCH', `/rooms/${enc(code)}`, { settings }),
  /** 201 = nuevo participante, 200 = reconexión (mismo participantId). Ambos son éxito. */
  joinRoom: (code: string, nickname?: string) =>
    call<JoinRoomResponse>('POST', `/rooms/${enc(code)}/players`, nickname ? { nickname } : undefined),
  leaveRoom: (code: string, participantId: string) =>
    call<void>('DELETE', `/rooms/${enc(code)}/players/${enc(participantId)}`),
  startGame: (code: string) => call<StartGameResponse>('POST', `/rooms/${enc(code)}/games`),

  // Partida
  /** Con `etag`, un 304 llega como status 304 y data null (conservar el estado anterior). */
  getGameState: (
    gameId: string,
    etag: string | null,
    signal?: AbortSignal,
  ): Promise<HttpResult<GameState>> =>
    request<GameState>('GET', `/games/${enc(gameId)}/state`, { etag, signal }),
  answer: (gameId: string, round: number, optionId: string) =>
    call<AnswerResponse>('POST', `/games/${enc(gameId)}/rounds/${round}/answers`, { optionId }),
  usePower: (gameId: string, round: number, powerType: PowerType) =>
    call<PowerResponse>('POST', `/games/${enc(gameId)}/rounds/${round}/powers`, { powerType }),
  getRoundResults: (gameId: string, round: number) =>
    call<RoundResults>('GET', `/games/${enc(gameId)}/rounds/${round}/results`),
  getRanking: (gameId: string) => call<RankingResponse>('GET', `/games/${enc(gameId)}/ranking`),
  getResults: (gameId: string) => call<GameResults>('GET', `/games/${enc(gameId)}/results`),
  advance: (gameId: string) => call<AdvanceResponse>('POST', `/games/${enc(gameId)}/advance`),

  // Contenido
  getCategories: () => call<ItemsResponse<Category>>('GET', '/categories'),
}
