import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { api } from '@/api/endpoints'
import { ApiError, errorMessage, messageFromError } from '@/api/errors'
import { roomKey, useRoom } from '@/api/hooks'
import { updateSession, useSession } from '@/api/session'
import type { RoomSettings } from '@/api/types'
import { ErrorPanel } from '@/components/ErrorPanel/ErrorPanel'
import { Panel } from '@/components/Panel/Panel'
import { PixelCross } from '@/components/PixelIcon/PixelIcon'
import { PixelButton } from '@/components/PixelButton/PixelButton'
import { PixelSlider } from '@/components/PixelSlider/PixelSlider'
import { ReconnectBanner } from '@/components/ReconnectBanner/ReconnectBanner'
import { RoomCode } from '@/components/RoomCode/RoomCode'
import { dur, glitchIn } from '@/lib/motion'
import { SETTINGS_RANGES } from '@/lib/settingsRanges'
import styles from './Lobby.module.css'

/** D4: mínimo para iniciar. */
const MIN_PLAYERS = 2
/** Pausa del "¡A JUGAR!" antes de entrar a la partida (s). La partida ya corre en el servidor. */
const START_OVERLAY_SECONDS = 0.7
const SETTINGS_DEBOUNCE_MS = 400

type EditableSetting = 'maxPlayers' | 'rounds' | 'lives'

