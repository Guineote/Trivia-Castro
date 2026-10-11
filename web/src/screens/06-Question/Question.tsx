import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/api/endpoints'
import { isApiError, messageFromError } from '@/api/errors'
import { gameStateKey } from '@/api/hooks'
import type { Difficulty, PowerType, StateOption } from '@/api/types'
import { PlayerChip } from '@/components/PlayerChip/PlayerChip'
import { PowerSlot } from '@/components/PowerSlot/PowerSlot'
import type { OptionSlot } from '@/components/PixelIcon/options'
import { Stage, UrgentFrame } from '@/components/Stage/Stage'
import { Timer } from '@/components/Timer/Timer'
import { useCountdown } from '@/lib/clock'
import { glitchIn } from '@/lib/motion'
import { LAST_SECONDS_WARNING } from '@/lib/phases'
import { GameHud } from '../game/GameHud'
import { powerStates } from '../game/powers'
import type { GameScreenProps } from '../game/types'
import { OptionButton, type OptionStatus } from './OptionButton'
import styles from './Question.module.css'

const SLOTS: OptionSlot[] = ['A', 'B', 'C', 'D']
const DIFFICULTY_LABEL: Record<Difficulty, string> = { EASY: 'FACIL', MEDIUM: 'MEDIO', HARD: 'DIFICIL' }

/**
 * Todas las opciones vistas de esta pregunta, en su orden original. Con HINT el servidor quita
 * 2 del `state`; así se pueden dibujar tachadas en lugar de que desaparezcan de golpe.
 */
function useSeenOptions(questionId: string | undefined, current: StateOption[]): StateOption[] {
  const [seen, setSeen] = useState({ id: questionId, options: current })
  if (seen.id !== questionId || current.length > seen.options.length) {
    // Estado derivado: pregunta nueva, o el estado trae más opciones que las vistas.
    const next = { id: questionId, options: current }
    setSeen(next)
    return next.options
  }
  return seen.options
}

/** 06 · QUESTION (20 s): pregunta, 4 opciones, timer, poderes y quién ya respondió. */
export default function Question({ gameId, state, maxLives }: GameScreenProps) {
  const { round, me, players } = state
  const question = round?.question ?? null
  const qc = useQueryClient()
  const spectator = me.status === 'SPECTATOR'

  const [chosen, setChosen] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const remaining = useCountdown(round?.endsAt)
  const options = useSeenOptions(question?.id, question?.options ?? [])
  const answered = me.hasAnswered || chosen !== null

  const refresh = () => void qc.invalidateQueries({ queryKey: gameStateKey(gameId) })

  const answer = useMutation({
    mutationFn: (optionId: string) => api.answer(gameId, round?.number ?? 0, optionId),
    onMutate: (optionId) => {
      setChosen(optionId) // feedback inmediato (<100 ms); el servidor lo confirma con hasAnswered
      setMessage(null)
    },
    onError: (err) => {
      // Ya había respondido: no es un error para el jugador, solo se confirma.
      if (isApiError(err, 'ALREADY_ANSWERED')) return
      setChosen(null)
      setMessage(messageFromError(err))
    },
    onSettled: refresh,
  })

  const usePower = useMutation({
    mutationFn: (type: PowerType) => api.usePower(gameId, round?.number ?? 0, type),
    onMutate: () => setMessage(null),
    onError: (err) => setMessage(messageFromError(err)),
    onSettled: refresh,
  })

  const canAnswer = !spectator && !answered && !answer.isPending

  // Atajos de teclado: 1–4 o A–D.
  const onPick = useRef<(index: number) => void>(() => {})
  useEffect(() => {
    // Siempre el handler más reciente (el listener de teclado se registra una sola vez).
    onPick.current = (index) => {
      const option = options[index]
      const stillThere = option && question?.options.some((o) => o.id === option.id)
      if (canAnswer && stillThere) answer.mutate(option.id)
    }
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const index = '1234'.indexOf(event.key)
      const letter = 'abcd'.indexOf(event.key.toLowerCase())
      const pick = index >= 0 ? index : letter
      if (pick >= 0) onPick.current(pick)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!round || !question) return null

  const statusOf = (option: StateOption): OptionStatus => {
    if (!question.options.some((o) => o.id === option.id)) return 'removed'
    if (spectator) return 'idle'
    if (answered) return option.id === chosen ? 'chosen' : 'dimmed'
    return 'idle'
  }

  const active = players.filter((p) => p.status === 'ACTIVE')
  const answeredCount = active.filter((p) => p.hasAnswered).length
  const urgent = remaining !== null && remaining > 0 && remaining <= LAST_SECONDS_WARNING * 1000

  return (
    <Stage spectator={spectator}>
      <UrgentFrame active={urgent} />
      <GameHud state={state} maxLives={maxLives} />
      <Timer endsAt={round.endsAt} />

      <motion.section className={styles.question} {...glitchIn('top', 0.05)}>
        <span className={styles.difficulty}>{DIFFICULTY_LABEL[question.difficulty]}</span>
        <h1 className={styles.text} id="question-text">
          {question.text}
        </h1>
      </motion.section>

      <ul className={styles.options} role="group" aria-labelledby="question-text">
        {options.map((option, i) => (
          <li key={option.id}>
            <OptionButton
              slot={SLOTS[i] ?? 'D'}
              text={option.text}
              index={i}
              status={statusOf(option)}
              hint={String(i + 1)}
              onSelect={canAnswer ? () => answer.mutate(option.id) : undefined}
            />
          </li>
        ))}
      </ul>

      <p className={styles.message} role="alert">
        {message ?? ''}
      </p>

      <footer className={styles.footer}>
        {!spectator ? (
          <ul className={styles.powers} aria-label="Tus poderes">
            {powerStates(me).map(({ type, state: powerState }) => (
              <li key={type}>
                <PowerSlot
                  type={type}
                  state={powerState}
                  // Un solo poder activo por ronda (activePower es un único valor) y solo antes de responder.
                  locked={answered || me.activePower !== null || usePower.isPending}
                  onUse={(t) => usePower.mutate(t)}
                />
              </li>
            ))}
          </ul>
        ) : null}

        <div className={styles.status}>
          <p className={styles.waiting} aria-live="polite">
            {spectator
              ? `RESPONDIERON ${answeredCount}/${active.length}`
              : answered
                ? `ESPERANDO A LOS DEMAS ${answeredCount}/${active.length}`
                : `RESPONDIERON ${answeredCount}/${active.length}`}
          </p>
          <ul className={styles.chips} aria-label="Jugadores">
            {players.map((p) => (
              <PlayerChip key={p.participantId} player={p} isMe={p.participantId === me.participantId} showAnswered />
            ))}
          </ul>
        </div>
      </footer>
    </Stage>
  )
}
