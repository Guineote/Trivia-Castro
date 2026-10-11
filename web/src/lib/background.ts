import { useSyncExternalStore } from 'react'

/**
 * Intensidad del fondo animado, controlada por la pantalla activa:
 * 'low' en las de lectura (pregunta), 'high' en el resto.
 */
export type BackgroundLevel = 'high' | 'low'

let level: BackgroundLevel = 'high'
const listeners = new Set<() => void>()

export function setBackground(next: BackgroundLevel): void {
  if (next === level) return
  level = next
  listeners.forEach((fn) => fn())
}

export function useBackground(): BackgroundLevel {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => level,
  )
}
