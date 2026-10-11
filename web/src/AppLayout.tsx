import { lazy, Suspense, useEffect } from 'react'
import { Outlet, useLocation, useMatches, useNavigate } from 'react-router'
import { useSessionState } from '@/api/session'
import { AnimatedBackground } from '@/components/AnimatedBackground/AnimatedBackground'

// El DevPanel solo existe en desarrollo: en producción este import se elimina del bundle.
const DevPanel = import.meta.env.DEV ? lazy(() => import('@/dev/DevPanel')) : null

/** Datos que una ruta puede declarar en `handle`. */
export interface RouteHandle {
  /** Intensidad del fondo animado: 'low' en pantallas de lectura (pregunta). */
  background?: 'high' | 'low'
}

/** Marco común: fondo animado persistente entre pantallas + manejo global de sesión caducada. */
export default function AppLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { expired } = useSessionState()
  const matches = useMatches()
  const intensity = (matches[matches.length - 1]?.handle as RouteHandle | undefined)?.background ?? 'high'

  // 401 en cualquier llamada → el cliente limpia la sesión; aquí se vuelve a Home con aviso.
  useEffect(() => {
    if (expired && pathname !== '/') navigate('/', { replace: true })
  }, [expired, pathname, navigate])

  return (
    <>
      <AnimatedBackground intensity={intensity} />
      <Outlet />
      {DevPanel ? (
        <Suspense fallback={null}>
          <DevPanel />
        </Suspense>
      ) : null}
    </>
  )
}
