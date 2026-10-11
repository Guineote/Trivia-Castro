import { useReconnecting } from '@/api/stats'
import styles from './ReconnectBanner.module.css'

/** "RECONECTANDO..." cuando el polling lleva varios fallos seguidos. No bloquea nada: se recupera solo. */
export function ReconnectBanner() {
  const reconnecting = useReconnecting()
  return reconnecting ? (
    <div className={styles.banner} role="status">
      RECONECTANDO...
    </div>
  ) : null
}
