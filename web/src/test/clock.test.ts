import { beforeEach, describe, expect, it } from 'vitest'
import { getOffsetMs, parseServerTime, remainingMs, resetClock, syncClock } from '@/lib/clock'

describe('reloj del servidor', () => {
  beforeEach(resetClock)

  it('entiende ISO 8601 y epoch', () => {
    expect(parseServerTime('2026-09-04T18:30:06Z')).toBe(Date.UTC(2026, 8, 4, 18, 30, 6))
    expect(parseServerTime('1788546606')).toBe(1788546606000)
    expect(parseServerTime(1788546606000)).toBe(1788546606000)
    expect(parseServerTime('no es fecha')).toBeNull()
    expect(parseServerTime(null)).toBeNull()
  })

  it('offset = serverTime − relojLocal', () => {
    const local = Date.UTC(2026, 0, 1, 12, 0, 0)
    syncClock(new Date(local + 3000).toISOString(), local) // servidor 3 s adelantado
    expect(getOffsetMs()).toBe(3000)
  })

  it('con timestamps truncados a segundos el error queda acotado a menos de 1 s', () => {
    const trueOffset = 2400 // el servidor va 2.4 s adelantado
    let maxError = 0
    for (let i = 0; i < 15; i++) {
      const local = Date.UTC(2026, 0, 1, 12, 0, 0) + i * 1013 + 137 // ~1 s entre polls, con jitter
      const serverMs = local + trueOffset
      const truncated = Math.floor(serverMs / 1000) * 1000 // el servidor manda segundos enteros
      syncClock(new Date(truncated).toISOString(), local)
      maxError = Math.max(maxError, Math.abs(getOffsetMs() - trueOffset))
    }
    // Con segundos enteros no se puede saber más: de ahí que se pida precisión en ms (PENDIENTES).
    expect(maxError).toBeLessThan(1000)
  })

  it('nunca sobreestima el desfase real', () => {
    const trueOffset = -1500
    for (let i = 0; i < 40; i++) {
      const local = 1_800_000_000_000 + i * 997
      const latency = (i * 37) % 120
      const serverStamp = Math.floor((local - latency + trueOffset) / 1000) * 1000
      syncClock(serverStamp, local)
      expect(getOffsetMs()).toBeLessThanOrEqual(trueOffset)
    }
  })

  it('remainingMs usa el reloj del servidor y no baja de 0', () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 10)
    expect(remainingMs('2026-01-01T12:00:30Z', now)).toBe(20000)
    expect(remainingMs('2026-01-01T12:00:05Z', now)).toBe(0)
    expect(remainingMs('basura', now)).toBe(0)
  })
})
