import ranking from '@contrato/ranking.json'
import results from '@contrato/results.json'
import room from '@contrato/room.json'
import roundResults from '@contrato/round-results.json'
import stateFinal from '@contrato/state-final.json'
import stateQuestionSpectator from '@contrato/state-question-spectator.json'
import stateQuestion from '@contrato/state-question.json'
import stateReveal from '@contrato/state-reveal.json'
import stateRoundIntro from '@contrato/state-round-intro.json'
import stateScoreboard from '@contrato/state-scoreboard.json'
import type { GameState } from '@/api/types'

/**
 * JSON de ejemplo de docs/contrato/ejemplos, importados tal cual (sin copiar, para que
 * no se desincronicen). TypeScript ensancha los strings de un JSON, por eso se tipan
 * con un cast; src/test/fixtures.test.ts comprueba que cumplen los enums y la forma.
 */
export const STATE_FIXTURES = {
  'ROUND_INTRO': stateRoundIntro,
  'QUESTION': stateQuestion,
  'QUESTION (espectador)': stateQuestionSpectator,
  'REVEAL': stateReveal,
  'SCOREBOARD': stateScoreboard,
  'FINAL': stateFinal,
} as unknown as Record<string, GameState>

export const FIXTURES = { ranking, results, room, roundResults }

/**
 * Reubica los tiempos de una fixture: `serverTime` pasa a `now` y `endsAt` conserva
 * su distancia original. Como la versión no cambia, el servidor responde 304 y el
 * contador baja desde ese punto (útil para ver una pantalla estática).
 */
export function rebaseFixture(state: GameState, now: number, formatTime: (ms: number) => string): GameState {
  const originalNow = Date.parse(state.serverTime)
  return {
    ...state,
    serverTime: formatTime(now),
    round: state.round
      ? { ...state.round, endsAt: formatTime(now + (Date.parse(state.round.endsAt) - originalNow)) }
      : null,
  }
}
