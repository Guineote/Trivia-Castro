import { useEffect, useState } from 'react'

/**
 * Reloj del servidor (README §3, D8). El servidor es la autoridad del tiempo:
 * aquí solo estimamos el desfase para dibujar la cuenta regresiva.
 *
 *   offset = serverTime − relojLocal      (en cada respuesta, incluidas las 304)
 *   restante = endsAt − (relojLocal + offset)
 *
 * Cada muestra SUBESTIMA el desfase real (la latencia de red y el truncado a
 * segundos del timestamp hacen que serverTime llegue "viejo"), nunca lo sobreestima.
 * Por eso se usa el máximo de una ventana de muestras recientes: nunca sobreestima y
 * el error baja con el jitter de red. Si los timestamps vienen en segundos enteros el
 * error puede llegar a ~1 s (el contador es solo visual; pedir precisión en ms a la API).
 */
const WINDOW = 15
let samples: number[] = []

/** Acepta ISO 8601 o epoch (segundos o milisegundos). Devuelve ms, o null si no se entiende. */
export function parseServerTime(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return value < 1e11 ? value * 1000 : value
  const text = value.trim()
  if (/^\d+(\.\d+)?$/.test(text)) return parseServerTime(Number(text))
  const ms = Date.parse(text)
  return Number.isNaN(ms) ? null : ms
}

export function syncClock(serverTime: string | number | null | undefined, receivedAt = Date.now()): void {
  const ms = parseServerTime(serverTime)
  if (ms === null) return
  samples.push(ms - receivedAt)
  if (samples.length > WINDOW) samples.shift()
}

export function getOffsetMs(): number {
  return samples.length > 0 ? Math.max(...samples) : 0
}

export function serverNow(): number {
  return Date.now() + getOffsetMs()
}

export function resetClock(): void {
  samples = []
}

/** Milisegundos que faltan para `endsAt` según el reloj del servidor (nunca negativo). */
export function remainingMs(endsAt: string, now: number = serverNow()): number {
  const end = Date.parse(endsAt)
  return Number.isNaN(end) ? 0 : Math.max(0, end - now)
}

/** Cuenta regresiva visual. El servidor decide cuándo cierra la fase; esto solo dibuja. */
export function useCountdown(endsAt: string | null | undefined, tickMs = 100): number | null {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!endsAt) return
    const id = setInterval(() => setTick((n) => n + 1), tickMs)
    return () => clearInterval(id)
  }, [endsAt, tickMs])
  return endsAt ? remainingMs(endsAt) : null
}
