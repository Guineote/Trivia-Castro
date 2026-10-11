import { useCountdown } from '@/lib/clock'
import { LAST_SECONDS_WARNING, PHASE_DURATION_MS } from '@/lib/phases'
import styles from './Timer.module.css'

interface TimerProps {
  /** Fin de la fase (round.endsAt). Es solo visual: el servidor decide cuándo cierra. */
  endsAt: string | null | undefined
  /** Duración total de la fase, para llenar la barra. Por defecto, la de QUESTION. */
  durationMs?: number
  segments?: number
  className?: string
}

/** Segundos en los que se anuncia el tiempo a lectores de pantalla (sin narrar cada tick). */
const ANNOUNCE_AT = [10, LAST_SECONDS_WARNING]

/** Barra segmentada por bloques + número grande. Rojo y parpadeo en los últimos 5 s. */
export function Timer({ endsAt, durationMs = PHASE_DURATION_MS.QUESTION, segments = 20, className }: TimerProps) {
  const remaining = useCountdown(endsAt, 100)
  const seconds = remaining === null ? null : Math.ceil(remaining / 1000)
  const filled = remaining === null ? 0 : Math.min(segments, Math.ceil((remaining / durationMs) * segments))
  const urgent = seconds !== null && seconds > 0 && seconds <= LAST_SECONDS_WARNING
  const announcement = seconds !== null && ANNOUNCE_AT.includes(seconds) ? `Quedan ${seconds} segundos` : ''

  return (
    <div className={[styles.timer, urgent ? styles.urgent : '', className ?? ''].filter(Boolean).join(' ')} role="timer">
      <span className={styles.number} aria-hidden="true">
        {seconds === null ? '--' : String(seconds).padStart(2, '0')}
      </span>
      <div className={styles.bar} aria-hidden="true">
        {Array.from({ length: segments }, (_, i) => (
          <span key={i} className={i < filled ? styles.on : styles.off} />
        ))}
      </div>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}
