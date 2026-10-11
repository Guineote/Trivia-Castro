import { describe, expect, it } from 'vitest'
import { CONTRACT_ERROR_CODES } from '@/api/errors'
import { ERROR_SCREENS } from '@/lib/errorScreens'
import { accuracy, formatPoints, formatSeconds } from '@/lib/format'
import { getPrefs, setPrefs } from '@/lib/prefs'
import { play } from '@/lib/sound'
import { FIXTURES } from '@/mock/fixtures'

describe('formato de estadísticas', () => {
  it('formatSeconds y accuracy', () => {
    expect(formatSeconds(5300)).toBe('5.3 s')
    expect(formatSeconds(1900)).toBe('1.9 s')
    expect(formatSeconds(0)).toBe('—')
    expect(accuracy(8, 10)).toBe(80)
    expect(accuracy(2, 5)).toBe(40)
    expect(accuracy(0, 0)).toBe(0)
    expect(formatPoints(2232)).toMatch(/2.?232/)
  })

  it('results.json: cada jugador del ranking tiene estadísticas', () => {
    const ids = FIXTURES.results.stats.map((s) => s.participantId)
    for (const r of FIXTURES.results.ranking) expect(ids).toContain(r.participantId)
  })
})

describe('preferencias y sonido', () => {
  it('sin almacenamiento disponible las preferencias viven en memoria', () => {
    expect(getPrefs()).toEqual({ muted: false, crt: false })
    setPrefs({ muted: true })
    expect(getPrefs().muted).toBe(true)
    setPrefs({ muted: false, crt: true })
    expect(getPrefs()).toEqual({ muted: false, crt: true })
    setPrefs({ crt: false })
  })

  it('play() no hace nada (ni falla) antes del primer gesto del usuario', () => {
    expect(() => play('click')).not.toThrow()
    expect(() => play('fanfare')).not.toThrow()
  })
})

describe('pantallas de error', () => {
  it('los errores no reintentables de unirse tienen título y pista propios', () => {
    for (const code of ['ROOM_FULL', 'ROOM_NOT_FOUND', 'GAME_ALREADY_STARTED']) {
      expect(CONTRACT_ERROR_CODES).toContain(code)
      expect(ERROR_SCREENS[code].title.length).toBeGreaterThan(0)
      expect(ERROR_SCREENS[code].hint.length).toBeGreaterThan(0)
    }
  })

  it('los títulos (Press Start 2P) no llevan acentos', () => {
    for (const { title } of Object.values(ERROR_SCREENS)) expect(title).toMatch(/^[A-Z0-9 ]+$/)
  })
})
