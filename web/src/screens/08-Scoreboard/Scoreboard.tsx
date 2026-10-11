import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { LifeHearts } from '@/components/LifeHearts/LifeHearts'
import { PixelSprite } from '@/components/PixelIcon/PixelIcon'
import { RollingNumber } from '@/components/RollingNumber/RollingNumber'
import { Stage } from '@/components/Stage/Stage'
import { Timer } from '@/components/Timer/Timer'
import { dur, glitchIn } from '@/lib/motion'
import { PHASE_DURATION_MS } from '@/lib/phases'
import { GameHud } from '../game/GameHud'
import type { GameScreenProps } from '../game/types'
import styles from './Scoreboard.module.css'

/** Segundos que las filas se ven en el orden anterior antes de reordenarse. */
const HOLD_SECONDS = 0.8

const ARROW_UP = ['..X..', '.XXX.', 'XXXXX', 'XXXXX']
const ARROW_DOWN = ['XXXXX', 'XXXXX', '.XXX.', '..X..']

function Delta({ value }: { value: number }) {
  if (value === 0) return <span className={styles.same}>=</span>
  const up = value > 0
  return (
    <span className={up ? styles.up : styles.down} aria-label={up ? `subió ${value}` : `bajó ${-value}`}>
      <PixelSprite
        rows={up ? ARROW_UP : ARROW_DOWN}
        pixel={3}
        palette={{ X: up ? 'var(--green)' : 'var(--red)' }}
      />
      {Math.abs(value)}
    </span>
  )
}

/** 08 · SCOREBOARD (6 s): ranking que se reordena con animación de posición; flechas según positionDelta. */
export default function Scoreboard({ state, maxLives }: GameScreenProps) {
  const { round, me, players } = state
  const [reordered, setReordered] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setReordered(true), dur(HOLD_SECONDS) * 1000)
    return () => clearTimeout(id)
  }, [])

  // positionDelta = posiciónAnterior − posiciónActual  →  posiciónAnterior = posición + delta.
  const rankingState = state.ranking
  const rows = useMemo(() => {
    const sorted = [...(rankingState ?? [])]
    sorted.sort((a, b) => (reordered ? a.position - b.position : a.position + a.positionDelta - (b.position + b.positionDelta)))
    return sorted
  }, [rankingState, reordered])

  if (!round) return null
  const remainingRounds = round.totalRounds - round.number
  const gained = me.lastResult?.pointsAwarded ?? 0

  return (
    <Stage spectator={me.status === 'SPECTATOR'}>
      <GameHud state={state} maxLives={maxLives} />
      <Timer endsAt={round.endsAt} durationMs={PHASE_DURATION_MS.SCOREBOARD} segments={12} />

      <motion.section className={styles.board} {...glitchIn('bottom', 0.05)}>
        <header className={styles.header}>
          <h1 className={styles.title}>MARCADOR</h1>
          <p className={styles.remaining}>
            {remainingRounds === 0 ? 'ULTIMA RONDA JUGADA' : `QUEDAN ${remainingRounds} ${remainingRounds === 1 ? 'RONDA' : 'RONDAS'}`}
          </p>
        </header>

        <ol className={styles.list}>
          {rows.map((entry) => {
            const player = players.find((p) => p.participantId === entry.participantId)
            const isMe = entry.participantId === me.participantId
            const spectator = player?.status === 'SPECTATOR'
            return (
              <motion.li
                key={entry.participantId}
                layout="position"
                transition={{ type: 'spring', stiffness: 260, damping: 26, duration: dur(0.5) }}
                className={[
                  styles.row,
                  isMe ? styles.me : '',
                  spectator ? styles.spectator : '',
                  reordered && entry.positionDelta > 0 ? styles.rose : '',
                  reordered && entry.positionDelta < 0 ? styles.fell : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className={styles.position}>{entry.position}</span>
                <span className={styles.name}>{entry.nickname}</span>
                {player ? (
                  spectator ? (
                    <span className={styles.badge}>ESPECTADOR</span>
                  ) : (
                    <LifeHearts lives={player.lives} pixel={2} />
                  )
                ) : null}
                <Delta value={entry.positionDelta} />
                <span className={styles.score}>
                  <RollingNumber value={entry.score} from={isMe ? entry.score - gained : entry.score} duration={0.8} />
                </span>
              </motion.li>
            )
          })}
        </ol>
      </motion.section>
    </Stage>
  )
}
