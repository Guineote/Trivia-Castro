import confetti from 'canvas-confetti'
import { motion } from 'motion/react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import type { RankingEntry } from '@/api/types'
import { PixelButton } from '@/components/PixelButton/PixelButton'
import { RollingNumber } from '@/components/RollingNumber/RollingNumber'
import { Stage } from '@/components/Stage/Stage'
import { dur, glitchIn } from '@/lib/motion'
import { play } from '@/lib/sound'
import { GameHud } from '../game/GameHud'
import { RematchControl } from '../game/RematchControl'
import { useRematch } from '../game/useRematch'
import type { GameScreenProps } from '../game/types'
import styles from './Final.module.css'

const CONFETTI_COLORS = ['#ff2e93', '#19e3ff', '#ffd23f', '#3dff8b', '#7a5cff']

/** Segundos en que cae cada bloque del podio: 3º → 2º → 1º. */
const BUILD_DELAY: Record<number, number> = { 3: 0.3, 2: 0.95, 1: 1.6 }
const BLOCK_HEIGHT: Record<number, number> = { 1: 220, 2: 160, 3: 110 }
const BLOCK_COLOR: Record<number, string> = { 1: 'var(--yellow)', 2: 'var(--cyan)', 3: 'var(--magenta)' }

function PodiumBlock({ entry, isMe }: { entry: RankingEntry; isMe: boolean }) {
  const delay = BUILD_DELAY[entry.position]
  return (
    <li className={styles.slot} data-place={entry.position}>
      <motion.div
        className={styles.person}
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: dur(delay + 0.45), duration: dur(0.25) }}
      >
        <span className={[styles.name, entry.position === 1 ? styles.winnerName : ''].join(' ')}>
          {entry.nickname}
        </span>
        {isMe ? <span className={styles.me}>TU</span> : null}
        <span className={styles.score}>
          <RollingNumber value={entry.score} from={0} duration={0.9} delay={delay + 0.45} />
        </span>
      </motion.div>
      <motion.div
        className={styles.block}
        style={{ background: BLOCK_COLOR[entry.position], transformOrigin: 'bottom' }}
        initial={{ height: 0 }}
        animate={{ height: BLOCK_HEIGHT[entry.position] }}
        transition={{ delay: dur(delay), duration: dur(0.45), ease: [0.2, 0.9, 0.3, 1.15] }}
      >
        <span className={styles.place}>{entry.position}</span>
      </motion.div>
    </li>
  )
}

/** 09 · FINAL: podio que se construye por bloques 3º → 2º → 1º, confeti en el ganador. */
export default function Final({ gameId, state, maxLives }: GameScreenProps) {
  const navigate = useNavigate()
  const rematch = useRematch(gameId)
  const { me, winner } = state
  const ranking = state.ranking ?? []
  const podium = ranking.filter((r) => r.position <= 3)
  // Disposición clásica: 2º · 1º · 3º.
  const arranged = [2, 1, 3].map((place) => podium.find((r) => r.position === place)).filter((r): r is RankingEntry => Boolean(r))
  const rest = ranking.filter((r) => r.position > 3)
  const mine = ranking.find((r) => r.participantId === me.participantId)
  const iWon = winner?.participantId === me.participantId

  // Confeti cuando aparece el 1º lugar (se desactiva solo con prefers-reduced-motion).
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const burst = (angle: number, x: number) =>
      confetti({ particleCount: 60, spread: 70, angle, origin: { x, y: 0.75 }, colors: CONFETTI_COLORS, disableForReducedMotion: true })
    const start = dur(BUILD_DELAY[1] + 0.5) * 1000
    timers.push(setTimeout(() => { burst(60, 0.2); burst(120, 0.8); play('fanfare') }, start))
    timers.push(setTimeout(() => { burst(75, 0.35); burst(105, 0.65) }, start + 700))
    timers.push(setTimeout(() => { burst(90, 0.5) }, start + 1400))
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <Stage>
      <GameHud state={state} maxLives={maxLives} />

      <section className={styles.top}>
        <motion.h1 className={styles.headline} {...glitchIn('top', 0.05)}>
          FIN DE LA PARTIDA
        </motion.h1>
        <motion.p
          className={styles.verdict}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: [0.5, 1.2, 1] }}
          transition={{ delay: dur(BUILD_DELAY[1] + 0.9), duration: dur(0.35) }}
          aria-live="polite"
        >
          {iWon ? 'GANASTE!' : mine ? `QUEDASTE EN LUGAR ${mine.position}` : ''}
        </motion.p>
      </section>

      <ol className={styles.podium} aria-label="Podio">
        {arranged.map((entry) => (
          <PodiumBlock key={entry.participantId} entry={entry} isMe={entry.participantId === me.participantId} />
        ))}
      </ol>

      {rest.length > 0 ? (
        <motion.ol className={styles.rest} {...glitchIn('bottom', BUILD_DELAY[1] + 1)} start={4}>
          {rest.map((entry) => (
            <li key={entry.participantId} className={entry.participantId === me.participantId ? styles.mine : ''}>
              <span className={styles.restPos}>{entry.position}</span>
              <span className={styles.restName}>{entry.nickname}</span>
              <span className={styles.restScore}>{entry.score.toLocaleString('es-MX')}</span>
            </li>
          ))}
        </motion.ol>
      ) : null}

      <motion.footer className={styles.actions} {...glitchIn('bottom', BUILD_DELAY[1] + 1.2)}>
        <PixelButton color="cyan" onClick={() => navigate(`/partida/${gameId}/resultados`)}>
          ESTADISTICAS
        </PixelButton>
        <RematchControl rematch={rematch} />
        <PixelButton color="magenta" onClick={() => void rematch.leave()}>
          SALIR
        </PixelButton>
      </motion.footer>
    </Stage>
  )
}
