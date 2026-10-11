import { useEffect, useRef } from 'react'
import styles from './AnimatedBackground.module.css'

interface AnimatedBackgroundProps {
  /** 'high' = menús y podio · 'low' = pantallas de lectura (pregunta). */
  intensity?: 'high' | 'low'
}

/** Estrellas determinísticas (sin Math.random: el fondo no cambia entre renders). */
function starField(count: number, seed: number, palette: string[], spread: number): string {
  let s = seed
  const next = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  return Array.from({ length: count }, () => {
    const x = (next() * 100).toFixed(1)
    const y = (next() * 62).toFixed(1) // solo en el cielo, sobre el horizonte
    const color = palette[Math.floor(next() * palette.length)]
    return `${x}vw ${y}vh 0 ${spread}px ${color}`
  }).join(', ')
}

const FAR_STARS = starField(70, 7, ['#9d98c7', '#f5f1e6'], 0)
const NEAR_STARS = starField(22, 31, ['#19e3ff', '#ff2e93', '#ffd23f'], 1)

/**
 * Rejilla synthwave en perspectiva + sol rayado + estrellas, con parallax suave.
 * Todo CSS: sin canvas ni imágenes. Con prefers-reduced-motion queda estático.
 */
export function AnimatedBackground({ intensity = 'high' }: AnimatedBackgroundProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--px', String(event.clientX / window.innerWidth - 0.5))
        el.style.setProperty('--py', String(event.clientY / window.innerHeight - 0.5))
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  return (
    <div ref={ref} className={[styles.root, intensity === 'low' ? styles.low : ''].filter(Boolean).join(' ')} aria-hidden="true">
      <div className={styles.starsFar}>
        <i style={{ boxShadow: FAR_STARS }} />
      </div>
      <div className={styles.starsNear}>
        <i style={{ boxShadow: NEAR_STARS }} />
      </div>
      <div className={styles.sun} />
      <div className={styles.floor}>
        <div className={styles.grid} />
      </div>
      <div className={styles.vignette} />
    </div>
  )
}
