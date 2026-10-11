import type { RoomSettings } from '@/api/types'

/**
 * Rangos de los sliders de ajustes. SUPUESTO: el contrato solo da los valores por defecto (D4)
 * y los rangos siguen pendientes con Jared (PENDIENTES.md). Si el servidor rechaza un valor
 * responderá 422 VALIDATION_ERROR y se muestra el mensaje.
 */
export const SETTINGS_RANGES = {
  maxPlayers: { min: 2, max: 12 },
  rounds: { min: 1, max: 15 },
  lives: { min: 1, max: 5 },
} as const

/** Valores por defecto (contrato D4). */
export const DEFAULT_SETTINGS: RoomSettings = { maxPlayers: 8, rounds: 10, lives: 3, categoryIds: [] }
