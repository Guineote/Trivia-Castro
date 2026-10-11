import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './endpoints'
import { getToken } from './session'
import { getConsecutiveFailures } from './stats'
import type { GameState, Room } from './types'

const POLL_MS = 1000
/** Con fallos seguidos, el polling se espacia suavemente (1 s → 5 s máx.). */
const MAX_BACKOFF_MS = 5000

function pollInterval(): number {
  return Math.min(POLL_MS * (1 + getConsecutiveFailures()), MAX_BACKOFF_MS)
}

// ETag por (partida, token): la respuesta va personalizada (Vary: Authorization).
const etags = new Map<string, string>()
const etagKey = (gameId: string) => `${gameId}|${getToken() ?? ''}`

export const gameStateKey = (gameId: string | undefined) => ['gameState', gameId] as const
export const roomKey = (code: string | undefined) => ['room', code] as const

/**
 * Polling de GET /games/{id}/state cada ~1 s con If-None-Match.
 * Un 304 devuelve EXACTAMENTE el estado anterior (misma referencia): no hay redibujado.
 * El cliente nunca avanza la fase; solo lee lo que dice el servidor.
 * Para el banner RECONECTANDO… usar `useReconnecting()` (api/stats.ts).
 */
export function useGameState(gameId: string | undefined) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: gameStateKey(gameId),
    enabled: Boolean(gameId),
    retry: false,
    refetchInterval: pollInterval,
    queryFn: async ({ signal }): Promise<GameState> => {
      const id = gameId as string
      const previous = queryClient.getQueryData<GameState>(gameStateKey(id))
      const key = etagKey(id)
      // Sin estado previo no se manda ETag: un 304 no tendría qué conservar.
      const res = await api.getGameState(id, previous ? (etags.get(key) ?? null) : null, signal)
      if (res.status === 304 && previous) return previous
      if (res.etag) etags.set(key, res.etag)
      else etags.delete(key)
      return res.data as GameState
    },
  })
}

/** Polling de GET /rooms/{code} (sala de espera) hasta que `currentGameId` deje de ser null. */
export function useRoom(code: string | undefined) {
  return useQuery({
    queryKey: roomKey(code),
    enabled: Boolean(code),
    retry: false,
    refetchInterval: pollInterval,
    queryFn: ({ signal }): Promise<Room> => api.getRoom(code as string, signal),
  })
}
