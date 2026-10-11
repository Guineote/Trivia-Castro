import { lazy, Suspense, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { useSessionState } from '@/api/session'
import { AnimatedBackground } from '@/components/AnimatedBackground/AnimatedBackground'
import { CrtOverlay } from '@/components/CrtOverlay/CrtOverlay'
import { SettingsTools } from '@/components/SettingsTools/SettingsTools'
import { useBackground } from '@/lib/background'
import { useFloatingTools } from '@/lib/prefs'

// El DevPanel solo existe en desarrollo: en producción este import se elimina del bundle.
const DevPanel = import.meta.env.DEV ? lazy(() => import('@/dev/DevPanel')) : null

/** Marco común: fondo animado persistente entre pantallas + manejo global de sesión caducada. */
export default function AppLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { expired } = useSessionState()
  const intensity = useBackground()
  const floatingTools = useFloatingTools()

  // 401 en cualquier llamada → el cliente limpia la sesión; aquí se vuelve a Home con aviso.
  useEffect(() => {
    if (expired && pathname !== '/') navigate('/', { replace: true })
  }, [expired, pathname, navigate])

  return (
    <>
      <AnimatedBackground intensity={intensity} />
      <Outlet />
      {floatingTools ? <SettingsTools /> : null}
      <CrtOverlay />
      {DevPanel ? (
        <Suspense fallback={null}>
          <DevPanel />
        </Suspense>
      ) : null}
    </>
  )
}
