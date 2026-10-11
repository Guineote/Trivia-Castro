import { beforeEach, describe, expect, it } from 'vitest'
import { api } from '@/api/endpoints'
import { ApiError } from '@/api/errors'
import { request, setTransport } from '@/api/http'
import { clearSession, getSession, saveSession } from '@/api/session'
import { resetStats } from '@/api/stats'
import { getOffsetMs, resetClock } from '@/lib/clock'
import { setDevControls } from '@/mock/devControls'
import { createMockTransport } from '@/mock/server'
import { createSimulator } from '@/mock/simulator'

// El cliente HTTP real contra el servidor falso: ETag/304, X-Server-Time y errores por código.
let offset = 0
const fmt = (ms: number) => new Date(Math.floor(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z')

beforeEach(() => {
  clearSession()
  resetClock()
  resetStats()
  setDevControls({ network: 'ok', latencyMs: 0, pinnedFixture: null })
  const sim = createSimulator({ now: () => Date.now() + offset, random: Math.random, botsInRoom: () => false })
  setTransport(createMockTransport(sim, { formatTime: fmt, persist: () => {}, now: () => Date.now() + offset }))
})

async function startGame() {
  const ana = await api.createPlayer('Ana')
  saveSession({ token: ana.token, playerId: ana.playerId, nickname: 'Ana' })
  const room = await api.createRoom({ rounds: 3 })
  const beto = await api.createPlayer('Beto')
  saveSession({ token: beto.token, playerId: beto.playerId, nickname: 'Beto' })
  await api.joinRoom(room.code)
  saveSession({ token: ana.token, playerId: ana.playerId, nickname: 'Ana' })
  const { gameId } = await api.startGame(room.code)
  return gameId
}

describe('cliente HTTP', () => {
  it('state: 200 con ETag y luego 304 sin cuerpo al reenviar If-None-Match', async () => {
    const gameId = await startGame()
    const first = await api.getGameState(gameId, null)
    expect(first.status).toBe(200)
    expect(first.etag).toMatch(new RegExp(`^"${gameId}-v\\d+"$`))
    expect(first.data?.phase).toBe('ROUND_INTRO')

    const second = await api.getGameState(gameId, first.etag)
    expect(second.status).toBe(304)
    expect(second.data).toBeNull()
    expect(second.etag).toBe(first.etag)
  })

  it('lee X-Server-Time también en las respuestas 304', async () => {
    offset = 5000 // el reloj "del servidor" va 5 s adelantado respecto al local
    const gameId = await startGame()
    resetClock()
    const first = await api.getGameState(gameId, null)
    resetClock()
    await api.getGameState(gameId, first.etag) // 304
    expect(getOffsetMs()).toBeGreaterThan(3500)
    expect(getOffsetMs()).toBeLessThanOrEqual(5000)
    offset = 0
  })

  it('los errores llegan como ApiError con code (no se decide por el texto)', async () => {
    const ana = await api.createPlayer('Ana')
    saveSession({ token: ana.token, playerId: ana.playerId, nickname: 'Ana' })
    await expect(api.getRoom('ZZZZZZ')).rejects.toMatchObject({ status: 404, code: 'ROOM_NOT_FOUND' })
    await expect(api.createPlayer('x')).rejects.toMatchObject({ status: 422, code: 'VALIDATION_ERROR' })
    await expect(api.getGameState('nope', null)).rejects.toBeInstanceOf(ApiError)
  })

  it('401: limpia la sesión y marca que expiró', async () => {
    saveSession({ token: 'token-invalido', playerId: 'p0', nickname: 'Fantasma' })
    await expect(api.createRoom()).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
    expect(getSession()).toBeNull()
  })

  it('sin red: NETWORK_ERROR', async () => {
    setDevControls({ network: 'fail' })
    await expect(request('GET', '/rooms/ABC123')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
  })

  it('unirse devuelve el mismo participantId al reconectar', async () => {
    const ana = await api.createPlayer('Ana')
    saveSession({ token: ana.token, playerId: ana.playerId, nickname: 'Ana' })
    const room = await api.createRoom()
    const joined = await api.joinRoom(room.code)
    expect(joined.participantId).toBe(room.participantId)
  })
})
