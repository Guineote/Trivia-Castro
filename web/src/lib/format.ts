/** Milisegundos → "5.3 s". Sin dato (0 o negativo) → guion. */
export function formatSeconds(ms: number): string {
  return ms > 0 ? `${(ms / 1000).toFixed(1)} s` : '—'
}

/** Porcentaje entero de aciertos; sin respuestas = 0. */
export function accuracy(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0
}

export const formatPoints = (points: number): string => points.toLocaleString('es-MX')
