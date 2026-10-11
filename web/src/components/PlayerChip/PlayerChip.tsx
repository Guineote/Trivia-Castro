import { motion } from 'motion/react'
import type { PublicPlayer } from '@/api/types'
import { dur } from '@/lib/motion'
import { PixelCheck, PixelHeart } from '../PixelIcon/PixelIcon'
import styles from './PlayerChip.module.css'

interface PlayerChipProps {
  player: PublicPlayer
  isMe?: boolean
  /** Muestra el check de "ya respondió" (hasAnswered viene del servidor, sin revelar qué). */
  showAnswered?: boolean
}

/** Nickname, vidas y check de "ya respondió". Los espectadores se ven apagados. */
export function PlayerChip({ player, isMe = false, showAnswered = false }: PlayerChipProps) {
  const spectator = player.status === 'SPECTATOR'
  return (
    <li className={[styles.chip, isMe ? styles.me : '', spectator ? styles.spectator : ''].filter(Boolean).join(' ')}>
      <span className={styles.name}>{player.nickname}</span>
      {spectator ? (
        <span className={styles.badge}>ESP</span>
      ) : (
        <span className={styles.lives} aria-label={`${player.lives} vidas`}>
          <PixelHeart pixel={2} />
          {player.lives}
        </span>
      )}
      {showAnswered && !spectator ? (
        player.hasAnswered ? (
          <motion.span
            className={styles.check}
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.4, 1] }}
            transition={{ duration: dur(0.25) }}
            aria-label="ya respondió"
          >
            <PixelCheck pixel={3} />
          </motion.span>
        ) : (
          <span className={styles.waiting} aria-label="pensando">
            ...
          </span>
        )
      ) : null}
    </li>
  )
}
