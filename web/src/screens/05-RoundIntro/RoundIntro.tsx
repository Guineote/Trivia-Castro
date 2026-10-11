import { motion } from 'motion/react'
import { useEffect } from 'react'
import { PowerSlot } from '@/components/PowerSlot/PowerSlot'
import { Stage } from '@/components/Stage/Stage'
import { Timer } from '@/components/Timer/Timer'
import { dur, glitchIn } from '@/lib/motion'
import { PHASE_DURATION_MS } from '@/lib/phases'
import { play } from '@/lib/sound'
import { GameHud } from '../game/GameHud'
import { powerStates } from '../game/powers'
import type { GameScreenProps } from '../game/types'
import styles from './RoundIntro.module.css'

/** 05 · ROUND_INTRO (3 s): anuncia la ronda. Si es DOUBLE, banner x2 con destello y sacudida. */
export default function RoundIntro({ state, maxLives }: GameScreenProps) {
  const { round, me } = state
  const isDouble = round?.type === 'DOUBLE'

  // El x2 suena justo cuando entra el banner.
  useEffect(() => {
    if (!isDouble) return
    const id = setTimeout(() => play('double'), dur(0.85) * 1000)
    return () => clearTimeout(id)
  }, [isDouble])

  if (!round) return null

  return (
    <Stage spectator={me.status === 'SPECTATOR'}>
      <GameHud state={state} maxLives={maxLives} />

      {/* Sacudida de toda la escena cuando entra el x2. */}
      <motion.section
        className={styles.center}
        animate={isDouble ? { x: [0, -14, 12, -9, 7, -3, 0] } : undefined}
        transition={{ duration: dur(0.4), delay: dur(0.85) }}
      >
        <motion.p className={styles.kicker} {...glitchIn('left', 0.05)}>
          PREPARATE
        </motion.p>

        <div className={styles.numberRow}>
          <h1 className={styles.title} aria-label={`Ronda ${round.number} de ${round.totalRounds}`}>
            <span className={styles.word} aria-hidden="true">
              RONDA
            </span>
            <motion.span
              className={styles.number}
              aria-hidden="true"
              initial={{ y: -700, rotate: -12, opacity: 0 }}
              animate={{ y: [-700, 0, -70, 0, -22, 0], rotate: 0, opacity: 1 }}
              transition={{
                duration: dur(0.9),
                times: [0, 0.5, 0.68, 0.84, 0.93, 1],
                ease: 'linear',
                opacity: { duration: dur(0.05) },
                rotate: { duration: dur(0.5) },
              }}
            >
              {round.number}
            </motion.span>
          </h1>
          <motion.span className={styles.total} {...glitchIn('right', 0.55)}>
            / {round.totalRounds}
          </motion.span>
        </div>

        {isDouble ? (
          <>
            <motion.div
              className={styles.banner}
              initial={{ scale: 0, rotate: -12 }}
              animate={{ scale: [0, 1.35, 1], rotate: -3 }}
              transition={{ duration: dur(0.35), delay: dur(0.85), ease: 'easeOut' }}
            >
              <span className={styles.x2}>x2</span>
              <span className={styles.bannerText}>PUNTOS DOBLES</span>
            </motion.div>
            {/* Destello blanco de un frame. */}
            <motion.div
              className={styles.flash}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.85, 0] }}
              transition={{ duration: dur(0.28), delay: dur(0.85), times: [0, 0.2, 1] }}
            />
          </>
        ) : null}
      </motion.section>

      <motion.footer className={styles.footer} {...glitchIn('bottom', 0.9)}>
        {me.status === 'ACTIVE' ? (
          <ul className={styles.powers} aria-label="Tus poderes">
            {powerStates(me).map(({ type, state: powerState }) => (
              <li key={type}>
                <PowerSlot type={type} state={powerState} locked />
              </li>
            ))}
          </ul>
        ) : null}
        <Timer endsAt={round.endsAt} durationMs={PHASE_DURATION_MS.ROUND_INTRO} segments={12} />
      </motion.footer>
    </Stage>
  )
}
