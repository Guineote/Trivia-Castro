import { motion } from 'motion/react'
import type { GameState } from '@/api/types'
import { LifeHearts } from '@/components/LifeHearts/LifeHearts'
import { RollingNumber } from '@/components/RollingNumber/RollingNumber'
import { dur } from '@/lib/motion'
import styles from './GameHud.module.css'

interface GameHudProps {
  state: GameState
  maxLives: number
  /** Puntaje con el que arranca el contador (REVEAL: el de antes de la ronda). */
  scoreFrom?: number
  /** Vidas antes de la ronda (REVEAL): el corazón perdido se rompe al montar. */
  livesFrom?: number
}

/** Barra superior: ronda actual (con sello ×2), puntaje y vidas. */
export function GameHud({ state, maxLives, scoreFrom, livesFrom }: GameHudProps) {
  const { round, me } = state
  return (
    <header className={styles.hud}>
      <div className={styles.round}>
        {round ? (
          <>
            <span className={styles.roundLabel}>
              RONDA {round.number}/{round.totalRounds}
            </span>
            {round.type === 'DOUBLE' ? (
              <motion.span
                className={styles.double}
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: -4 }}
                transition={{ duration: dur(0.25), ease: [0.2, 0.9, 0.3, 1.5] }}
              >
                x2
              </motion.span>
            ) : null}
          </>
        ) : (
          <span className={styles.roundLabel}>FIN</span>
        )}
      </div>
      <div className={styles.stats}>
        <span className={styles.score}>
          <RollingNumber value={me.score} from={scoreFrom} duration={0.8} />
          <span className={styles.pts}>PTS</span>
        </span>
        <LifeHearts lives={me.lives} max={maxLives} from={livesFrom} pixel={4} />
      </div>
    </header>
  )
}
