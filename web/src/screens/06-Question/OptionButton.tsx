import { motion } from 'motion/react'
import { glitchIn } from '@/lib/motion'
import { OptionSymbol, PixelCheck, PixelCross } from '@/components/PixelIcon/PixelIcon'
import type { OptionSlot } from '@/components/PixelIcon/options'
import styles from './OptionButton.module.css'

export type OptionStatus =
  | 'idle' // se puede elegir
  | 'chosen' // la elegí (enviada): se ve presionada
  | 'dimmed' // otra opción ya fue elegida
  | 'removed' // eliminada por HINT: tachada
  | 'neutral' // REVEAL, primer paso: todas sin color
  | 'neutralChosen' // REVEAL, primer paso: la que elegí, sin decir si acertó
  | 'correct' // REVEAL: la correcta, en verde
  | 'wrong' // REVEAL: la que elegí y era incorrecta

interface OptionButtonProps {
  slot: OptionSlot
  text: string
  status: OptionStatus
  index: number
  onSelect?: () => void
  /** Variante baja para el REVEAL (menos alto). */
  compact?: boolean
  /** Atajo de teclado mostrado (1–4). */
  hint?: string
  /** Entrada escalonada. En REVEAL las opciones ya estaban en pantalla: sin entrada. */
  entrance?: boolean
}

/** Botón de respuesta: color fijo + símbolo (▲ ● ■ ◆) + texto. Nunca depende solo del color. */
export function OptionButton({ slot, text, status, index, onSelect, compact = false, hint, entrance = true }: OptionButtonProps) {
  const interactive = status === 'idle' && Boolean(onSelect)
  return (
    // El motion va en un contenedor: el transform inline de motion pisaría el hover/active del botón.
    <motion.div {...(entrance ? glitchIn(index % 2 === 0 ? 'left' : 'right', 0.04 * index) : {})}>
    <button
      type="button"
      className={[styles.option, styles[slot], styles[status], compact ? styles.compact : ''].filter(Boolean).join(' ')}
      disabled={!interactive}
      aria-pressed={status === 'chosen' ? true : undefined}
      aria-label={
        status === 'removed'
          ? `${text} (descartada por la pista)`
          : status === 'correct'
            ? `${text} (correcta)`
            : status === 'wrong'
              ? `${text} (tu respuesta, incorrecta)`
              : undefined
      }
      onClick={onSelect}
    >
      <span className={styles.symbol}>
        <OptionSymbol slot={slot} pixel={compact ? 4 : 5} />
      </span>
      <span className={styles.text}>{text}</span>
      {hint && interactive ? <span className={styles.key}>{hint}</span> : null}
      {status === 'chosen' ? (
        <span className={styles.badge}>
          <PixelCheck color="var(--ink)" pixel={3} /> ENVIADO
        </span>
      ) : null}
      {status === 'neutralChosen' ? <span className={styles.badge}>TU RESPUESTA</span> : null}
      {status === 'correct' ? (
        <span className={styles.badge}>
          <PixelCheck color="var(--bg)" pixel={3} /> CORRECTA
        </span>
      ) : null}
      {status === 'wrong' ? (
        <span className={styles.badge}>
          <PixelCross color="var(--ink)" pixel={3} /> TU RESPUESTA
        </span>
      ) : null}
    </button>
    </motion.div>
  )
}
