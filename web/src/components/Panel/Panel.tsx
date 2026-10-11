import type { HTMLAttributes, ReactNode } from 'react'
import styles from './Panel.module.css'

interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Etiqueta pegada en la esquina superior izquierda (tipo sticker). */
  title?: ReactNode
  tone?: 'default' | 'accent' | 'dark'
  /** Inclina el panel (grados). El brief pide romper la simetría con ángulos. */
  tilt?: number
}

/** Fondo --bg-2, borde grueso, esquinas rectas y sombra dura. */
export function Panel({ title, tone = 'default', tilt, className, style, children, ...rest }: PanelProps) {
  const classes = [styles.panel, styles[tone], className ?? ''].filter(Boolean).join(' ')
  return (
    <div className={classes} style={tilt ? { ...style, transform: `rotate(${tilt}deg)` } : style} {...rest}>
      {title ? <span className={styles.title}>{title}</span> : null}
      {children}
    </div>
  )
}
