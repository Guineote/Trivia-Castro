import { useId, type CSSProperties } from 'react'
import { RollingNumber } from '../RollingNumber/RollingNumber'
import styles from './PixelSlider.module.css'

interface PixelSliderProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  disabled?: boolean
}

/** Slider de bloques con el número que "rueda". Es un <input type="range">: teclado y táctil gratis. */
export function PixelSlider({ label, value, min, max, onChange, disabled = false }: PixelSliderProps) {
  const id = useId()
  const steps = Math.max(1, max - min)
  const fill = ((value - min) / steps) * 100
  return (
    <div className={styles.slider}>
      <div className={styles.head}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        <output htmlFor={id} className={styles.value}>
          <RollingNumber value={value} duration={0.25} />
        </output>
      </div>
      <input
        id={id}
        className={styles.range}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        style={{ '--fill': `${fill}%`, '--steps': steps } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}
