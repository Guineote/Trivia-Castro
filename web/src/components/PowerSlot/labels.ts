import type { PowerType } from '@/api/types'

export const POWER_LABEL: Record<PowerType, string> = {
  DOUBLE: 'DOBLE',
  SHIELD: 'ESCUDO',
  HINT: 'PISTA',
}

export const POWER_HELP: Record<PowerType, string> = {
  DOUBLE: 'Duplica los puntos de la ronda',
  SHIELD: 'Si fallas, no pierdes la vida',
  HINT: 'Quita dos opciones incorrectas',
}
