import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useSession } from '@/api/session'

/** Las pantallas que usan el token requieren haber pasado por Home (POST /players). */
export function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession()
  return session ? children : <Navigate to="/" replace />
}
