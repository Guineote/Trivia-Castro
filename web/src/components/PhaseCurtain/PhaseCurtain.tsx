import { motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { play } from '@/lib/sound'
import { dur } from '@/lib/motion'
import styles from './PhaseCurtain.module.css'

const BARS = 9
const COLORS = ['var(--magenta)', 'var(--violet)', 'var(--cyan)']

/** Duración total de la cortinilla (s). El cambio de pantalla ocurre a mitad: CURTAIN_COVER_SECONDS. */
export const CURTAIN_SECONDS = 0.5
export const CURTAIN_COVER_SECONDS = 0.22

/**
 * Cortinilla pixelada de cambio de fase: barras que barren la pantalla de izquierda a derecha.
 * `runKey` distinto de 0 la dispara (cada cambio reinicia la animación). Nunca bloquea al servidor:
 * si llega otra fase a mitad de camino, simplemente se reinicia.
 */
export function PhaseCurtain({ runKey }: { runKey: number }) {
  const reduce = useReducedMotion()
  useEffect(() => {
    if (runKey > 0) play('swoosh')
  }, [runKey])
  if (runKey === 0 || reduce) return null
  return (
    <div className={styles.curtain} aria-hidden="true">
      {Array.from({ length: BARS }, (_, i) => (
        <motion.span
          key={`${runKey}-${i}`}
          className={styles.bar}
          style={{ background: COLORS[i % COLORS.length] }}
          initial={{ x: '-102%' }}
          animate={{ x: ['-102%', '0%', '0%', '102%'] }}
          transition={{
            duration: dur(CURTAIN_SECONDS),
            delay: dur(i * 0.012),
            times: [0, 0.42, 0.55, 1],
            ease: 'linear',
          }}
        />
      ))}
    </div>
  )
}
