import { describe, expect, it } from 'vitest'
import { stateKey } from '@/screens/game/useShownState'
import { powerStates } from '@/screens/game/powers'
import { STATE_FIXTURES } from '@/mock/fixtures'

describe('pantallas de partida · lógica', () => {
  it('stateKey cambia con cada fase y con cada ronda', () => {
    const keys = Object.values(STATE_FIXTURES).map(stateKey)
    expect(new Set(keys).size).toBeGreaterThanOrEqual(5)
    expect(stateKey(STATE_FIXTURES.FINAL)).toBe('final:FINAL')
    expect(stateKey(STATE_FIXTURES.QUESTION)).toBe('3:QUESTION')
  })

  it('powerStates: inventario = disponible, activo, o ya usado', () => {
    const me = STATE_FIXTURES.QUESTION.me // inventario: HINT y SHIELD (DOUBLE ya usado)
    expect(powerStates(me)).toEqual([
      { type: 'DOUBLE', state: 'used' },
      { type: 'SHIELD', state: 'available' },
      { type: 'HINT', state: 'available' },
    ])
    expect(powerStates({ ...me, activePower: 'HINT', powers: [{ powerType: 'SHIELD' }] }).map((p) => p.state)).toEqual([
      'used',
      'available',
      'active',
    ])
  })
})

import { CODE_LENGTH, cleanCode } from '@/components/CodeInput/code'

describe('código de sala', () => {
  it('cleanCode pasa a mayúsculas, quita lo que no sea letra/número y corta a 6', () => {
    expect(cleanCode('k7x-4qm')).toBe('K7X4QM')
    expect(cleanCode(' k7x4qm99 ')).toBe('K7X4QM')
    expect(cleanCode('¡¿?')).toBe('')
    expect(CODE_LENGTH).toBe(6)
  })
})
