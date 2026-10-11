import { motion, useAnimationControls, useReducedMotion } from 'motion/react'
import { useId, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api } from '@/api/endpoints'
import { messageFromError } from '@/api/errors'
import { dismissExpired, getSession, saveSession, useSessionState } from '@/api/session'
import { OptionSymbol } from '@/components/PixelIcon/PixelIcon'
import { Panel } from '@/components/Panel/Panel'
import { PixelButton } from '@/components/PixelButton/PixelButton'
import { dur, glitchIn } from '@/lib/motion'
import { isMockEnabled } from '@/mock/runtime'
import styles from './Home.module.css'

const NICKNAME_MIN = 2
const NICKNAME_MAX = 20

const SHADOW_NORMAL = '6px 6px 0 #000, 0px 0px 0 #19e3ff, 0px 0px 0 #ff2e93'
const SHADOW_GLITCH = '6px 6px 0 #000, -9px 0px 0 #19e3ff, 9px 0px 0 #ff2e93'

/** Cada letra cae con rebote y, al aterrizar, "se desgarra" un instante (glitch). */
function LogoWord({ text, color, delay }: { text: string; color: string; delay: number }) {
  return (
    <span className={styles.word} style={{ '--letter-color': color } as CSSProperties} aria-hidden="true">
      {[...text].map((char, i) => (
        <motion.span
          key={i}
          className={styles.letter}
          initial={{ y: -560, rotate: i % 2 ? 16 : -16, opacity: 0 }}
          animate={{
            y: [-560, 0, -30, 0, -10, 0],
            rotate: 0,
            opacity: 1,
            textShadow: [SHADOW_NORMAL, SHADOW_GLITCH, SHADOW_NORMAL, SHADOW_NORMAL, SHADOW_NORMAL, SHADOW_NORMAL],
          }}
          transition={{
            duration: dur(0.95),
            delay: dur(delay + i * 0.07),
            times: [0, 0.5, 0.68, 0.84, 0.93, 1],
            ease: 'linear',
            opacity: { duration: dur(0.05), delay: dur(delay + i * 0.07) },
            rotate: { duration: dur(0.5), delay: dur(delay + i * 0.07) },
          }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const errorId = useId()
  const shake = useAnimationControls()
  const { expired } = useSessionState()

  const [nickname, setNickname] = useState(() => getSession()?.nickname ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function fail(message: string) {
    setError(message)
    inputRef.current?.focus()
    if (!reduce) void shake.start({ x: [0, -10, 10, -8, 8, -4, 4, 0], transition: { duration: dur(0.35) } })
  }

  /** POST /players (si el nickname cambió) → guarda el token → siguiente pantalla. */
  async function continueTo(target: '/crear' | '/unirse') {
    const clean = nickname.trim()
    if (clean.length < NICKNAME_MIN || clean.length > NICKNAME_MAX) {
      fail(`Tu nombre debe tener de ${NICKNAME_MIN} a ${NICKNAME_MAX} caracteres`)
      return
    }
    setPending(true)
    setError(null)
    try {
      if (getSession()?.nickname !== clean) {
        const player = await api.createPlayer(clean)
        saveSession({ token: player.token, playerId: player.playerId, nickname: player.nickname })
      }
      navigate(target)
    } catch (err) {
      fail(messageFromError(err))
    } finally {
      setPending(false)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void continueTo('/crear')
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.logo} aria-label="Trivia Castro">
          <LogoWord text="TRIVIA" color="var(--cyan)" delay={0.1} />
          <LogoWord text="CASTRO" color="var(--magenta)" delay={0.55} />
        </h1>

        <motion.p className={styles.banner} {...glitchIn('left', 1.2)}>
          <span>MULTIJUGADOR EN TIEMPO REAL</span>
        </motion.p>

        <motion.button
          type="button"
          className={styles.pressStart}
          onClick={() => inputRef.current?.focus()}
          {...glitchIn('bottom', 1.5)}
        >
          PRESS START
        </motion.button>

        <div className={styles.symbols} aria-hidden="true">
          {(['A', 'B', 'C', 'D'] as const).map((slot, i) => (
            <motion.span
              key={slot}
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: dur(1.7 + i * 0.08), duration: dur(0.25), ease: [0.2, 0.9, 0.3, 1.4] }}
            >
              <OptionSymbol slot={slot} pixel={6} />
            </motion.span>
          ))}
        </div>
      </section>

      <motion.div className={styles.formWrap} {...glitchIn('bottom', 0.9)}>
        <Panel title="JUGADOR 1" tilt={reduce ? 0 : 1}>
          <form className={styles.form} onSubmit={onSubmit} noValidate>
            {expired ? (
              <p className={styles.notice} role="status">
                Tu sesión no es válida. Escribe tu nombre para continuar.
              </p>
            ) : null}

            <label className={styles.label} htmlFor={inputId}>
              TU NOMBRE
            </label>
            <motion.div animate={shake}>
              <input
                ref={inputRef}
                id={inputId}
                className={styles.input}
                value={nickname}
                maxLength={NICKNAME_MAX}
                autoComplete="off"
                autoCapitalize="words"
                spellCheck={false}
                enterKeyHint="go"
                placeholder="ESCRIBE AQUÍ"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => {
                  setNickname(event.target.value)
                  setError(null)
                  dismissExpired()
                }}
              />
            </motion.div>
            <div className={styles.meta}>
              <p id={errorId} className={styles.error} role="alert">
                {error ?? ''}
              </p>
              <span className={styles.counter}>
                {String(nickname.trim().length).padStart(2, '0')}/{NICKNAME_MAX}
              </span>
            </div>

            <div className={styles.actions}>
              <motion.div {...glitchIn('left', 1.3)}>
                <PixelButton type="submit" size="lg" color="magenta" block disabled={pending}>
                  {pending ? '...' : 'CREAR SALA'}
                </PixelButton>
              </motion.div>
              <motion.div {...glitchIn('right', 1.45)}>
                <PixelButton
                  size="lg"
                  color="cyan"
                  block
                  disabled={pending}
                  onClick={() => void continueTo('/unirse')}
                >
                  UNIRSE
                </PixelButton>
              </motion.div>
            </div>
          </form>
        </Panel>
      </motion.div>

      {isMockEnabled() ? <span className={styles.mockTag}>MODO MOCK</span> : null}
    </main>
  )
}
