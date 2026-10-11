import { useSyncExternalStore } from 'react'

/**
 * Estado de la conexión y contadores de red.
 * `consecutiveFailures` cuenta fallos de conectividad seguidos (sin red o 5xx):
 * react-query reinicia su propio contador en cada intento, así que se lleva aquí.
 */
export interface HttpStats {
  ok: number
  notModified: number
  errors: number
  lastStatus: number | null
  consecutiveFailures: number
}

const INITIAL: HttpStats = { ok: 0, notModified: 0, errors: 0, lastStatus: null, consecutiveFailures: 0 }

let stats: HttpStats = INITIAL
const listeners = new Set<() => void>()

function publish(next: HttpStats): void {
  stats = next
  listeners.forEach((fn) => fn())
}

/** status 0 = sin respuesta (red caída). Los 4xx son respuestas válidas del servidor: hay conexión. */
export function recordResponse(status: number): void {
  const connectivityFailure = status === 0 || status >= 500
  publish({
    ok: stats.ok + (status >= 200 && status < 300 ? 1 : 0),
    notModified: stats.notModified + (status === 304 ? 1 : 0),
    errors: stats.errors + (status === 0 || status >= 400 ? 1 : 0),
    lastStatus: status,
    consecutiveFailures: connectivityFailure ? stats.consecutiveFailures + 1 : 0,
  })
}

export function resetStats(): void {
  publish(INITIAL)
}

export function getConsecutiveFailures(): number {
  return stats.consecutiveFailures
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useHttpStats(): HttpStats {
  return useSyncExternalStore(subscribe, () => stats)
}

/** Fallos seguidos a partir de los cuales se muestra RECONECTANDO… */
export const RECONNECT_AFTER_FAILURES = 2

export function useReconnecting(): boolean {
  return useHttpStats().consecutiveFailures >= RECONNECT_AFTER_FAILURES
}
