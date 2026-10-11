import { useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { GameState } from '@/api/types'
import { CURTAIN_COVER_SECONDS } from '@/components/PhaseCurtain/PhaseCurtain'
import { dur } from '@/lib/motion'

/** Identifica el "momento" de la partida: cambia con cada fase y con cada ronda. */
export const stateKey = (s: GameState): string => `${s.round?.number ?? 'final'}:${s.phase}`

/**
 * Estado que se está dibujando. Sigue al estado en vivo, pero cuando cambia de fase espera a que
 * la cortinilla cubra la pantalla (~220 ms) antes de cambiar. Dentro de una misma fase se
 * actualiza al instante. El servidor manda: si llega otra fase mientras tanto, se salta a la nueva.
 */
export function useShownState(live: GameState | undefined) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState<GameState | undefined>(live)
  const [curtain, setCurtain] = useState({ key: 0, target: '' })

  // Ajustes de estado derivado durante el render (patrón recomendado por React, sin efectos).
  if (live && !shown) {
    setShown(live)
  } else if (live && shown) {
    const liveKey = stateKey(live)
    if (liveKey === stateKey(shown)) {
      if (live !== shown) setShown(live) // misma fase: datos al instante
    } else if (curtain.target !== liveKey) {
      // Fase nueva: dispara la cortinilla (salvo con movimiento reducido).
      setCurtain({ key: reduce ? curtain.key : curtain.key + 1, target: liveKey })
    }
  }

  // El cambio de pantalla ocurre cuando la cortinilla ya cubre.
  useEffect(() => {
    if (!live || !shown || stateKey(live) === stateKey(shown)) return
    const id = setTimeout(() => setShown(live), reduce ? 0 : dur(CURTAIN_COVER_SECONDS) * 1000)
    return () => clearTimeout(id)
  }, [live, shown, reduce])

  return { shown, curtainKey: curtain.key }
}

/** Máximo de vidas visto hasta ahora (sirve para dibujar los corazones vacíos). */
export function useMaxLives(lives: number | undefined): number {
  const [max, setMax] = useState(lives ?? 0)
  if (lives !== undefined && lives > max) setMax(lives)
  return Math.max(max, lives ?? 0)
}
