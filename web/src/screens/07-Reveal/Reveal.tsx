import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { PowerIcon } from '@/components/PixelIcon/PixelIcon'
import { PlayerChip } from '@/components/PlayerChip/PlayerChip'
import type { OptionSlot } from '@/components/PixelIcon/options'
import { Panel } from '@/components/Panel/Panel'
import { ScoreTally } from '@/components/ScoreTally/ScoreTally'
import { Stage } from '@/components/Stage/Stage'
import { Timer } from '@/components/Timer/Timer'
import { dur, glitchIn } from '@/lib/motion'
import { PHASE_DURATION_MS } from '@/lib/phases'
import { play } from '@/lib/sound'
import { GameHud } from '../game/GameHud'
import type { GameScreenProps } from '../game/types'
import { OptionButton, type OptionStatus } from '../06-Question/OptionButton'
import styles from './Reveal.module.css'

const SLOTS: OptionSlot[] = ['A', 'B', 'C', 'D']
/** Segundos que las opciones se ven neutras antes de iluminar la correcta (si no, "elegida" y "correcta" se confunden). */
const NEUTRAL_SECONDS = 0.6

/** 07 · REVEAL (4 s): primero se neutraliza, luego se ilumina la correcta; después, el desglose de puntos. */
export default function Reveal({ state, maxLives }: GameScreenProps) {
  const { round, me, players } = state
  const question = round?.question ?? null
  const result = me.lastResult
  const spectator = me.status === 'SPECTATOR'
  const [revealed, setRevealed] = useState(false)

  const hasResult = result !== null
  const isCorrect = result?.isCorrect === true
  useEffect(() => {
    const id = setTimeout(() => {
      setRevealed(true)
      // Suena al iluminarse la correcta, no antes (si no, se adelanta el resultado).
      if (hasResult) play(isCorrect ? 'correct' : 'wrong')
    }, dur(NEUTRAL_SECONDS) * 1000)
    return () => clearTimeout(id)
  }, [hasResult, isCorrect])

  if (!round || !question) return null

  const chosenId = result?.chosenOptionId ?? null
  const statusOf = (id: string, isCorrect: boolean): OptionStatus => {
    if (!revealed) return id === chosenId ? 'neutralChosen' : 'neutral'
    if (isCorrect) return 'correct'
    return id === chosenId ? 'wrong' : 'neutral'
  }

  // La API manda `powerUsed` en lastResult; si faltara (mock viejo), se cae a `activePower`.
  const shieldSaved = Boolean(
    result && !result.isCorrect && result.livesLost === 0 && (result.powerUsed ?? me.activePower) === 'SHIELD',
  )
  const timedOut = Boolean(result && result.chosenOptionId === null)

  let headline = ''
  let tone: 'good' | 'bad' | 'dim' = 'dim'
  if (result) {
    headline = result.isCorrect ? 'CORRECTO' : timedOut ? 'TIEMPO AGOTADO' : 'FALLASTE'
    tone = result.isCorrect ? 'good' : 'bad'
  }

  return (
    <Stage spectator={spectator && !result?.becameSpectator}>
      <GameHud
        state={state}
        maxLives={maxLives}
        scoreFrom={result ? me.score - result.pointsAwarded : undefined}
        livesFrom={result ? me.lives + result.livesLost : undefined}
      />
      <Timer endsAt={round.endsAt} durationMs={PHASE_DURATION_MS.REVEAL} segments={12} />

      <div className={styles.layout}>
        <section className={styles.left}>
          <h1 className={styles.question}>{question.text}</h1>
          <ul className={styles.options}>
            {question.options.map((option, i) => (
              <li key={option.id}>
                <OptionButton
                  slot={SLOTS[i] ?? 'D'}
                  text={option.text}
                  index={i}
                  entrance={false}
                  compact
                  status={statusOf(option.id, option.isCorrect === true)}
                />
              </li>
            ))}
          </ul>
        </section>

        <motion.aside className={styles.right} {...glitchIn('right', 0.1)}>
          <Panel title="RESULTADO" tone="dark">
            {result ? (
              <div className={styles.resultBody}>
                <motion.p
                  className={[styles.headline, styles[tone]].join(' ')}
                  aria-live="polite"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={revealed ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
                  transition={{ duration: dur(0.18) }}
                >
                  {headline}
                </motion.p>

                <ScoreTally result={result} previousScore={me.score - result.pointsAwarded} delay={NEUTRAL_SECONDS + 0.2} />

                {shieldSaved ? (
                  <motion.p
                    className={styles.note}
                    initial={{ opacity: 0, y: 10 }}
                    animate={revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                  >
                    <PowerIcon type="SHIELD" pixel={3} /> ESCUDO: NO PIERDES LA VIDA
                  </motion.p>
                ) : result.livesLost > 0 ? (
                  <p className={styles.noteBad}>-{result.livesLost} VIDA</p>
                ) : null}
                {result.becameSpectator ? <p className={styles.noteBad}>TE QUEDASTE SIN VIDAS: PASAS A ESPECTADOR</p> : null}
              </div>
            ) : (
              <p className={styles.spectatorNote}>Eres espectador: sigues viendo toda la partida.</p>
            )}
          </Panel>

          <ul className={styles.points} aria-label="Puntos de esta ronda">
            {players.map((p) => (
              <li key={p.participantId} className={styles.pointsRow}>
                <PlayerChip player={p} isMe={p.participantId === me.participantId} />
                <span className={p.pointsThisRound ? styles.gain : styles.none}>
                  {p.pointsThisRound === null ? '' : `+${p.pointsThisRound.toLocaleString('es-MX')}`}
                </span>
              </li>
            ))}
          </ul>
        </motion.aside>
      </div>
    </Stage>
  )
}
