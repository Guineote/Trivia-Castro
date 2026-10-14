import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useState, type CSSProperties } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { api } from '@/api/endpoints'
import { ApiError } from '@/api/errors'
import { useSession } from '@/api/session'
import type { FinalRankingEntry, GameResults, PlayerStats } from '@/api/types'
import { ErrorPanel } from '@/components/ErrorPanel/ErrorPanel'
import { PixelButton } from '@/components/PixelButton/PixelButton'
import { RollingNumber } from '@/components/RollingNumber/RollingNumber'
import { ReconnectBanner } from '@/components/ReconnectBanner/ReconnectBanner'
import { accuracy, formatPoints, formatSeconds } from '@/lib/format'
import { dur, glitchIn } from '@/lib/motion'
import { RematchControl } from '../game/RematchControl'
import { useRematch } from '../game/useRematch'
import styles from './Results.module.css'

type View = 'cards' | 'table'

const PLACE_COLOR: Record<number, string> = { 1: 'var(--yellow)', 2: 'var(--cyan)', 3: 'var(--magenta)' }
const BLOCKS = 10

interface Row {
  entry: FinalRankingEntry
  stats: PlayerStats | undefined
}

function rowsOf(results: GameResults): Row[] {
  return results.ranking.map((entry) => ({
    entry,
    stats: results.stats.find((s) => s.participantId === entry.participantId),
  }))
}

/** Barra de precisión por bloques que se llena al entrar. */
function AccuracyBar({ correct, total, delay }: { correct: number; total: number; delay: number }) {
  const percent = accuracy(correct, total)
  const filled = Math.round((percent / 100) * BLOCKS)
  return (
    <div className={styles.accuracy}>
      <div
        className={styles.blocks}
        role="img"
        aria-label={`Precisión: ${correct} de ${total}, ${percent} por ciento`}
      >
        {Array.from({ length: BLOCKS }, (_, i) => (
          <motion.span
            key={i}
            className={styles.block}
            initial={{ opacity: 0.25 }}
            animate={{ opacity: i < filled ? 1 : 0.25 }}
            transition={{ delay: dur(delay + i * 0.05), duration: dur(0.1) }}
            style={{ background: i < filled ? 'var(--green)' : 'var(--bg-3)' }}
          />
        ))}
      </div>
      <span className={styles.accuracyText}>
        {correct}/{total} · {percent}%
      </span>
    </div>
  )
}

/** 10 · Tarjetas de jugador estilo cartas coleccionables arcade. */
function Cards({ rows, meId }: { rows: Row[]; meId?: string }) {
  return (
    <ul className={styles.cards}>
      {rows.map(({ entry, stats }, i) => {
        const color = PLACE_COLOR[entry.position] ?? 'var(--violet)'
        return (
          // El motion (entrada + inclinación) va en el <li>; el aspecto, en el div interior.
          <motion.li key={entry.participantId} style={{ rotate: i % 2 === 0 ? -1 : 1 }} {...glitchIn('bottom', 0.12 * i)}>
            <div
              className={[styles.card, entry.participantId === meId ? styles.mine : ''].filter(Boolean).join(' ')}
              style={{ '--card': color } as CSSProperties}
            >
            <div className={styles.holo} aria-hidden="true" />
            <header className={styles.cardHead}>
              <span className={styles.place}>#{entry.position}</span>
              {entry.position === 1 ? <span className={styles.crown}>CAMPEON</span> : null}
              {entry.participantId === meId ? <span className={styles.you}>TU</span> : null}
            </header>
            <h2 className={styles.cardName}>{entry.nickname}</h2>
            <p className={styles.cardScore}>
              <RollingNumber value={entry.score} from={0} duration={0.9} delay={0.12 * i + 0.2} />
              <span className={styles.pts}>PTS</span>
            </p>
            {stats ? (
              <>
                <AccuracyBar correct={stats.correctAnswers} total={stats.totalAnswers} delay={0.12 * i + 0.4} />
                <dl className={styles.facts}>
                  <dt>TIEMPO MEDIO</dt>
                  <dd>{formatSeconds(stats.averageAnswerTimeMs)}</dd>
                  <dt>MAS RAPIDA</dt>
                  <dd>{formatSeconds(stats.fastestAnswerMs)}</dd>
                  <dt>MEJOR RONDA</dt>
                  <dd>
                    {stats.bestRound.points > 0 ? `R${stats.bestRound.number} · ${formatPoints(stats.bestRound.points)}` : '—'}
                  </dd>
                </dl>
              </>
            ) : (
              <p className={styles.noStats}>Sin estadísticas</p>
            )}
            </div>
          </motion.li>
        )
      })}
    </ul>
  )
}

