import { motion } from 'motion/react'
import { glitchIn } from '@/lib/motion'
import { Panel } from '../Panel/Panel'
import { PixelButton } from '../PixelButton/PixelButton'
import styles from './ErrorPanel.module.css'

interface ErrorPanelProps {
  /** Mensaje en español, a partir de error.code (nunca del texto del servidor). */
  message: string
  onBack: () => void
  backLabel?: string
}

/** Pantalla de error a pantalla completa (sala llena, código inválido, partida ya iniciada…). */
export function ErrorPanel({ message, onBack, backLabel = 'VOLVER AL INICIO' }: ErrorPanelProps) {
  return (
    <main className={styles.page}>
      <motion.div className={styles.wrap} {...glitchIn('bottom')}>
        <Panel title="ERROR" tilt={-1}>
          <div className={styles.body}>
            <p className={styles.text} role="alert">
              {message}
            </p>
            <PixelButton color="yellow" onClick={onBack}>
              {backLabel}
            </PixelButton>
          </div>
        </Panel>
      </motion.div>
    </main>
  )
}
