import { motion, useAnimationControls, useReducedMotion } from 'motion/react'
import { useId, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { api } from '@/api/endpoints'
import { isApiError, messageFromError } from '@/api/errors'
import { getSession, updateSession } from '@/api/session'
import { CodeInput } from '@/components/CodeInput/CodeInput'
import { CODE_LENGTH, cleanCode } from '@/components/CodeInput/code'
import { Panel } from '@/components/Panel/Panel'
import { PixelButton } from '@/components/PixelButton/PixelButton'
import { dur, glitchIn } from '@/lib/motion'
import styles from './Join.module.css'

/** 03 · Unirse: código de 6 caracteres → POST /rooms/{code}/players (201 nuevo · 200 reconexión). */
export default function Join() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const reduce = useReducedMotion()
  const shake = useAnimationControls()
  const nicknameId = useId()

  const [code, setCode] = useState(() => cleanCode(params.get('codigo') ?? ''))
  const [nickname, setNickname] = useState(() => getSession()?.nickname ?? '')
  // D3: con NICKNAME_TAKEN se pide otro nombre sin crear otro jugador.
  const [askNickname, setAskNickname] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const complete = code.length === CODE_LENGTH

  function fail(err: unknown) {
    setError(messageFromError(err))
    if (isApiError(err, 'NICKNAME_TAKEN')) setAskNickname(true)
    if (!reduce) void shake.start({ x: [0, -10, 10, -8, 8, -4, 4, 0], transition: { duration: dur(0.35) } })
  }

  async function join() {
    if (!complete || pending) return
    setPending(true)
    setError(null)
    try {
      const override = askNickname ? nickname.trim() : undefined
      const joined = await api.joinRoom(code, override)
      updateSession({
        participantId: joined.participantId,
        roomCode: code,
        ...(override ? { nickname: override } : {}),
      })
      navigate(`/sala/${code}`)
    } catch (err) {
      fail(err)
    } finally {
      setPending(false)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void join()
  }

  return (
    <main className={styles.page}>
      <motion.div className={styles.wrap} {...glitchIn('bottom')}>
        <Panel title="UNIRSE" tilt={0.5}>
          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <p className={styles.label} id="code-label">
              CODIGO DE SALA
            </p>
            <motion.div animate={shake} aria-labelledby="code-label">
              <CodeInput
                value={code}
                onChange={(next) => {
                  setCode(next)
                  setError(null)
                }}
                onSubmit={() => void join()}
                invalid={Boolean(error) && !askNickname}
                autoFocus
                disabled={pending}
              />
            </motion.div>

            {askNickname ? (
              <motion.div className={styles.nickname} {...glitchIn('left')}>
                <label className={styles.label} htmlFor={nicknameId}>
                  ELIGE OTRO NOMBRE
                </label>
                <input
                  id={nicknameId}
                  className={styles.input}
                  value={nickname}
                  maxLength={20}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => {
                    setNickname(event.target.value)
                    setError(null)
                  }}
                />
              </motion.div>
            ) : null}

            <p className={styles.error} role="alert">
              {error ?? ''}
            </p>

            <div className={styles.actions}>
              <PixelButton type="submit" size="lg" color="cyan" block disabled={!complete || pending || (askNickname && nickname.trim().length < 2)}>
                {pending ? '...' : 'UNIRSE'}
              </PixelButton>
              <PixelButton color="ghost" block onClick={() => navigate('/')}>
                VOLVER
              </PixelButton>
            </div>
          </form>
        </Panel>
      </motion.div>
    </main>
  )
}
