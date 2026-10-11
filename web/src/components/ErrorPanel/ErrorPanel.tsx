import { motion } from 'motion/react'
import { errorMessage } from '@/api/errors'
import { DEFAULT_ERROR_SCREEN, ERROR_SCREENS } from '@/lib/errorScreens'
import { dur, glitchIn } from '@/lib/motion'
import { Panel } from '../Panel/Panel'
import { PixelButton } from '../PixelButton/PixelButton'
import { PixelGhost } from '../PixelIcon/PixelIcon'
import styles from './ErrorPanel.module.css'

interface ErrorPanelProps {
  /** error.code: decide título, mensaje y pista (nunca el texto del servidor). */
  code?: string
  /** Mensaje propio; por defecto sale de `code`. */
  message?: string
  onBack: () => void
  backLabel?: string
  /** Segunda acción (p. ej. REINTENTAR con otro código). */
  onRetry?: () => void
  retryLabel?: string
}

/** Pantalla de error con personaje pixel (sala llena, código inválido, partida ya iniciada…). */
export function ErrorPanel({
  code,
  message,
  onBack,
  backLabel = 'VOLVER AL INICIO',
  onRetry,
  retryLabel = 'REINTENTAR',
}: ErrorPanelProps) {
  const screen = (code && ERROR_SCREENS[code]) || DEFAULT_ERROR_SCREEN
  return (
    <main className={styles.page}>
      <motion.div className={styles.wrap} {...glitchIn('bottom')}>
        <Panel title="ERROR" tilt={-1}>
          <div className={styles.body}>
            <motion.div
              className={styles.ghost}
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: dur(1.6), repeat: Infinity, ease: 'easeInOut' }}
            >
              <PixelGhost pixel={7} />
            </motion.div>
            <h1 className={styles.title}>{screen.title}</h1>
            <p className={styles.text} role="alert">
              {message ?? (code ? errorMessage(code) : screen.hint)}
            </p>
            {message || code ? <p className={styles.hint}>{screen.hint}</p> : null}
            <div className={styles.actions}>
              {onRetry ? (
                <PixelButton color="cyan" onClick={onRetry}>
                  {retryLabel}
                </PixelButton>
              ) : null}
              <PixelButton color="yellow" onClick={onBack}>
                {backLabel}
              </PixelButton>
            </div>
          </div>
        </Panel>
      </motion.div>
    </main>
  )
}
