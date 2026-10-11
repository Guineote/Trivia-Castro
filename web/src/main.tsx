import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import './styles/fonts'
import './styles/global.css'
import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // El polling gestiona sus propios reintentos; no refetch por foco para no duplicar peticiones.
      refetchOnWindowFocus: false,
      staleTime: 0,
    },
  },
})

async function bootstrap() {
  // Modo mock: cambia el transporte HTTP por el servidor falso antes de pintar nada.
  // La condición es estática → en producción sin VITE_USE_MOCK el mock no entra al bundle.
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    const { installMock } = await import('./mock/install')
    installMock()
  }

  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        {/* "user": con prefers-reduced-motion se desactivan las animaciones de transformación. */}
        <MotionConfig reducedMotion="user">
          <RouterProvider router={router} />
        </MotionConfig>
      </QueryClientProvider>
    </StrictMode>,
  )
}

void bootstrap()
