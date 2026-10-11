import type { CSSProperties } from 'react'
import { CHECK_ROWS, CROSS_ROWS, OPTION_COLOR, POWER_SPRITES, SYMBOLS, type OptionSlot } from './options'
import type { PowerType } from '@/api/types'

/**
 * Sprites pixel-art propios (sin librería de íconos ni emojis).
 * Cada fila es una cadena; los caracteres se buscan en `palette`, "." = vacío.
 */
interface SpriteProps {
  rows: readonly string[]
  palette: Record<string, string>
  /** Color del contorno (medio píxel por fuera). */
  outline?: string
  /** Tamaño en px CSS de cada celda. */
  pixel?: number
  title?: string
  className?: string
  style?: CSSProperties
}

const OUTLINE = 0.5

export function PixelSprite({ rows, palette, outline = '#000', pixel = 4, title, className, style }: SpriteProps) {
  const height = rows.length
  const width = Math.max(...rows.map((r) => r.length))
  const cells: { x: number; y: number; color: string }[] = []
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]]
      if (color) cells.push({ x, y, color })
    }
  })
  return (
    <svg
      className={className}
      style={style}
      width={(width + OUTLINE * 2) * pixel}
      height={(height + OUTLINE * 2) * pixel}
      viewBox={`${-OUTLINE} ${-OUTLINE} ${width + OUTLINE * 2} ${height + OUTLINE * 2}`}
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {cells.map(({ x, y }) => (
        <rect key={`o${x},${y}`} x={x - OUTLINE} y={y - OUTLINE} width={1 + OUTLINE * 2} height={1 + OUTLINE * 2} style={{ fill: outline }} />
      ))}
      {cells.map(({ x, y, color }) => (
        <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} style={{ fill: color }} />
      ))}
    </svg>
  )
}

// ── Corazón (vidas) ─────────────────────────────────────────────────────────
const HEART_ROWS = [
  '.XX...XX.',
  'XHXX.XXXX',
  'XHXXXXXXX',
  'XXXXXXXXX',
  '.XXXXXXX.',
  '..XXXXX..',
  '...XXX...',
  '....X....',
] as const

export function PixelHeart({ filled = true, pixel = 4, className }: { filled?: boolean; pixel?: number; className?: string }) {
  return (
    <PixelSprite
      rows={HEART_ROWS}
      pixel={pixel}
      className={className}
      outline={filled ? '#000' : 'var(--ink-dim)'}
      palette={filled ? { X: 'var(--red)', H: '#ffb3b3' } : { X: 'var(--bg-3)', H: 'var(--bg-3)' }}
    />
  )
}

/** Mitades del corazón roto (para la animación de pérdida de vida). */
export function PixelHeartHalf({ side, pixel = 4 }: { side: 'left' | 'right'; pixel?: number }) {
  const rows = HEART_ROWS.map((row) => (side === 'left' ? row.slice(0, 5).padEnd(9, '.') : row.slice(0, 4).replace(/./g, '.') + row.slice(4)))
  return <PixelSprite rows={rows} pixel={pixel} palette={{ X: 'var(--red)', H: '#ffb3b3' }} />
}

// ── Símbolos de las opciones (datos en options.ts) ─────────────────────────
export function OptionSymbol({ slot, pixel = 4, className }: { slot: OptionSlot; pixel?: number; className?: string }) {
  return <PixelSprite rows={SYMBOLS[slot]} pixel={pixel} className={className} palette={{ X: OPTION_COLOR[slot] }} />
}

export function PixelCheck({ color = 'var(--green)', pixel = 4, className }: { color?: string; pixel?: number; className?: string }) {
  return <PixelSprite rows={CHECK_ROWS} pixel={pixel} className={className} palette={{ X: color }} />
}

export function PixelCross({ color = 'var(--red)', pixel = 4, className }: { color?: string; pixel?: number; className?: string }) {
  return <PixelSprite rows={CROSS_ROWS} pixel={pixel} className={className} palette={{ X: color }} />
}

export function PowerIcon({ type, pixel = 4, className }: { type: PowerType; pixel?: number; className?: string }) {
  const sprite = POWER_SPRITES[type]
  return <PixelSprite rows={sprite.rows} palette={sprite.palette} pixel={pixel} className={className} />
}

// ── Personaje de las pantallas de error ─────────────────────────────────────
const GHOST_ROWS = [
  '...GGGGG...',
  '..GGGGGGG..',
  '.GGGGGGGGG.',
  '.GGWWGWWGG.',
  '.GGWBGWBGG.',
  '.GGGGGGGGG.',
  '.GGGKKKGGG.',
  '.GGGGGGGGG.',
  '.GGGGGGGGG.',
  '.GG.GGG.GG.',
  '.G...G...G.',
] as const

/** Fantasma pixel triste: el "personaje" de las pantallas de error. */
export function PixelGhost({ pixel = 8, className }: { pixel?: number; className?: string }) {
  return (
    <PixelSprite
      rows={GHOST_ROWS}
      pixel={pixel}
      className={className}
      palette={{ G: 'var(--magenta)', W: '#ffffff', B: 'var(--violet)', K: '#000000' }}
    />
  )
}
