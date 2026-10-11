import { setTransport } from '@/api/http'
import { clearSession, getSession } from '@/api/session'
import { getDevControls, setDevControls } from './devControls'
import { setSimulator } from './runtime'
import { createMockTransport } from './server'
import { createSimulator, emptyWorld, type World } from './simulator'

const STORAGE_KEY = 'trivia-castro.mock-world'
/** Sube si cambia la forma de World: un mundo guardado con otro esquema se descarta. */
const SCHEMA = 1

function loadWorld(): World {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { schema?: number; world?: World }
      if (parsed.schema === SCHEMA && parsed.world && Array.isArray(parsed.world.rooms)) return parsed.world
    }
  } catch {
    // Almacenamiento no disponible o corrupto: se empieza de cero.
  }
  return emptyWorld()
}

function formatTime(ms: number): string {
  if (!getDevControls().timestampsInSeconds) return new Date(ms).toISOString()
  // Como en los ejemplos del contrato: segundos enteros.
  return new Date(Math.floor(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z')
}

/** Cambia el transporte HTTP por el servidor falso. Solo se llama con VITE_USE_MOCK=true. */
export function installMock(): void {
  const sim = createSimulator(
    { now: Date.now, random: Math.random, formatTime, botsInRoom: () => getDevControls().botsInRoom },
    loadWorld(),
  )
  setSimulator(sim)
  // Tras recargar, el DevPanel sigue actuando sobre la última partida del mundo guardado.
  if (sim.world.lastGameId) setDevControls({ activeGameId: sim.world.lastGameId })

  // Una sesión guardada cuyo token el mundo mock ya no conoce (p. ej. se borró) no sirve.
  const session = getSession()
  if (session && !sim.world.players.some((p) => p.token === session.token)) clearSession()

  const persist = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ schema: SCHEMA, world: sim.world }))
    } catch {
      // Sin almacenamiento: el mundo vive solo en memoria.
    }
  }
  setTransport(createMockTransport(sim, { formatTime, persist }))
}

/** Borra el mundo mock guardado (DevPanel → "Reiniciar mundo"). */
export function resetMockWorld(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // nada
  }
}