/** 04 · Lobby: código, participantes, ajustes y botón INICIAR. Polling de GET /rooms/{code} hasta currentGameId. */
export default function Lobby() {
  const { code: rawCode = '' } = useParams()
  const code = rawCode.toUpperCase()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const session = useSession()
  const roomQuery = useRoom(code)
  const room = roomQuery.data

  const me = room?.participants.find((p) => p.participantId === session?.participantId)
  const isHost = Boolean(me?.isHost)

  const [message, setMessage] = useState<string | null>(null)
  const [startedGameId, setStartedGameId] = useState<string | null>(null)
  // Cambios del host aún no confirmados por el servidor (se mandan con un pequeño debounce).
  const [draft, setDraft] = useState<Partial<Pick<RoomSettings, EditableSetting>>>({})
  const pendingPatch = useRef<Partial<Pick<RoomSettings, EditableSetting>>>({})
  const patchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const gameId = room?.currentGameId ?? startedGameId
  const starting = Boolean(gameId && me)

  // Al verse currentGameId (D1) todos pasan a /games/{id}/state.
  useEffect(() => {
    if (!gameId || !me) return
    const id = setTimeout(() => navigate(`/partida/${gameId}`, { replace: true }), dur(START_OVERLAY_SECONDS) * 1000)
    return () => clearTimeout(id)
  }, [gameId, me, navigate])

  const start = useMutation({
    mutationFn: () => api.startGame(code),
    onMutate: () => setMessage(null),
    onSuccess: (started) => setStartedGameId(started.gameId),
    onError: (err) => setMessage(messageFromError(err)),
  })

  const leave = useMutation({
    mutationFn: (participantId: string) => api.leaveRoom(code, participantId),
    onError: (err) => setMessage(messageFromError(err)),
  })

  const join = useMutation({
    mutationFn: () => api.joinRoom(code),
    onSuccess: (joined) => {
      updateSession({ participantId: joined.participantId, roomCode: code })
      void qc.invalidateQueries({ queryKey: roomKey(code) })
    },
    onError: (err) => setMessage(messageFromError(err)),
  })

  const patch = useMutation({
    mutationFn: (settings: Partial<RoomSettings>) => api.updateRoom(code, settings),
    onError: (err) => setMessage(messageFromError(err)),
    onSettled: async (_data, _err, sent) => {
      await qc.invalidateQueries({ queryKey: roomKey(code) })
      // Se descartan del borrador solo los valores ya enviados (el host pudo seguir moviendo el slider).
      setDraft((d) => Object.fromEntries(Object.entries(d).filter(([k, v]) => sent[k as EditableSetting] !== v)))
    },
  })

  function change(key: EditableSetting, value: number) {
    setDraft((d) => ({ ...d, [key]: value }))
    pendingPatch.current = { ...pendingPatch.current, [key]: value }
    if (patchTimer.current) clearTimeout(patchTimer.current)
    patchTimer.current = setTimeout(() => {
      const toSend = pendingPatch.current
      pendingPatch.current = {}
      patch.mutate(toSend)
    }, SETTINGS_DEBOUNCE_MS)
  }

  async function leaveRoom() {
    if (!me) return navigate('/')
    try {
      await leave.mutateAsync(me.participantId)
    } catch {
      // Si la sala ya no existe, igual se sale.
    }
    updateSession({ participantId: undefined, roomCode: undefined })
    navigate('/')
  }

  // ── Estados especiales
  const error = roomQuery.error
  if (!room && error instanceof ApiError && error.code !== 'NETWORK_ERROR') {
    return <ErrorPanel message={errorMessage(error.code)} onBack={() => navigate('/')} />
  }
  if (!room) {
    return (
      <main className={styles.center}>
        <p className={styles.loading}>CARGANDO SALA...</p>
        <ReconnectBanner />
      </main>
    )
  }
  if (!me) {
    return (
      <main className={styles.center}>
        <Panel title="SALA" tilt={-1}>
          <div className={styles.notIn}>
            <p className={styles.notInText}>No estás en esta sala.</p>
            <p className={styles.error} role="alert">
              {message ?? ''}
            </p>
            <PixelButton color="cyan" disabled={join.isPending} onClick={() => join.mutate()}>
              UNIRME
            </PixelButton>
            <PixelButton color="ghost" onClick={() => navigate('/')}>
              VOLVER
            </PixelButton>
          </div>
        </Panel>
      </main>
    )
  }

  const settings = { ...room.settings, ...draft }
  const enough = room.participants.length >= MIN_PLAYERS
  const categoriesLabel = room.settings.categoryIds.length === 0 ? 'TODAS' : `${room.settings.categoryIds.length} ELEGIDAS`

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <motion.section className={styles.left} {...glitchIn('left')}>
          <Panel title="SALA DE ESPERA">
            <div className={styles.leftBody}>
              <RoomCode code={room.code} />

              <div className={styles.playersHead}>
                <h2 className={styles.heading}>JUGADORES</h2>
                <span className={styles.count}>
                  {room.participants.length}/{settings.maxPlayers}
                </span>
              </div>
              <ul className={styles.players} aria-live="polite">
                <AnimatePresence initial={false}>
                  {room.participants.map((p) => (
                    <motion.li
                      key={p.participantId}
                      layout="position"
                      className={[styles.player, p.participantId === me.participantId ? styles.mine : ''].filter(Boolean).join(' ')}
                      // "Pop" con sacudida cuando entra alguien.
                      initial={{ scale: 0, rotate: -6 }}
                      animate={{ scale: [0, 1.25, 1], rotate: [-6, 3, 0] }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: dur(0.3) }}
                    >
                      <span className={styles.name}>{p.nickname}</span>
                      {p.isHost ? <span className={styles.hostTag}>HOST</span> : null}
                      {p.participantId === me.participantId ? <span className={styles.youTag}>TU</span> : null}
                      {isHost && p.participantId !== me.participantId ? (
                        <button
                          type="button"
                          className={styles.kick}
                          aria-label={`Expulsar a ${p.nickname}`}
                          disabled={leave.isPending}
                          onClick={() => leave.mutate(p.participantId)}
                        >
                          <PixelCross pixel={2} color="var(--ink)" />
                        </button>
                      ) : null}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          </Panel>
        </motion.section>

        <motion.section className={styles.right} {...glitchIn('right', 0.1)}>
          <Panel title="AJUSTES" tone="dark">
            {isHost ? (
              <div className={styles.settings}>
                <PixelSlider
                  label="JUGADORES MAXIMO"
                  value={settings.maxPlayers}
                  min={Math.max(SETTINGS_RANGES.maxPlayers.min, room.participants.length)}
                  max={SETTINGS_RANGES.maxPlayers.max}
                  onChange={(v) => change('maxPlayers', v)}
                />
                <PixelSlider label="RONDAS" value={settings.rounds} {...SETTINGS_RANGES.rounds} onChange={(v) => change('rounds', v)} />
                <PixelSlider label="VIDAS" value={settings.lives} {...SETTINGS_RANGES.lives} onChange={(v) => change('lives', v)} />
                <p className={styles.row}>
                  <span>CATEGORIAS</span>
                  <strong>{categoriesLabel}</strong>
                </p>
              </div>
            ) : (
              <dl className={styles.readonly}>
                <dt>JUGADORES MAXIMO</dt>
                <dd>{settings.maxPlayers}</dd>
                <dt>RONDAS</dt>
                <dd>{settings.rounds}</dd>
                <dt>VIDAS</dt>
                <dd>{settings.lives}</dd>
                <dt>CATEGORIAS</dt>
                <dd>{categoriesLabel}</dd>
              </dl>
            )}
          </Panel>

          <p className={styles.error} role="alert">
            {message ?? ''}
          </p>

          <div className={styles.actions}>
            {isHost ? (
              <>
                <PixelButton size="lg" color="green" block disabled={!enough || start.isPending || starting} onClick={() => start.mutate()}>
                  {start.isPending ? '...' : 'INICIAR'}
                </PixelButton>
                {!enough ? <p className={styles.hint}>NECESITAS AL MENOS {MIN_PLAYERS} JUGADORES</p> : null}
              </>
            ) : (
              <p className={styles.waiting}>ESPERANDO AL HOST...</p>
            )}
            <PixelButton color="ghost" block disabled={leave.isPending} onClick={() => void leaveRoom()}>
              SALIR
            </PixelButton>
          </div>
        </motion.section>
      </div>

      <AnimatePresence>
        {starting ? (
          <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="status">
            <motion.p
              className={styles.go}
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: [0, 1.3, 1], rotate: -3 }}
              transition={{ duration: dur(0.35) }}
            >
              A JUGAR!
            </motion.p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ReconnectBanner />
    </main>
  )
}
