import { API_BASE, type Transport } from '@/api/http'
import type { GameState } from '@/api/types'
import { getDevControls, setDevControls } from './devControls'
import { rebaseFixture, STATE_FIXTURES } from './fixtures'
import { SimError, type Simulator } from './simulator'

/**
 * "Servidor falso" a nivel de transporte: recibe lo mismo que fetch y devuelve una
 * Response real (headers ETag / X-Server-Time / Vary, 304 sin cuerpo, errores
 * { error: { code, message } }). Así el cliente HTTP real se ejercita igual en mock.
 */

interface Reply {
  status: number
  body?: unknown
  headers?: Record<string, string>
}

const json = (status: number, body: unknown, headers?: Record<string, string>): Reply => ({ status, body, headers })

function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const id = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

// Fixture fijada desde el DevPanel, reubicada a "ahora" una sola vez por pinEpoch.
let pinned: { epoch: number; name: string; state: GameState } | null = null

function pinnedState(formatTime: (ms: number) => string, now: number): GameState | null {
  const { pinnedFixture, pinEpoch } = getDevControls()
  if (!pinnedFixture || !(pinnedFixture in STATE_FIXTURES)) return null
  if (!pinned || pinned.epoch !== pinEpoch || pinned.name !== pinnedFixture) {
    pinned = { epoch: pinEpoch, name: pinnedFixture, state: rebaseFixture(STATE_FIXTURES[pinnedFixture], now, formatTime) }
  }
  return { ...pinned.state, serverTime: formatTime(now) }
}

export function createMockTransport(
  sim: Simulator,
  options: { formatTime: (ms: number) => string; persist: () => void; now?: () => number },
): Transport {
  const { formatTime, persist } = options
  const now = options.now ?? Date.now

  function handle(method: string, path: string, headers: Headers, body: unknown): Reply {
    const seg = path.split('/').filter(Boolean)
    const token = /^Bearer (.+)$/.exec(headers.get('Authorization') ?? '')?.[1] ?? null
    const bodyObj = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>

    // Públicos: POST /players y GET /rooms/{code}
    if (method === 'POST' && seg.length === 1 && seg[0] === 'players') {
      return json(201, sim.createPlayer(bodyObj.nickname))
    }
    if (method === 'GET' && seg.length === 2 && seg[0] === 'rooms') {
      return json(200, sim.getRoom(seg[1]))
    }

    const player = sim.authenticate(token)

    if (seg[0] === 'categories' && method === 'GET') return json(200, sim.categories())

    if (seg[0] === 'rooms') {
      if (seg.length === 1 && method === 'POST') return json(201, sim.createRoom(player, bodyObj.settings))
      const code = seg[1]
      if (seg.length === 2 && method === 'PATCH') return json(200, sim.updateRoom(player, code, bodyObj.settings))
      if (seg[2] === 'players' && seg.length === 3 && method === 'POST') {
        const joined = sim.joinRoom(player, code, bodyObj.nickname)
        return json(joined.created ? 201 : 200, joined.body)
      }
      if (seg[2] === 'players' && seg.length === 4 && method === 'DELETE') {
        sim.leaveRoom(player, code, seg[3])
        return { status: 204 }
      }
      if (seg[2] === 'games' && seg.length === 3 && method === 'POST') {
        const started = sim.startGame(player, code)
        setDevControls({ activeGameId: started.gameId })
        return json(201, started)
      }
    }

    if (seg[0] === 'games' && seg.length >= 3) {
      const gameId = seg[1]
      if (seg[2] === 'state' && method === 'GET') {
        const fixture = pinnedState(formatTime, now())
        const { state, version } = fixture ? { state: fixture, version: fixture.version } : sim.getState(player, gameId)
        const etag = `"${gameId}-${fixture ? `pin${getDevControls().pinEpoch}-` : ''}v${version}"`
        const common = { ETag: etag, Vary: 'Authorization' }
        if (headers.get('If-None-Match') === etag) return { status: 304, headers: common }
        return json(200, state, common)
      }
      if (seg[2] === 'rounds' && seg.length === 5) {
        const round = Number(seg[3])
        if (seg[4] === 'answers' && method === 'POST') {
          return json(202, sim.answer(player, gameId, round, bodyObj.optionId))
        }
        if (seg[4] === 'powers' && method === 'POST') {
          return json(200, sim.usePower(player, gameId, round, bodyObj.powerType))
        }
        if (seg[4] === 'results' && method === 'GET') return json(200, sim.roundResults(player, gameId, round))
      }
      if (seg[2] === 'ranking' && method === 'GET') return json(200, sim.ranking(player, gameId))
      if (seg[2] === 'results' && method === 'GET') return json(200, sim.results(player, gameId))
      if (seg[2] === 'advance' && method === 'POST') return json(200, sim.advance(player, gameId))
    }

    return json(404, { error: { code: 'NOT_FOUND', message: 'Ruta no implementada en el mock' } })
  }

  return async (input, init) => {
    const controls = getDevControls()
    if (controls.latencyMs > 0) await sleep(controls.latencyMs, init.signal)
    if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (controls.network === 'fail') throw new TypeError('Failed to fetch')

    const url = new URL(input, 'http://mock.local')
    const path = url.pathname.startsWith(API_BASE) ? url.pathname.slice(API_BASE.length) : url.pathname
    const method = (init.method ?? 'GET').toUpperCase()
    const headers = new Headers(init.headers)

    let reply: Reply
    try {
      let body: unknown
      try {
        body = typeof init.body === 'string' && init.body ? JSON.parse(init.body) : undefined
      } catch {
        throw new SimError(422, 'VALIDATION_ERROR')
      }
      reply = handle(method, path, headers, body)
    } catch (err) {
      if (!(err instanceof SimError)) throw err
      reply = json(err.status, { error: { code: err.code, message: err.code } })
    }
    persist()

    const responseHeaders = new Headers(reply.headers)
    responseHeaders.set('X-Server-Time', formatTime(now()))
    const hasBody = reply.body !== undefined && reply.status !== 204 && reply.status !== 304
    if (hasBody) responseHeaders.set('Content-Type', 'application/json')
    return new Response(hasBody ? JSON.stringify(reply.body) : null, {
      status: reply.status,
      headers: responseHeaders,
    })
  }
}
