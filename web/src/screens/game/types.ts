import type { GameState } from '@/api/types'

/** Props comunes de las pantallas de partida (05–09). Todas se dibujan desde `state`. */
export interface GameScreenProps {
  gameId: string
  state: GameState
  /** Máximo de vidas observado en esta partida (el contrato no manda el valor inicial). */
  maxLives: number
}
