/** Título (Press Start, sin acentos) y pista (texto normal) de las pantallas de error, por error.code. */
export const ERROR_SCREENS: Record<string, { title: string; hint: string }> = {
  ROOM_FULL: { title: 'SALA LLENA', hint: 'No quedan lugares. Pídele al host que amplíe el cupo o prueba con otra sala.' },
  ROOM_NOT_FOUND: { title: 'SALA NO EXISTE', hint: 'Revisa el código: son 6 letras y números.' },
  GAME_ALREADY_STARTED: { title: 'YA EMPEZO', hint: 'La partida ya comenzó. Espera a que termine para jugar otra.' },
  GAME_NOT_FOUND: { title: 'SIN PARTIDA', hint: 'Esa partida no existe o ya se cerró.' },
  NOT_IN_GAME: { title: 'NO ESTAS DENTRO', hint: 'Tu jugador no forma parte de esta partida.' },
  GAME_NOT_FINISHED: { title: 'AUN NO TERMINA', hint: 'Los resultados aparecen cuando acaba la última ronda.' },
  UNAUTHORIZED: { title: 'SESION INVALIDA', hint: 'Vuelve al inicio y escribe tu nombre otra vez.' },
  NETWORK_ERROR: { title: 'SIN CONEXION', hint: 'No se pudo hablar con el servidor.' },
}

export const DEFAULT_ERROR_SCREEN = { title: 'ERROR', hint: 'Algo salió mal.' }
