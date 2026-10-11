/** Códigos de error del contrato (docs/contrato/README.md §2). */
export const CONTRACT_ERROR_CODES = [
  'UNAUTHORIZED',
  'NOT_HOST',
  'FORBIDDEN',
  'NOT_IN_GAME',
  'SPECTATOR_CANNOT_ACT',
  'ROOM_NOT_FOUND',
  'GAME_NOT_FOUND',
  'ROOM_FULL',
  'GAME_ALREADY_STARTED',
  'NOT_ENOUGH_PLAYERS',
  'NOT_ENOUGH_QUESTIONS',
  'ROUND_NOT_ACTIVE',
  'ALREADY_ANSWERED',
  'POWER_NOT_AVAILABLE',
  'ROUND_NOT_FINISHED',
  'GAME_NOT_FINISHED',
  'GAME_FINISHED',
  'GAME_IN_PROGRESS',
  'NICKNAME_TAKEN',
  'INVALID_OPTION',
  'VALIDATION_ERROR',
] as const
export type ContractErrorCode = (typeof CONTRACT_ERROR_CODES)[number]

/** Códigos que genera el cliente (no vienen del servidor). */
export type ClientErrorCode = 'NETWORK_ERROR' | 'INVALID_RESPONSE' | 'UNKNOWN'
export type ApiErrorCode = ContractErrorCode | ClientErrorCode

/** Mensaje en pantalla por código (README §2). Se decide por `code`, nunca por el texto del servidor. */
export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  UNAUTHORIZED: 'Tu sesión no es válida',
  NOT_HOST: 'Solo el host puede hacer esto',
  FORBIDDEN: 'No tienes permiso',
  NOT_IN_GAME: 'No estás en esta partida',
  SPECTATOR_CANNOT_ACT: 'Eres espectador',
  ROOM_NOT_FOUND: 'No existe esa sala',
  GAME_NOT_FOUND: 'No existe esa partida',
  ROOM_FULL: 'La sala está llena',
  GAME_ALREADY_STARTED: 'La partida ya comenzó',
  NOT_ENOUGH_PLAYERS: 'Faltan jugadores',
  NOT_ENOUGH_QUESTIONS: 'No hay suficientes preguntas',
  ROUND_NOT_ACTIVE: 'La ronda ya cerró',
  ALREADY_ANSWERED: 'Ya respondiste',
  POWER_NOT_AVAILABLE: 'Ese poder no está disponible',
  ROUND_NOT_FINISHED: 'Aún no hay resultados',
  GAME_NOT_FINISHED: 'La partida aún no termina',
  GAME_FINISHED: 'La partida ya terminó',
  GAME_IN_PROGRESS: 'Hay una partida en curso',
  NICKNAME_TAKEN: 'Ese nombre ya está en uso',
  INVALID_OPTION: 'Opción no válida',
  VALIDATION_ERROR: 'Revisa los datos',
  NETWORK_ERROR: 'Sin conexión con el servidor',
  INVALID_RESPONSE: 'Respuesta inesperada del servidor',
  UNKNOWN: 'Algo salió mal',
}

export class ApiError extends Error {
  readonly status: number
  /** Código del contrato o del cliente; un código desconocido del servidor llega tal cual. */
  readonly code: string

  constructor(status: number, code: string, message?: string) {
    super(message ?? errorMessage(code))
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function errorMessage(code: string): string {
  return code in ERROR_MESSAGES ? ERROR_MESSAGES[code as ApiErrorCode] : ERROR_MESSAGES.UNKNOWN
}

/** Mensaje en español para mostrar a partir de cualquier error capturado. */
export function messageFromError(err: unknown): string {
  if (err instanceof ApiError) return errorMessage(err.code)
  return ERROR_MESSAGES.UNKNOWN
}

export function isApiError(err: unknown, code?: ApiErrorCode): err is ApiError {
  return err instanceof ApiError && (code === undefined || err.code === code)
}
