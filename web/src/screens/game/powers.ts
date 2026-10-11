import type { Me, PowerType } from '@/api/types'
import { POWER_TYPES } from '@/api/types'
import type { PowerState } from '@/components/PowerSlot/PowerSlot'

/** Estado de cada poder: en el inventario = disponible; activado esta ronda = activo; si no, ya se usó. */
export function powerStates(me: Me): { type: PowerType; state: PowerState }[] {
  return POWER_TYPES.map((type) => ({
    type,
    state: me.activePower === type ? 'active' : me.powers.some((p) => p.powerType === type) ? 'available' : 'used',
  }))
}
