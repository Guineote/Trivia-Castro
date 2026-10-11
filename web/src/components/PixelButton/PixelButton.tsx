import type { ButtonHTMLAttributes } from 'react'
import styles from './PixelButton.module.css'

export type PixelButtonColor = 'magenta' | 'cyan' | 'yellow' | 'violet' | 'green' | 'red' | 'ghost'

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  color?: PixelButtonColor
  size?: 'sm' | 'md' | 'lg'
  /** Ocupa todo el ancho disponible. */
  block?: boolean
}

/** Borde grueso negro + sombra dura. Hover sube 2 px; al pulsar se "hunde" (sombra 0). */
export function PixelButton({
  color = 'magenta',
  size = 'md',
  block = false,
  className,
  type = 'button',
  children,
  ...rest
}: PixelButtonProps) {
  const classes = [styles.button, styles[color], styles[size], block ? styles.block : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  )
}
