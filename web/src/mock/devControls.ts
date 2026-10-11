import { useSyncExternalStore } from 'react'

/**
 * Controles del modo mock, manejados desde el DevPanel y leídos por el servidor falso.
 * Vive en mock/ (no en dev/) para que el mock no dependa del panel.
 */
export interface DevControls {
  /** Simula la red: 'fail' = sin conexión; 'ok' = normal. */
  network: 'ok' | 'fail'
  /** Latencia artificial por petición (ms). */
  latencyMs: number
  /** Timestamps con segundos enteros (como en los ejemplos del contrato); si no, con milisegundos. */
  timestampsInSeconds: boolean
  /** Los bots entran a la sala de espera poco a poco. */
  botsInRoom: boolean
  /** Si no es null, GET /state devuelve esta fixture del contrato (reubicada a "ahora"). */
  pinnedFixture: string | null
  /** Partida mock sobre la que actúa el DevPanel. */
  activeGameId: string | null
  /** Contador que sube al fijar una fixture para volver a reubicar sus tiempos. */
  pinEpoch: number
}

const INITIAL: DevControls = {
  network: 'ok',
  latencyMs: 0,
  timestampsInSeconds: false,
  botsInRoom: true,
  pinnedFixture: null,
  activeGameId: null,
  pinEpoch: 0,
}

let controls: DevControls = INITIAL
const listeners = new Set<() => void>()

export function getDevControls(): DevControls {
  return controls
}

export function setDevControls(patch: Partial<DevControls>): void {
  controls = { ...controls, ...patch }
  listeners.forEach((fn) => fn())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useDevControls(): DevControls {
  return useSyncExternalStore(subscribe, getDevControls)
}
