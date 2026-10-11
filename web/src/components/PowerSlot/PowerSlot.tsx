import type { PowerType } from '@/api/types'
import { play } from '@/lib/sound'
import { PowerIcon } from '../PixelIcon/PixelIcon'
import { POWER_HELP, POWER_LABEL } from './labels'
import styles from './PowerSlot.module.css'

export type PowerState = 'available' | 'active' | 'used'

interface PowerSlotProps {
  type: PowerType
  state: PowerState
  /** Si es true, el poder disponible no se puede activar (ya respondió, espectador…). */
  locked?: boolean
  onUse?: (type: PowerType) => void
}

/** Poder con ícono pixel-art. Disponible / activo / usado. Se activa antes de responder. */
export function PowerSlot({ type, state, locked = false, onUse }: PowerSlotProps) {
  const usable = state === 'available' && !locked
  const stateLabel = state === 'active' ? 'activo' : state === 'used' ? 'usado' : 'disponible'
  return (
    <button
      type="button"
      className={[styles.slot, styles[state]].join(' ')}
      disabled={!usable}
      aria-pressed={state === 'active'}
      aria-label={`${POWER_LABEL[type]}: ${POWER_HELP[type]} (${stateLabel})`}
      title={POWER_HELP[type]}
      onClick={() => {
        play('power')
        onUse?.(type)
      }}
    >
      <span className={styles.icon}>
        <PowerIcon type={type} pixel={4} />
      </span>
      <span className={styles.label}>{POWER_LABEL[type]}</span>
      {state === 'active' ? <span className={styles.tag}>ON</span> : null}
      {state === 'used' ? <span className={styles.strike} aria-hidden="true" /> : null}
    </button>
  )
}
