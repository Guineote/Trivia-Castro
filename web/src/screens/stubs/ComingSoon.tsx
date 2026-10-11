import { motion } from 'motion/react'
import { Navigate, useNavigate } from 'react-router'
import { useSession } from '@/api/session'
import { Panel } from '@/components/Panel/Panel'
import { PixelButton } from '@/components/PixelButton/PixelButton'
import { glitchIn } from '@/lib/motion'
import styles from './ComingSoon.module.css'

interface ComingSoonProps {
  /** Nombre de la pantalla pendiente (numeración de docs/frontend/pantallas-spec.md). */
  screen: string
  /** Si la pantalla requiere haber pasado por Home (token guardado). */
  requireSession?: boolean
}

/** Marcador de pantallas que se construyen en las siguientes sesiones. */
export default function ComingSoon({ screen, requireSession = false }: ComingSoonProps) {
  const navigate = useNavigate()
  const session = useSession()
  if (requireSession && !session) return <Navigate to="/" replace />

  return (
    <main className={styles.page}>
      <motion.div className={styles.wrap} {...glitchIn('bottom')}>
        <Panel title="PRÓXIMAMENTE" tilt={-1}>
          <div className={styles.body}>
            <h1 className={styles.title}>{screen}</h1>
            {session ? <p className={styles.text}>Sesión lista: {session.nickname}</p> : null}
            <p className={styles.text}>Esta pantalla se construye en la siguiente sesión.</p>
            <PixelButton color="yellow" onClick={() => navigate('/')}>
              VOLVER
            </PixelButton>
          </div>
        </Panel>
      </motion.div>
    </main>
  )
}
