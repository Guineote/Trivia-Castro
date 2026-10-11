import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { dur } from '@/lib/motion'

interface RollingNumberProps {
  value: number
  /** Valor desde el que arranca al montarse (por defecto, el mismo `value`: sin animación inicial). */
  from?: number
  /** Segundos. */
  duration?: number
  /** Retraso inicial en segundos. */
  delay?: number
  className?: string
}

/** Contador tipo arcade: los números "ruedan" hasta el nuevo valor. */
export function RollingNumber({ value, from, duration = 0.7, delay = 0, className }: RollingNumberProps) {
  const reduce = useReducedMotion()
  const last = useRef(from ?? value)
  const [shown, setShown] = useState(from ?? value)

  useEffect(() => {
    if (reduce || last.current === value) {
      last.current = value
      setShown(value)
      return
    }
    const controls = animate(last.current, value, {
      duration: dur(duration),
      delay: dur(delay),
      ease: 'easeOut',
      onUpdate: (v) => setShown(Math.round(v)),
      onComplete: () => setShown(value),
    })
    last.current = value
    return () => controls.stop()
  }, [value, reduce, duration, delay])

  return <span className={className}>{shown.toLocaleString('es-MX')}</span>
}
