import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { dur, glitchIn } from '@/lib/motion'
import styles from './Stage.module.css'

interface StageProps {
  children: ReactNode
  /** Variante espectador: filtro gris parcial + sello "ESPECTADOR". Sigue viendo todo. */
  spectator?: boolean
  className?: string
}

/** Marco de las pantallas de partida: ocupa el viewport, sin scroll en pantallas normales. */
export function Stage({ children, spectator = false, className }: StageProps) {
  return (
    <main className={[styles.stage, spectator ? styles.spectator : '', className ?? ''].filter(Boolean).join(' ')}>
      <div className={styles.content}>{children}</div>
      {spectator ? (
        <motion.div className={styles.stamp} role="status" {...glitchIn('top', 0.1)}>
          ESPECTADOR
        </motion.div>
      ) : null}
    </main>
  )
}

/** Marco rojo en los últimos segundos de la pregunta. */
export function UrgentFrame({ active }: { active: boolean }) {
  return active ? <motion.div className={styles.urgent} aria-hidden="true" animate={{ opacity: [0.9, 0.3, 0.9] }} transition={{ duration: dur(0.8), repeat: Infinity }} /> : null
}
