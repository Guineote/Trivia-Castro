import type { TargetAndTransition, Transition } from 'motion/react'
import { useSyncExternalStore } from 'react'

/**
 * Escala de tiempo de las animaciones (1 = normal, 2 = el doble de lenta…).
 * La cambia el DevPanel ("cámara lenta"). Los componentes pasan sus duraciones por `dur()`;
 * el CSS usa la variable --t-scale.
 */
let timeScale = 1
const listeners = new Set<() => void>()

export function getTimeScale(): number {
  return timeScale
}

export function setTimeScale(scale: number): void {
  timeScale = scale
  document.documentElement.style.setProperty('--t-scale', String(scale))
  listeners.forEach((fn) => fn())
}

export function useTimeScale(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getTimeScale,
  )
}

/** Segundos → segundos × escala de cámara lenta. */
export const dur = (seconds: number): number => seconds * timeScale

interface EntranceProps {
  initial: TargetAndTransition
  animate: TargetAndTransition
  transition: Transition
}

/**
 * Entrada "slide + glitch" (design brief): desliza por pasos y tiembla un instante.
 * Nunca un fade genérico. `from` = lado del que llega; `delay` en segundos.
 */
export function glitchIn(from: 'left' | 'right' | 'bottom' | 'top', delay = 0): EntranceProps {
  const sign = from === 'left' || from === 'top' ? -1 : 1
  const path = [sign * 120, sign * 70, sign * 28, sign * -10, sign * 5, 0]
  const skew = [sign * -14, sign * -8, sign * 4, 0, 0, 0]
  const transition: Transition = {
    duration: dur(0.34),
    delay: dur(delay),
    times: [0, 0.3, 0.55, 0.75, 0.9, 1],
    ease: 'linear',
  }
  const opacity = [0, 1, 1, 1, 1, 1]
  if (from === 'left' || from === 'right') {
    return { initial: { opacity: 0 }, animate: { opacity, x: path, skewX: skew }, transition }
  }
  return { initial: { opacity: 0 }, animate: { opacity, y: path }, transition }
}
