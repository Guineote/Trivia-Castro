import { syncClock } from '@/lib/clock'
import { ApiError } from './errors'
import { clearSession, getToken } from './session'
import { recordResponse } from './stats'

export const API_BASE = '/api/v1'

/** Transporte intercambiable: fetch real, o el servidor falso del modo mock. */
export type Transport = (input: string, init: RequestInit) => Promise<Response>

let transport: Transport = (input, init) => fetch(input, init)

export function setTransport(next: Transport): void {
  transport = next
}

export interface HttpResult<T> {
  /** 200/201/202/204 → datos; 304 → data null (conservar el estado anterior). */
  status: number
  data: T | null
  etag: string | null
}

export interface RequestOptions {
  body?: unknown
  /** Último ETag conocido → If-None-Match. */
  etag?: string | null
  signal?: AbortSignal
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/** Extrae `{ error: { code, message } }` si el cuerpo tiene ese formato. */
function readErrorBody(body: unknown): { code: string; message?: string } | null {
  if (typeof body !== 'object' || body === null || !('error' in body)) return null
  const error = (body as { error: unknown }).error
  if (typeof error !== 'object' || error === null) return null
  const { code, message } = error as { code?: unknown; message?: unknown }
  if (typeof code !== 'string') return null
  return { code, message: typeof message === 'string' ? message : undefined }
}

/**
 * Cliente HTTP del contrato.
 * - Adjunta `Authorization: Bearer` si hay sesión.
 * - Manda `If-None-Match` y devuelve status 304 sin cuerpo (no es un error).
 * - Lee `X-Server-Time` en TODAS las respuestas (incluidas las 304) para el reloj.
 * - Los errores se lanzan como ApiError con `code`; se decide por `code`, nunca por el texto.
 */
export async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<HttpResult<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.etag) headers['If-None-Match'] = options.etag

  let res: Response
  try {
    res = await transport(`${API_BASE}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      // El ETag lo gestionamos nosotros; que el navegador no reutilice su caché HTTP.
      cache: 'no-store',
    })
  } catch (err) {
    if (isAbort(err)) throw err
    recordResponse(0)
    throw new ApiError(0, 'NETWORK_ERROR')
  }

  recordResponse(res.status)
  const headerTime = res.headers.get('X-Server-Time')
  if (headerTime) syncClock(headerTime)

  if (res.status === 304) {
    return { status: 304, data: null, etag: res.headers.get('ETag') ?? options.etag ?? null }
  }

  let body: unknown = null
  try {
    const text = await res.text()
    body = text ? JSON.parse(text) : null
  } catch {
    if (res.ok) throw new ApiError(res.status, 'INVALID_RESPONSE')
  }

  if (!res.ok) {
    const parsed = readErrorBody(body)
    if (res.status === 401 && token) clearSession({ expired: true })
    throw new ApiError(res.status, parsed?.code ?? (res.status === 401 ? 'UNAUTHORIZED' : 'UNKNOWN'), parsed?.message)
  }

  // Sin header X-Server-Time (API aún no lo manda): usa el serverTime del cuerpo.
  if (!headerTime && typeof body === 'object' && body !== null && 'serverTime' in body) {
    syncClock((body as { serverTime: string }).serverTime)
  }

  return { status: res.status, data: body as T | null, etag: res.headers.get('ETag') }
}
