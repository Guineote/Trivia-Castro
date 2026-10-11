import { useReducedMotion } from 'motion/react'
import { usePrefs } from '@/lib/prefs'
import styles from './CrtOverlay.module.css'

/** Efecto CRT opcional: scanlines + viñeta suave. Se desactiva solo con prefers-reduced-motion. */
export function CrtOverlay() {
  const { crt } = usePrefs()
  const reduce = useReducedMotion()
  if (!crt || reduce) return null
  return <div className={styles.crt} aria-hidden="true" />
}
