import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { dur } from '@/lib/motion'
import { PixelHeart, PixelHeartHalf } from '../PixelIcon/PixelIcon'
import styles from './LifeHearts.module.css'

interface LifeHeartsProps {
  lives: number
  /** Vidas con las que empezó (settings.lives). Los corazones vacíos se dibujan hasta aquí. */
  max?: number
  pixel?: number
  /** Vidas que tenía antes (REVEAL): al montar, los corazones perdidos se rompen en pantalla. */
  from?: number
  className?: string
}

const PARTICLES = [
  { x: -28, y: -34, r: -90 },
  { x: 26, y: -40, r: 120 },
  { x: -36, y: 8, r: -160 },
  { x: 34, y: 14, r: 150 },
  { x: -6, y: 36, r: 60 },
  { x: 8, y: -48, r: -60 },
]

/** Corazón que se rompe: dos mitades que caen + partículas, sobre el hueco que deja. */
function BreakingHeart({ pixel }: { pixel: number }) {
  const reduce = useReducedMotion()
  const w = 10 * pixel
  return (
    <motion.span
      className={styles.breaking}
      style={{ width: w, height: 9 * pixel }}
      initial={{ x: 0 }}
      animate={reduce ? undefined : { x: [0, -4, 4, -3, 3, 0] }}
      transition={{ duration: dur(0.25) }}
    >
      <motion.span
        className={styles.half}
        initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
        animate={reduce ? { opacity: 0 } : { x: -18, y: 46, rotate: -28, opacity: 0 }}
        transition={{ duration: dur(0.7), delay: dur(0.2), ease: 'easeIn' }}
      >
        <PixelHeartHalf side="left" pixel={pixel} />
      </motion.span>
      <motion.span
        className={styles.half}
        initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
        animate={reduce ? { opacity: 0 } : { x: 18, y: 54, rotate: 32, opacity: 0 }}
        transition={{ duration: dur(0.7), delay: dur(0.2), ease: 'easeIn' }}
      >
        <PixelHeartHalf side="right" pixel={pixel} />
      </motion.span>
      {reduce
        ? null
        : PARTICLES.map((p, i) => (
            <motion.i
              key={i}
              className={styles.particle}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
              animate={{ x: p.x, y: p.y + 20, opacity: 0, rotate: p.r, scale: 0.4 }}
              transition={{ duration: dur(0.6), delay: dur(0.2), ease: 'easeOut' }}
            />
          ))}
    </motion.span>
  )
}

/** Vidas como corazones pixel. Al perder una, ese corazón se rompe (shake + partículas + fade). */
export function LifeHearts({ lives, max, pixel = 4, from, className }: LifeHeartsProps) {
  const total = Math.max(max ?? lives, lives, from ?? 0)
  const previous = useRef(from ?? lives)
  const [breaking, setBreaking] = useState<number[]>([])

  useEffect(() => {
    const before = previous.current
    previous.current = lives
    if (lives >= before) return
    // Los corazones perdidos son los índices lives … before−1.
    const lost = Array.from({ length: before - lives }, (_, i) => lives + i)
    setBreaking((current) => [...current, ...lost])
    // Sin limpiar el timeout: en StrictMode el efecto corre dos veces y el corazón roto no se retiraría.
    setTimeout(() => setBreaking((current) => current.filter((i) => !lost.includes(i))), dur(1.1) * 1000)
  }, [lives])

  return (
    <div className={[styles.hearts, className ?? ''].filter(Boolean).join(' ')} role="img" aria-label={`${lives} de ${total} vidas`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={styles.slot} style={{ width: 10 * pixel, height: 9 * pixel }}>
          <PixelHeart filled={i < lives} pixel={pixel} />
          <AnimatePresence>{breaking.includes(i) ? <BreakingHeart key="break" pixel={pixel} /> : null}</AnimatePresence>
        </span>
      ))}
    </div>
  )
}
