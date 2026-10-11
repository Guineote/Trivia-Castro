import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { dur } from '@/lib/motion'
import { PixelButton } from '../PixelButton/PixelButton'
import styles from './RoomCode.module.css'

/** Código de sala en bloques grandes + botón copiar (con respaldo si el portapapeles no está disponible). */
export function RoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(id)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      // Sin permiso de portapapeles: el código ya está a la vista para dictarlo.
    }
  }

  return (
    <div className={styles.root}>
      <p className={styles.caption}>CODIGO DE SALA</p>
      <ol className={styles.blocks} aria-label={`Código de sala: ${[...code].join(' ')}`}>
        {[...code].map((char, i) => (
          <motion.li
            key={i}
            className={styles.block}
            aria-hidden="true"
            initial={{ y: -80, opacity: 0, rotate: i % 2 ? 8 : -8 }}
            animate={{ y: [-80, 0, -10, 0], opacity: 1, rotate: 0 }}
            transition={{ duration: dur(0.5), delay: dur(0.05 * i), times: [0, 0.55, 0.8, 1], ease: 'linear' }}
          >
            {char}
          </motion.li>
        ))}
      </ol>
      <PixelButton size="sm" color={copied ? 'green' : 'cyan'} onClick={copy}>
        {copied ? 'COPIADO' : 'COPIAR'}
      </PixelButton>
    </div>
  )
}
