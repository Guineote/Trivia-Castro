import { describe, expect, it } from 'vitest'
import { DIFFICULTIES, PARTICIPANT_STATUSES, PHASES, POWER_TYPES, ROOM_STATUSES, ROUND_TYPES } from '@/api/types'
import { FIXTURES, STATE_FIXTURES } from '@/mock/fixtures'

const sorted = (o: object) => Object.keys(o).sort()

const STATE_KEYS = ['me', 'phase', 'players', 'ranking', 'round', 'serverTime', 'version', 'winner']
const ME_KEYS = ['activePower', 'hasAnswered', 'lastResult', 'lives', 'participantId', 'powers', 'score', 'status']
const PLAYER_KEYS = ['hasAnswered', 'isHost', 'lives', 'nickname', 'participantId', 'pointsThisRound', 'score', 'status']
const ROUND_KEYS = ['endsAt', 'number', 'question', 'totalRounds', 'type']
const QUESTION_KEYS = ['categoryId', 'difficulty', 'id', 'options', 'text']
const LAST_RESULT_KEYS = [
  'answerTimeMs', 'basePoints', 'becameSpectator', 'chosenOptionId', 'isCorrect',
  'livesLost', 'pointsAwarded', 'powerMultiplier', 'roundMultiplier', 'speedBonus',
]
const RANKING_KEYS = ['nickname', 'participantId', 'position', 'positionDelta', 'score']

describe('fixtures del contrato (docs/contrato/ejemplos)', () => {
  for (const [name, state] of Object.entries(STATE_FIXTURES)) {
    describe(`state · ${name}`, () => {
      it('tiene exactamente los campos del contrato y enums válidos', () => {
        expect(sorted(state)).toEqual(STATE_KEYS)
        expect(PHASES).toContain(state.phase)
        expect(sorted(state.me)).toEqual(ME_KEYS)
        expect(PARTICIPANT_STATUSES).toContain(state.me.status)
        if (state.me.activePower !== null) expect(POWER_TYPES).toContain(state.me.activePower)
        for (const p of state.me.powers) expect(POWER_TYPES).toContain(p.powerType)
        for (const p of state.players) {
          expect(sorted(p)).toEqual(PLAYER_KEYS)
          expect(PARTICIPANT_STATUSES).toContain(p.status)
        }
      })

      it('respeta la tabla de campos por fase (README §5)', () => {
        const { phase, round, me, players, ranking, winner } = state
        expect(round === null).toBe(phase === 'FINAL')
        if (round) {
          expect(sorted(round)).toEqual(ROUND_KEYS)
          expect(ROUND_TYPES).toContain(round.type)
          expect(Number.isNaN(Date.parse(round.endsAt))).toBe(false)
          expect(round.question === null).toBe(phase === 'ROUND_INTRO' || phase === 'SCOREBOARD')
          if (round.question) {
            expect(sorted(round.question)).toEqual(QUESTION_KEYS)
            expect(DIFFICULTIES).toContain(round.question.difficulty)
            const flags = round.question.options.map((o) => o.isCorrect)
            if (phase === 'REVEAL') expect(flags.filter(Boolean)).toHaveLength(1)
            else expect(flags.every((f) => f === undefined)).toBe(true)
          }
        }
        expect(me.lastResult !== null).toBe(phase === 'REVEAL' || phase === 'SCOREBOARD')
        if (me.lastResult) expect(sorted(me.lastResult)).toEqual(LAST_RESULT_KEYS)
        expect(players.every((p) => (p.pointsThisRound === null) === (phase !== 'REVEAL' || p.status === 'SPECTATOR'))).toBe(true)
        expect(ranking !== null).toBe(phase === 'SCOREBOARD' || phase === 'FINAL')
        ranking?.forEach((r) => expect(sorted(r)).toEqual(RANKING_KEYS))
        expect(winner !== null).toBe(phase === 'FINAL')
      })
    })
  }

  it('el desglose de puntos del REVEAL cuadra: (base + velocidad) × ronda × poder', () => {
    const r = STATE_FIXTURES.REVEAL.me.lastResult
    expect(r).not.toBeNull()
    expect((r!.basePoints + r!.speedBonus) * r!.roundMultiplier * r!.powerMultiplier).toBe(r!.pointsAwarded)
    expect(STATE_FIXTURES.REVEAL.me.score - r!.pointsAwarded).toBe(STATE_FIXTURES.QUESTION.me.score)
  })

  it('room.json usa enums válidos y defaults de D4', () => {
    expect(ROOM_STATUSES).toContain(FIXTURES.room.status)
    expect(FIXTURES.room.settings).toEqual({ maxPlayers: 8, rounds: 10, lives: 3, categoryIds: [] })
    expect(FIXTURES.room.currentGameId).toBeNull()
  })

  it('ranking, results y round-results tienen la forma documentada', () => {
    expect(sorted(FIXTURES.ranking)).toEqual(['afterRound', 'gameId', 'items'])
    FIXTURES.ranking.items.forEach((i) => expect(sorted(i)).toEqual(RANKING_KEYS))
    expect(sorted(FIXTURES.results)).toEqual(['gameId', 'ranking', 'roomCode', 'stats', 'totalRounds', 'winner'])
    expect(sorted(FIXTURES.roundResults)).toEqual(['gameId', 'results', 'round'])
  })
})
