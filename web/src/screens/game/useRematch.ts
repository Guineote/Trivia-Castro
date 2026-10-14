import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '@/api/endpoints'
import { messageFromError } from '@/api/errors'
import { useRoom } from '@/api/hooks'
import { updateSession, useSession } from '@/api/session'
import type { Room } from '@/api/types'
import { dur } from '@/lib/motion'
import { play } from '@/lib/sound'

/** Pausa del "¡REVANCHA!" antes de entrar a la nueva partida (s). La partida ya corre en el servidor. */
export const REMATCH_OVERLAY_SECONDS = 0.7

/**
 * Id de la partida de revancha: la sala (que se consulta cada segundo) trae un `currentGameId`
 * distinto del de la partida que se está viendo. Si no, null.
 */
export function rematchGameId(room: Pick<Room, 'currentGameId'> | undefined, viewingGameId: string): string | null {
  return room?.currentGameId && room.currentGameId !== viewingGameId ? room.currentGameId : null
}

/**
 * Revancha (D13): el host inicia otra partida en la misma sala con `POST /rooms/{code}/games`
 * (la sala está FINISHED); los demás, que ya consultan `GET /rooms/{code}`, ven el nuevo
 * `currentGameId` y entran solos. La sala se conoce por `session.roomCode`.
 */
export function useRematch(viewingGameId: string) {
  const navigate = useNavigate()
  const session = useSession()
  const code = session?.roomCode
  const room = useRoom(code).data
  const me = room?.participants.find((p) => p.participantId === session?.participantId)

  const [startedGameId, setStartedGameId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const nextGameId = rematchGameId(room, viewingGameId) ?? startedGameId

  const start = useMutation({
    mutationFn: () => api.startGame(code as string),
    onMutate: () => setMessage(null),
    onSuccess: (started) => setStartedGameId(started.gameId),
    onError: (err) => setMessage(messageFromError(err)),
  })

  useEffect(() => {
    if (!nextGameId) return
    play('go')
    const id = setTimeout(() => navigate(`/partida/${nextGameId}`, { replace: true }), dur(REMATCH_OVERLAY_SECONDS) * 1000)
    return () => clearTimeout(id)
  }, [nextGameId, navigate])

  /** Salir de la sala (DELETE) y volver a Home. Si la sala ya no existe, igual se sale. */
  async function leave() {
    if (code && me) {
      try {
        await api.leaveRoom(code, me.participantId)
      } catch {
        // nada: se sale de todos modos
      }
    }
    updateSession({ participantId: undefined, roomCode: undefined })
    navigate('/')
  }

  return {
    /** Hay sala conocida y el jugador sigue en ella: se puede mostrar la revancha. */
    available: Boolean(code && me),
    isHost: Boolean(me?.isHost),
    start: () => start.mutate(),
    pending: start.isPending,
    /** La revancha ya empezó: se muestra el aviso y se entra a la nueva partida. */
    starting: nextGameId !== null,
    message,
    leave,
  }
}

export type Rematch = ReturnType<typeof useRematch>
