import { useSyncExternalStore } from 'react'

/**
 * Sesión del jugador: token Bearer + ids. Sin cuentas ni contraseñas (Decisión 02).
 * Vive en localStorage (con try/catch: puede fallar en modo privado) y en memoria.
 * Distingue playerId (quién eres) de participantId (cómo te va en una sala).
 */
export interface Session {
  token: string
  playerId: string
  nickname: string
  participantId?: string
  roomCode?: string
}

interface SessionState {
  session: Session | null
  /** true si la sesión se perdió por un 401 (para avisar en Home). */
  expired: boolean
}

const KEY = 'trivia-castro.session'

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.token === 'string' && typeof v.playerId === 'string' && typeof v.nickname === 'string'
}

function readStored(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isSession(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeStored(session: Session | null): void {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session))
    else localStorage.removeItem(KEY)
  } catch {
    // Sin almacenamiento: la sesión vive solo en memoria.
  }
}

let state: SessionState = { session: readStored(), expired: false }
const listeners = new Set<() => void>()

function setState(next: SessionState): void {
  state = next
  listeners.forEach((fn) => fn())
}

export function getSession(): Session | null {
  return state.session
}

export function getToken(): string | null {
  return state.session?.token ?? null
}

export function saveSession(session: Session): void {
  writeStored(session)
  setState({ session, expired: false })
}

export function updateSession(patch: Partial<Omit<Session, 'token' | 'playerId'>>): void {
  if (!state.session) return
  const session = { ...state.session, ...patch }
  writeStored(session)
  setState({ session, expired: state.expired })
}

export function clearSession(options: { expired?: boolean } = {}): void {
  writeStored(null)
  setState({ session: null, expired: options.expired ?? false })
}

export function dismissExpired(): void {
  if (state.expired) setState({ session: state.session, expired: false })
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): SessionState {
  return state
}

export function useSessionState(): SessionState {
  return useSyncExternalStore(subscribeSession, getSnapshot)
}

export function useSession(): Session | null {
  return useSessionState().session
}
