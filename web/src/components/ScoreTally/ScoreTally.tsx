import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { LastResult } from '@/api/types'
import { dur } from '@/lib/motion'
import { play } from '@/lib/sound'
import { RollingNumber } from '../RollingNumber/RollingNumber'
import styles from './ScoreTally.module.css'

interface Row {
  op: '+' | '×' | '='
  label: string
  value: number
  highlight?: boolean
}

/** Filas del desglose: base + velocidad, × ronda, × poder (solo los que valen más de 1). */
function buildRows(result: LastResult): Row[] {
  const rows: Row[] = [
    { op: '+', label: 'BASE', value: result.basePoints },
    { op: '+', label: 'VELOCIDAD', value: result.speedBonus },
  ]
  if (result.roundMultiplier > 1) rows.push({ op: '×', label: 'RONDA', value: result.roundMultiplier })
  if (result.powerMultiplier > 1) rows.push({ op: '×', label: 'PODER', value: result.powerMultiplier })
  return rows
}

const STEP_SECONDS = 0.32

interface ScoreTallyProps {
  result: LastResult
  /** Puntaje antes de la ronda: me.score − lastResult.pointsAwarded. */
  previousScore: number
  /** Retraso antes de empezar (s). */
  delay?: number
}

/** Desglose de puntos tipo arcade: cada paso aparece con su "ding" visual, y el total rueda. */
export function ScoreTally({ result, previousScore, delay = 0 }: ScoreTallyProps) {
  const rows = result.isCorrect ? buildRows(result) : []
  const [step, setStep] = useState(0)
  const totalSteps = rows.length + 2 // filas + total de la ronda + puntaje acumulado

  // Cada paso del desglose tiene su "ding".
  useEffect(() => {
    if (step > 0) play('ding')
  }, [step])

  useEffect(() => {
    if (step >= totalSteps) return
    const id = setTimeout(() => setStep((n) => n + 1), dur(step === 0 ? delay + STEP_SECONDS : STEP_SECONDS) * 1000)
    return () => clearTimeout(id)
  }, [step, totalSteps, delay])

  return (
    <div className={styles.tally} aria-live="polite">
      {result.isCorrect ? (
        rows.map((row, i) => (
          <motion.div
            key={row.label}
            className={styles.row}
            initial={{ opacity: 0, x: -24 }}
            animate={step > i ? { opacity: 1, x: 0 } : { opacity: 0, x: -24 }}
            transition={{ duration: dur(0.14) }}
          >
            <span className={styles.op}>{row.op}</span>
            <span className={styles.label}>{row.label}</span>
            <span className={styles.value}>{row.op === '×' ? row.value : row.value.toLocaleString('es-MX')}</span>
          </motion.div>
        ))
      ) : (
        <motion.p
          className={styles.miss}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={step > 0 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
          transition={{ duration: dur(0.18) }}
        >
          0 PUNTOS
        </motion.p>
      )}

      {result.isCorrect ? (
      <motion.div
        className={[styles.row, styles.total].join(' ')}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={step > rows.length ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
        transition={{ duration: dur(0.16) }}
      >
        <span className={styles.op}>=</span>
        <span className={styles.label}>RONDA</span>
        <span className={styles.value}>
          +{step > rows.length ? <RollingNumber value={result.pointsAwarded} from={0} duration={0.6} /> : 0}
        </span>
      </motion.div>
      ) : null}

      <motion.div
        className={[styles.row, styles.score].join(' ')}
        initial={{ opacity: 0 }}
        animate={step > rows.length + 1 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: dur(0.14) }}
      >
        <span className={styles.label}>TOTAL</span>
        <span className={styles.value}>
          {step > rows.length + 1 ? (
            <RollingNumber value={previousScore + result.pointsAwarded} from={previousScore} duration={0.6} />
          ) : (
            previousScore.toLocaleString('es-MX')
          )}
        </span>
      </motion.div>
    </div>
  )
}
