import { useSyncExternalStore } from 'react'

/**
 * Preferencias de presentación del jugador (sonido y efecto CRT).
 * Persisten en localStorage; todo acceso va en try/catch (puede fallar en modo privado o sin permiso).
 */
export interface Prefs {
  /** Sonido silenciado. Por defecto activo, pero no suena nada antes del primer gesto del usuario. */
  muted: boolean
  /** Efecto CRT (scanlines + viñeta). Opcional: apagado por defecto. */
  crt: boolean
}

const KEY = 'trivia-castro.prefs'

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Prefs>
      return { muted: parsed.muted === true, crt: parsed.crt === true }
    }
  } catch {
    // Sin almacenamiento o contenido corrupto: valores por defecto.
  }
  return { muted: false, crt: false }
}

let prefs: Prefs = read()
const listeners = new Set<() => void>()

export function getPrefs(): Prefs {
  return prefs
}

export function setPrefs(patch: Partial<Prefs>): void {
  prefs = { ...prefs, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // La preferencia vive solo en memoria.
  }
  listeners.forEach((fn) => fn())
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getPrefs,
  )
}

/**
 * Si es true, las herramientas flotantes (sonido/CRT) no se dibujan porque la pantalla
 * activa ya las lleva en su propia barra (p. ej. el HUD de la partida).
 */
let inlineTools = 0
const toolListeners = new Set<() => void>()

export function claimInlineTools(): () => void {
  inlineTools += 1
  toolListeners.forEach((fn) => fn())
  return () => {
    inlineTools -= 1
    toolListeners.forEach((fn) => fn())
  }
}

export function useFloatingTools(): boolean {
  return useSyncExternalStore(
    (listener) => {
      toolListeners.add(listener)
      return () => toolListeners.delete(listener)
    },
    () => inlineTools === 0,
  )
}
