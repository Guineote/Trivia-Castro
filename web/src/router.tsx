import { createBrowserRouter } from 'react-router'
import AppLayout from './AppLayout'
import Home from './screens/01-Home/Home'
import ComingSoon from './screens/stubs/ComingSoon'

/** Rutas de esta sesión. Las demás pantallas (02-15 de pantallas-spec.md) se añaden después. */
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/crear', element: <ComingSoon screen="02 · CREAR SALA" requireSession /> },
      { path: '/unirse', element: <ComingSoon screen="03 · UNIRSE" requireSession /> },
      { path: '*', element: <ComingSoon screen="404 · NO ENCONTRADO" /> },
    ],
  },
])
