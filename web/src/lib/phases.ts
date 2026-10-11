import type { Phase } from '@/api/types'

/** Duración de cada fase (README §4). La controla el servidor; aquí solo sirve para dibujar. */
export const PHASE_DURATION_MS: Record<Exclude<Phase, 'FINAL'>, number> = {
  ROUND_INTRO: 3000,
  QUESTION: 20000,
  REVEAL: 4000,
  SCOREBOARD: 6000,
}

export const LAST_SECONDS_WARNING = 5
