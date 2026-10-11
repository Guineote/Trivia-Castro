import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { api } from '@/api/endpoints'
import { useGameState } from '@/api/hooks'
import { clearSession, getSession, saveSession, updateSession, useSession } from '@/api/session'
import { resetStats, useHttpStats, useReconnecting } from '@/api/stats'
import { PHASES, ROUND_TYPES } from '@/api/types'
import { PixelButton } from '@/components/PixelButton/PixelButton'
import { getOffsetMs, useCountdown } from '@/lib/clock'
import { setTimeScale, useTimeScale } from '@/lib/motion'
import { setDevControls, useDevControls } from '@/mock/devControls'
import { STATE_FIXTURES } from '@/mock/fixtures'
import { resetMockWorld } from '@/mock/install'
import { getSimulator } from '@/mock/runtime'
import styles from './DevPanel.module.css'

const OPEN_KEY = 'trivia-castro.devpanel-open'

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{title}</h2>
      {children}
    </section>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>
}

/** Panel de desarrollo (solo en `npm run dev`). Atajo: tecla ` (acento grave). */
export default function DevPanel() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const controls = useDevControls()
  const session = useSession()
  const stats = useHttpStats()
  const reconnecting = useReconnecting()
  const timeScale = useTimeScale()
  const sim = getSimulator()

  const [open, setOpen] = useState(readOpen)
  const [rounds, setRounds] = useState(5)
  const [message, setMessage] = useState<string | null>(null)

  const gameId = controls.activeGameId ?? (controls.pinnedFixture ? 'fixture' : null)
  const { data: state } = useGameState(gameId ?? undefined)
  const remaining = useCountdown(state?.round?.endsAt, 100)

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, open ? '1' : '0')
    } catch {
      // nada
    }
  }, [open])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.key !== '`' || target?.closest('input, textarea, select, [contenteditable]')) return
      setOpen((value) => !value)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const refresh = () => void qc.invalidateQueries({ queryKey: ['gameState'] })

  async function run(action: () => void | Promise<void>) {
    setMessage(null)
    try {
      await action()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error')
    }
  }

  async function quickStart() {
    if (!sim) return
    let current = getSession()
    if (!current) {
      const player = await api.createPlayer('Jugador')
      saveSession({ token: player.token, playerId: player.playerId, nickname: player.nickname })
      current = getSession()
    }
    if (!current) return
    const started = sim.dev.quickStart(sim.authenticate(current.token), rounds)
    updateSession({ participantId: started.participantId, roomCode: started.code })
    setDevControls({ activeGameId: started.gameId, pinnedFixture: null })
    qc.removeQueries({ queryKey: ['gameState'] })
    setMessage(`Sala ${started.code} · partida ${started.gameId}`)
    navigate(`/partida/${started.gameId}`)
  }

  const isSpectator = state?.me.status === 'SPECTATOR'

  if (!open) {
    return (
      <button type="button" className={styles.fab} onClick={() => setOpen(true)} aria-label="Abrir panel de desarrollo">
        DEV
      </button>
    )
  }

  return (
    <aside className={styles.panel} aria-label="Panel de desarrollo">
      <header className={styles.header}>
        <strong>DEV · {sim ? 'MOCK' : 'API REAL'}</strong>
        <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Cerrar panel">
          X
        </button>
      </header>

      <Section title="MONITOR">
        <dl className={styles.monitor}>
          <dt>partida</dt>
          <dd>{gameId ?? '—'}</dd>
          <dt>fase</dt>
          <dd>{state ? `${state.phase}${state.round ? ` · ronda ${state.round.number}/${state.round.totalRounds} ${state.round.type}` : ''}` : '—'}</dd>
          <dt>versión</dt>
          <dd>{state?.version ?? '—'}</dd>
          <dt>quedan</dt>
          <dd>{remaining === null ? '—' : `${(remaining / 1000).toFixed(1)} s`}</dd>
          <dt>offset</dt>
          <dd>{getOffsetMs()} ms</dd>
          <dt>HTTP</dt>
          <dd>
            200: {stats.ok} · 304: {stats.notModified} · err: {stats.errors}{' '}
            <button type="button" className={styles.link} onClick={resetStats}>
              reset
            </button>
          </dd>
          <dt>conexión</dt>
          <dd className={reconnecting ? styles.bad : styles.good}>
            {reconnecting ? `RECONECTANDO (${stats.consecutiveFailures} fallos)` : 'ok'}
          </dd>
          <dt>yo</dt>
          <dd>{state ? `${state.me.score} pts · ${state.me.lives} vidas · ${state.me.status}` : (session?.nickname ?? '—')}</dd>
        </dl>
      </Section>

      {sim ? (
        <>
          <Section title="PARTIDA MOCK">
            <Row>
              <label>
                rondas{' '}
                <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))}>
                  {[1, 3, 5, 10].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <PixelButton size="sm" color="green" onClick={() => void run(quickStart)}>
                INICIAR
              </PixelButton>
            </Row>
            <p className={styles.hint}>Crea sala con 3 bots y arranca la partida (tú eres el host).</p>
          </Section>

          {controls.activeGameId ? (
            <Section title="FASE">
              <Row>
                {PHASES.map((phase) => (
                  <PixelButton
                    key={phase}
                    size="sm"
                    color={state?.phase === phase ? 'cyan' : 'ghost'}
                    onClick={() => void run(() => { sim.dev.goToPhase(controls.activeGameId as string, phase); refresh() })}
                  >
                    {phase.replace('ROUND_', '')}
                  </PixelButton>
                ))}
              </Row>
              <p className={styles.hint}>Avanza fase a fase (con cierre de ronda y puntos) hasta llegar a la elegida.</p>
              <Row>
                <PixelButton
                  size="sm"
                  color={isSpectator ? 'red' : 'ghost'}
                  onClick={() => void run(() => { if (session) sim.dev.setSpectator(controls.activeGameId as string, session.playerId, !isSpectator); refresh() })}
                >
                  {isSpectator ? 'ESPECTADOR' : 'JUGADOR'}
                </PixelButton>
                {ROUND_TYPES.map((type) => (
                  <PixelButton
                    key={type}
                    size="sm"
                    color={state?.round?.type === type ? 'yellow' : 'ghost'}
                    onClick={() => void run(() => { sim.dev.setRoundType(controls.activeGameId as string, type); refresh() })}
                  >
                    {type}
                  </PixelButton>
                ))}
                <PixelButton
                  size="sm"
                  onClick={() => void run(() => { if (session) sim.dev.restorePowers(controls.activeGameId as string, session.playerId); refresh() })}
                >
                  PODERES
                </PixelButton>
              </Row>
            </Section>
          ) : null}

          <Section title="RED">
            <Row>
              <PixelButton size="sm" color={controls.network === 'ok' ? 'green' : 'ghost'} onClick={() => setDevControls({ network: 'ok' })}>
                RED OK
              </PixelButton>
              <PixelButton size="sm" color={controls.network === 'fail' ? 'red' : 'ghost'} onClick={() => setDevControls({ network: 'fail' })}>
                CAIDA
              </PixelButton>
              <label>
                latencia{' '}
                <select value={controls.latencyMs} onChange={(e) => setDevControls({ latencyMs: Number(e.target.value) })}>
                  {[0, 300, 1000, 3000].map((ms) => (
                    <option key={ms} value={ms}>
                      {ms} ms
                    </option>
                  ))}
                </select>
              </label>
            </Row>
            <label className={styles.check}>
              <input type="checkbox" checked={controls.timestampsInSeconds} onChange={(e) => setDevControls({ timestampsInSeconds: e.target.checked })} />
              timestamps en segundos enteros (como el contrato)
            </label>
            <label className={styles.check}>
              <input type="checkbox" checked={controls.botsInRoom} onChange={(e) => setDevControls({ botsInRoom: e.target.checked })} />
              bots entran a la sala de espera
            </label>
          </Section>

          <Section title="FIXTURE ESTÁTICA">
            <Row>
              <select
                value={controls.pinnedFixture ?? ''}
                onChange={(e) => {
                  setDevControls({ pinnedFixture: e.target.value || null, pinEpoch: controls.pinEpoch + 1 })
                  if (e.target.value) navigate('/partida/fixture')
                }}
              >
                <option value="">— partida real del mock —</option>
                {Object.keys(STATE_FIXTURES).map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              <PixelButton size="sm" onClick={() => setDevControls({ pinEpoch: controls.pinEpoch + 1 })} disabled={!controls.pinnedFixture}>
                REUBICAR
              </PixelButton>
            </Row>
            <p className={styles.hint}>Congela GET /state con el JSON de docs/contrato/ejemplos (tiempos reubicados a ahora).</p>
          </Section>
        </>
      ) : null}

      <Section title="ANIMACIONES">
        <Row>
          {[1, 2, 4].map((scale) => (
            <PixelButton key={scale} size="sm" color={timeScale === scale ? 'cyan' : 'ghost'} onClick={() => setTimeScale(scale)}>
              {scale === 1 ? 'NORMAL' : `LENTA ×${scale}`}
            </PixelButton>
          ))}
        </Row>
      </Section>

      {sim ? (
        <Section title="MUNDO">
          <Row>
            <PixelButton
              size="sm"
              color="red"
              onClick={() => {
                resetMockWorld()
                clearSession()
                location.assign('/')
              }}
            >
              REINICIAR MUNDO MOCK
            </PixelButton>
          </Row>
        </Section>
      ) : null}

      {message ? <p className={styles.message}>{message}</p> : null}
    </aside>
  )
}
