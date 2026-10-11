import { useReducedMotion } from 'motion/react'
import { getPrefs, setPrefs, usePrefs } from '@/lib/prefs'
import { play } from '@/lib/sound'
import { PixelSprite } from '../PixelIcon/PixelIcon'
import styles from './SettingsTools.module.css'

const SPEAKER_ON = ['..X.....', '.XX.X...', 'XXX..X..', 'XXX..X..', 'XXX..X..', '.XX.X...', '..X.....']
const SPEAKER_OFF = ['..X.....', '.XX.R.R.', 'XXX..R..', 'XXX..R..', 'XXX.R.R.', '.XX.....', '..X.....']
const SCREEN = ['XXXXXXXX', 'X......X', 'X......X', 'X......X', 'X......X', 'XXXXXXXX', '..XXXX..']

interface SettingsToolsProps {
  /** true = dentro de otra barra (HUD); false = flotante arriba a la derecha. */
  inline?: boolean
}

/** Botones de sonido (mute persistente) y efecto CRT. */
export function SettingsTools({ inline = false }: SettingsToolsProps) {
  const { muted, crt } = usePrefs()
  const reduce = useReducedMotion()

  function toggleSound() {
    setPrefs({ muted: !getPrefs().muted })
    play('click') // solo suena al activar el sonido (muted ya es false)
  }

  return (
    <div className={[styles.tools, inline ? styles.inline : styles.floating].join(' ')}>
      <button
        type="button"
        className={[styles.tool, muted ? styles.off : styles.on].join(' ')}
        aria-pressed={!muted}
        aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
        title={muted ? 'Activar sonido' : 'Silenciar sonido'}
        onClick={toggleSound}
      >
        <PixelSprite
          rows={muted ? SPEAKER_OFF : SPEAKER_ON}
          pixel={3}
          palette={{ X: 'var(--ink)', R: 'var(--red)' }}
          outline="transparent"
        />
      </button>
      {reduce ? null : (
        <button
          type="button"
          className={[styles.tool, crt ? styles.on : styles.off].join(' ')}
          aria-pressed={crt}
          aria-label={crt ? 'Quitar efecto CRT' : 'Activar efecto CRT'}
          title="Efecto CRT"
          onClick={() => {
            setPrefs({ crt: !crt })
            play('click')
          }}
        >
          <PixelSprite rows={SCREEN} pixel={3} palette={{ X: crt ? 'var(--cyan)' : 'var(--ink-dim)' }} outline="transparent" />
        </button>
      )}
    </div>
  )
}
