/** Símbolos de las opciones de respuesta: A ▲  B ●  C ■  D ◆ (sprites en PixelIcon.tsx). */
export const SYMBOLS = {
  A: ['...X...', '...X...', '..XXX..', '..XXX..', '.XXXXX.', '.XXXXX.', 'XXXXXXX'],
  B: ['..XXX..', '.XXXXX.', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..'],
  C: ['XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX'],
  D: ['...X...', '..XXX..', '.XXXXX.', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
} as const

export type OptionSlot = keyof typeof SYMBOLS

/** Color fijo por opción (design brief). */
export const OPTION_COLOR: Record<OptionSlot, string> = {
  A: 'var(--opt-a)',
  B: 'var(--opt-b)',
  C: 'var(--opt-c)',
  D: 'var(--opt-d)',
}

/** Sprites de estado y poderes (PixelIcon.tsx). "." = vacío. */
export const CHECK_ROWS = ['......X', '.....XX', 'X...XX.', 'XX.XX..', '.XXX...', '..X....'] as const
export const CROSS_ROWS = ['XX...XX', 'XXX.XXX', '.XXXXX.', '..XXX..', '.XXXXX.', 'XXX.XXX', 'XX...XX'] as const

export const POWER_SPRITES = {
  DOUBLE: {
    rows: ['X.X.XXX', 'X.X...X', '.X..XXX', 'X.X.X..', 'X.X.XXX'],
    palette: { X: 'var(--yellow)' },
  },
  SHIELD: {
    rows: ['XXXXXXXXX', 'XHXXXXXXX', 'XHXXXXXXX', 'XHXXXXXXX', '.XXXXXXX.', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'],
    palette: { X: 'var(--cyan)', H: '#b8f6ff' },
  },
  HINT: {
    rows: ['..XXX..', '.XHXXX.', 'XXHXXXX', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '..YYY..', '..YYY..'],
    palette: { X: 'var(--yellow)', H: '#fff2b3', Y: 'var(--ink-dim)' },
  },
} as const