/** 15 · Tabla completa pensada para proyector: tipografía grande, todo el detalle en una vista. */
function Table({ rows, meId }: { rows: Row[]; meId?: string }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">Resultados finales por jugador</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">JUGADOR</th>
            <th scope="col">PUNTOS</th>
            <th scope="col">ACIERTOS</th>
            <th scope="col">PRECISION</th>
            <th scope="col">T. MEDIO</th>
            <th scope="col">MAS RAPIDA</th>
            <th scope="col">MEJOR RONDA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ entry, stats }) => (
            <tr key={entry.participantId} className={entry.participantId === meId ? styles.mineRow : ''}>
              <th scope="row" className={styles.rank} style={{ color: PLACE_COLOR[entry.position] ?? 'var(--violet)' }}>
                {entry.position}
              </th>
              <td className={styles.nameCell}>{entry.nickname}</td>
              <td className={styles.num}>{formatPoints(entry.score)}</td>
              <td className={styles.num}>{stats ? `${stats.correctAnswers}/${stats.totalAnswers}` : '—'}</td>
              <td className={styles.num}>{stats ? `${accuracy(stats.correctAnswers, stats.totalAnswers)}%` : '—'}</td>
              <td className={styles.num}>{stats ? formatSeconds(stats.averageAnswerTimeMs) : '—'}</td>
              <td className={styles.num}>{stats ? formatSeconds(stats.fastestAnswerMs) : '—'}</td>
              <td className={styles.num}>
                {stats && stats.bestRound.points > 0 ? `R${stats.bestRound.number} · ${formatPoints(stats.bestRound.points)}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Resultados finales: GET /games/{id}/results. Vista de tarjetas (10) o tabla (15). */
export default function Results() {
  const { gameId = '' } = useParams()
  const navigate = useNavigate()
  const session = useSession()
  const [view, setView] = useState<View>('cards')
  const rematch = useRematch(gameId)

  const query = useQuery({
    queryKey: ['results', gameId],
    queryFn: () => api.getResults(gameId),
    enabled: Boolean(session),
    retry: false,
    staleTime: Infinity,
  })

  if (!session) return <Navigate to="/" replace />

  const error = query.error
  if (error instanceof ApiError && error.code !== 'NETWORK_ERROR') {
    // Aún no termina: de vuelta a la partida en curso.
    return error.code === 'GAME_NOT_FINISHED' ? (
      <ErrorPanel code={error.code} backLabel="VOLVER A LA PARTIDA" onBack={() => navigate(`/partida/${gameId}`)} />
    ) : (
      <ErrorPanel code={error.code} onBack={() => navigate('/')} />
    )
  }
  const results = query.data
  if (!results) {
    return (
      <main className={styles.center}>
        <p className={styles.loading}>CARGANDO RESULTADOS...</p>
        <ReconnectBanner />
      </main>
    )
  }

  const rows = rowsOf(results)
  const meId = session.participantId

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <motion.h1 className={styles.title} {...glitchIn('top')}>
          RESULTADOS
        </motion.h1>
        <p className={styles.meta}>
          SALA {results.roomCode} · {results.totalRounds} {results.totalRounds === 1 ? 'RONDA' : 'RONDAS'} · GANADOR: <strong>{results.winner.nickname}</strong>
        </p>
        <div className={styles.tabs} role="tablist" aria-label="Vista de resultados">
          <button type="button" role="tab" aria-selected={view === 'cards'} className={styles.tab} onClick={() => setView('cards')}>
            TARJETAS
          </button>
          <button type="button" role="tab" aria-selected={view === 'table'} className={styles.tab} onClick={() => setView('table')}>
            TABLA
          </button>
        </div>
      </header>

      <section role="tabpanel" className={styles.panel}>
        {view === 'cards' ? <Cards rows={rows} meId={meId} /> : <Table rows={rows} meId={meId} />}
      </section>

      <footer className={styles.actions}>
        <PixelButton color="ghost" onClick={() => navigate(`/partida/${gameId}`)}>
          VOLVER AL PODIO
        </PixelButton>
        <RematchControl rematch={rematch} />
        <PixelButton color="magenta" onClick={() => void rematch.leave()}>
          SALIR
        </PixelButton>
      </footer>
      <ReconnectBanner />
    </main>
  )
}
