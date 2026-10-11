import { createBrowserRouter } from 'react-router'
import AppLayout from './AppLayout'
import { RequireSession } from './components/RequireSession/RequireSession'
import CreateRoom from './screens/02-CreateRoom/CreateRoom'
import Home from './screens/01-Home/Home'
import Join from './screens/03-Join/Join'
import Lobby from './screens/04-Lobby/Lobby'
import Game from './screens/game/Game'
import ComingSoon from './screens/stubs/ComingSoon'

/** Rutas de la app. Las pantallas 10–15 (estadísticas, etc.) se añaden después. */
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/crear', element: <RequireSession><CreateRoom /></RequireSession> },
      { path: '/unirse', element: <RequireSession><Join /></RequireSession> },
      { path: '/sala/:code', element: <RequireSession><Lobby /></RequireSession> },
      // Partida: una sola ruta; la pantalla (05–09) la decide `phase` del estado del servidor.
      { path: '/partida/:gameId', element: <Game /> },
      { path: '*', element: <ComingSoon screen="404 · NO ENCONTRADO" /> },
    ],
  },
])
