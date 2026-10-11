import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useGameState } from '@/api/hooks'
import { ApiError, errorMessage } from '@/api/errors'
import { useSession } from '@/api/session'
import type { GameState } from '@/api/types'
import { ErrorPanel } from '@/components/ErrorPanel/ErrorPanel'
import { PhaseCurtain } from '@/components/PhaseCurtain/PhaseCurtain'
import { ReconnectBanner } from '@/components/ReconnectBanner/ReconnectBanner'
import { setBackground } from '@/lib/background'
import RoundIntro from '../05-RoundIntro/RoundIntro'
import Question from '../06-Question/Question'
import Reveal from '../07-Reveal/Reveal'
import Scoreboard from '../08-Scoreboard/Scoreboard'
import Final from '../09-Final/Final'
import styles from './Game.module.css'
import { useMaxLives, useShownState } from './useShownState'

/** Texto que se anuncia a lectores de pantalla en cada cambio de fase. */
function announcement(state: GameState): string {
  const { round } = state
  switch (state.phase) {
    case 'ROUND_INTRO':
      return `Ronda ${round?.number} de ${round?.totalRounds}${round?.type === 'DOUBLE' ? ', ronda doble' : ''}`
    case 'QUESTION':
      return 'Nueva pregunta'
    case 'REVEAL':
      return 'Resultado de la ronda'
    case 'SCOREBOARD':
      return 'Marcador'
    case 'FINAL':
      return 'Fin de la partida'
  }
}

/**
 * Contenedor de la partida: hace polling de GET /games/{id}/state y elige la pantalla por `phase`.
 * Toda la lógica de transición es del servidor; aquí solo se dibuja lo que llega.
 */
export default function Game() {
  const { gameId = '' } = useParams()
  const navigate = useNavigate()
  const session = useSession()
  const query = useGameState(session ? gameId : undefined)
  const live = query.data
  const { shown, curtainKey } = useShownState(live)
  const maxLives = useMaxLives(live?.me.lives)

  // Fondo con menos intensidad mientras se lee la pregunta.
  const phase = shown?.phase
  useEffect(() => {
    setBackground(phase === 'QUESTION' ? 'low' : 'high')
    return () => setBackground('high')
  }, [phase])

  // Sin sesión no hay partida que ver (p. ej. tras borrar el token): de vuelta a Home.
  if (!session) return <Navigate to="/" replace />

  // Errores que no se arreglan reintentando (partida inexistente, no estás en ella…). Los de red se reintentan solos.
  const error = query.error
  const fatalError =
    !live && error instanceof ApiError && error.code !== 'NETWORK_ERROR' && error.code !== 'UNAUTHORIZED' ? error : null

  let screen
  if (shown) {
    const props = { gameId, state: shown, maxLives }
    switch (shown.phase) {
      case 'ROUND_INTRO':
        screen = <RoundIntro {...props} />
        break
      case 'QUESTION':
        screen = <Question {...props} />
        break
      case 'REVEAL':
        screen = <Reveal {...props} />
        break
      case 'SCOREBOARD':
        screen = <Scoreboard {...props} />
        break
      case 'FINAL':
        screen = <Final {...props} />
        break
    }
  } else if (fatalError) {
    screen = <ErrorPanel message={errorMessage(fatalError.code)} onBack={() => navigate('/')} />
  } else {
    screen = (
      <main className={styles.center}>
        <p className={styles.loading}>CARGANDO...</p>
      </main>
    )
  }

  return (
    <>
      {screen}
      <PhaseCurtain runKey={curtainKey} />
      <ReconnectBanner />
      <p className="sr-only" aria-live="polite">
        {shown ? announcement(shown) : ''}
      </p>
    </>
  )
}
