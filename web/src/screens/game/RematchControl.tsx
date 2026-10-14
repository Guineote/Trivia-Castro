import { AnimatePresence, motion } from 'motion/react'
import { PixelButton } from '@/components/PixelButton/PixelButton'
import { dur } from '@/lib/motion'
import type { Rematch } from './useRematch'
import styles from './RematchControl.module.css'

/**
 * JUGAR OTRA VEZ: el host inicia la revancha; los demás esperan (y entran solos cuando empieza).
 * Sin sala conocida (no hay `roomCode` en la sesión) no se muestra nada.
 */
export function RematchControl({ rematch }: { rematch: Rematch }) {
  if (!rematch.available) return null
  return (
    <>
      {rematch.isHost ? (
        <PixelButton color="green" disabled={rematch.pending || rematch.starting} onClick={rematch.start}>
          {rematch.pending ? '...' : 'JUGAR OTRA VEZ'}
        </PixelButton>
      ) : (
        <p className={styles.waiting} role="status">
          ESPERANDO AL HOST...
        </p>
      )}
      {rematch.message ? (
        <p className={styles.error} role="alert">
          {rematch.message}
        </p>
      ) : null}

      <AnimatePresence>
        {rematch.starting ? (
          <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="status">
            <motion.p
              className={styles.go}
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: [0, 1.3, 1], rotate: -3 }}
              transition={{ duration: dur(0.35) }}
            >
              REVANCHA!
            </motion.p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
