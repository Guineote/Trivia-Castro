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
