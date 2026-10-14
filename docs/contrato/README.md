# Contrato compartido — Trivia Castro (v0.2)

> Bloque C del plan de trabajo. Es la **fuente de verdad** para el frente A (API) y el frente B (Website). Si algo del contrato cambia, se avisa al otro integrante y se actualiza aquí **antes** de tocar código.
> Las decisiones D1 a D12 (sección 8) ya están **confirmadas**. Los puntos marcados como **[PROPUESTA]** en el texto corresponden a esas decisiones y ahora son parte del contrato.

Contenido de esta carpeta:

- `README.md` (este archivo): convenciones, errores, polling/ETag, enums y qué trae cada fase.
- `endpoints.md`: cada endpoint con su request, response y errores.
- `ejemplos/`: JSON de ejemplo listos para usar como mocks (un `state` por fase, sala, ranking y resultados).

## 1. Convenciones generales

- **Base URL:** `/api/v1`. Todas las rutas cuelgan de ahí.
- **Formato:** JSON, codificación UTF-8, nombres de campos en `camelCase`.
- **Ids:** siempre cadenas de texto (`"g8a3"`, `"p2"`, `"o1"`). El cliente no asume su formato.
- **Fechas:** ISO 8601 en UTC con `Z` (`2026-09-04T18:30:06Z`).
- **Autenticación:** `Authorization: Bearer <token>`. Obligatorio salvo `POST /players` y `GET /rooms/{code}`.
- **Listas:** las respuestas que devuelven listas las envuelven en un objeto (`{"items": [...]}`), nunca un arreglo suelto, para poder añadir campos sin romper al cliente.
- **Puntos y tiempo:** el cliente **nunca** envía puntajes ni tiempos. Solo envía la opción elegida; el servidor mide el tiempo de recepción.

### Player vs. Participant

- **Player** (`playerId`): quién eres, global. Se crea con `POST /players` y es lo que identifica el token.
- **Participant** (`participantId`): cómo te va en una sala concreta (puntos, vidas, estado). Se crea al crear o unirse a una sala.
- Los endpoints con `{id}` de jugador en una sala (`DELETE /rooms/{code}/players/{id}`) usan el **participantId**.
- El `participantId` propio llega en las respuestas de crear/unirse y en `state.me.participantId`. El Website lo guarda junto al token.

## 2. Errores

Todos los errores usan el mismo formato, con el código HTTP correspondiente:

```json
{
  "error": {
    "code": "ROOM_FULL",
    "message": "La sala está llena"
  }
}
```

- El Website decide qué mensaje mostrar a partir de **`error.code`**, no del texto. El `message` es de apoyo y de depuración.
- **Nota para el frente A:** FastAPI devuelve por defecto `{"detail": ...}`. Hay que registrar manejadores de excepciones (incluido el de validación de Pydantic) para devolver este formato.

| HTTP | `code` | Cuándo | Mensaje en pantalla |
|---|---|---|---|
| 401 | `UNAUTHORIZED` | Falta el token o es inválido | «Tu sesión no es válida» |
| 403 | `NOT_HOST` | Acción solo del host | «Solo el host puede hacer esto» |
| 403 | `FORBIDDEN` | Acción sobre otro jugador sin permiso | «No tienes permiso» |
| 403 | `NOT_IN_GAME` | Pide el estado de una partida en la que no participa | «No estás en esta partida» |
| 403 | `SPECTATOR_CANNOT_ACT` | Un espectador intenta responder o usar poderes | «Eres espectador» |
| 404 | `ROOM_NOT_FOUND` | El código de sala no existe | «No existe esa sala» |
| 404 | `GAME_NOT_FOUND` | La partida no existe | «No existe esa partida» |
| 409 | `ROOM_FULL` | Sala sin cupo | «La sala está llena» |
| 409 | `GAME_ALREADY_STARTED` | Unirse, modificar o iniciar cuando ya hay partida | «La partida ya comenzó» |
| 409 | `NOT_ENOUGH_PLAYERS` | Iniciar sin el mínimo de jugadores | «Faltan jugadores» |
| 409 | `NOT_ENOUGH_QUESTIONS` | No hay preguntas suficientes para las rondas pedidas | «No hay suficientes preguntas» |
| 409 | `ROUND_NOT_ACTIVE` | Responder o usar poder fuera de la fase `QUESTION` o en una ronda que no es la actual | «La ronda ya cerró» |
| 409 | `ALREADY_ANSWERED` | Segunda respuesta en la misma ronda (índice único en BD) | «Ya respondiste» |
| 409 | `POWER_NOT_AVAILABLE` | El poder no está en el inventario o ya se usó | «Ese poder no está disponible» |
| 409 | `ROUND_NOT_FINISHED` | Pedir resultados de una ronda aún no revelada | «Aún no hay resultados» |
| 409 | `GAME_NOT_FINISHED` | Pedir resultados finales antes de `FINAL` | «La partida aún no termina» |
| 409 | `GAME_FINISHED` | `advance` en una partida terminada | «La partida ya terminó» |
| 409 | `GAME_IN_PROGRESS` | Importar preguntas con una partida activa | «Hay una partida en curso» |
| 422 | `NICKNAME_TAKEN` | Nickname repetido en la sala | «Ese nombre ya está en uso» |
| 422 | `INVALID_OPTION` | La opción no pertenece a la pregunta | «Opción no válida» |
| 422 | `VALIDATION_ERROR` | Cuerpo o parámetros inválidos | «Revisa los datos» |
| 304 | — | `state` sin cambios (sin cuerpo) | no se muestra nada |

## 3. Polling, ETag y reloj

- El cliente consulta `GET /games/{id}/state` cada ~1 s.
- `version` es un entero que sube con **cada** cambio visible en la partida (alguien responde, cambia la fase, cambian puntos, etc.). El header `ETag` lleva `"<gameId>-v<version>"`, por ejemplo `"g8a3-v43"`.
- El cliente reenvía el último ETag en `If-None-Match`. Si la versión no cambió, el servidor responde **304 sin cuerpo** y el cliente no redibuja.
- La respuesta está **personalizada por token** (`me`), por eso debe incluir `Vary: Authorization`. Como todo lo que ve cada jugador cambia solo cuando la versión sube, el ETag basado en `version` es suficiente.
- **Reloj [PROPUESTA]:** todas las respuestas, **incluidas las 304**, llevan el header `X-Server-Time` con la hora del servidor. Así el cliente puede calcular el desfase de reloj incluso cuando no hay cuerpo:
  - En cada respuesta: `offset = serverTime − relojLocal`.
  - Contador: `restante = round.endsAt − (relojLocal + offset)`.
  - El contador es solo visual. El servidor decide cuándo cierra la ronda.

## 4. Enums

| Enum | Valores |
|---|---|
| `phase` | `ROUND_INTRO`, `QUESTION`, `REVEAL`, `SCOREBOARD`, `FINAL` |
| `roundType` | `NORMAL` (x1), `DOUBLE` (x2) |
| `powerType` | `DOUBLE`, `SHIELD`, `HINT` |
| `participantStatus` | `ACTIVE`, `SPECTATOR` |
| `roomStatus` | `WAITING`, `IN_GAME`, `FINISHED` |
| `difficulty` **[PROPUESTA]** | `EASY`, `MEDIUM`, `HARD` (el puntaje base de cada una sigue pendiente) |

Duraciones de fase (las controla el servidor): `ROUND_INTRO` 3 s, `QUESTION` 20 s, `REVEAL` 4 s, `SCOREBOARD` 6 s. `FINAL` no tiene límite.

## 5. Qué trae `state` en cada fase

`round.endsAt` es el momento en que **termina la fase actual**, no solo la pregunta. Los campos que no aplican vienen en `null`, no se omiten, para que el cliente no tenga que adivinar.

| Campo | ROUND_INTRO | QUESTION | REVEAL | SCOREBOARD | FINAL |
|---|---|---|---|---|---|
| `round` | sí | sí | sí | sí | `null` |
| `round.type` | sí | sí | sí | sí | — |
| `round.question` | `null` | texto y opciones, **sin** `isCorrect` | opciones **con** `isCorrect` | `null` | — |
| `me.lastResult` | `null` | `null` | resultado propio | resultado propio | `null` |
| `players[].pointsThisRound` | `null` | `null` | puntos de la ronda | `null` | `null` |
| `ranking` | `null` | `null` | `null` | lista con `positionDelta` | lista final |
| `winner` | `null` | `null` | `null` | `null` | ganador |

Campos de `me` y de cada elemento de `players` (ver `ejemplos/`):

- `me`: `participantId`, `score`, `lives`, `status`, `hasAnswered`, `powers` (inventario disponible), `activePower` (poder activado en esta ronda o `null`), `lastResult`.
- `players[]` (solo lo público): `participantId`, `nickname`, `score`, `lives`, `status`, `isHost`, `hasAnswered`, `pointsThisRound`. No incluye qué respondió cada uno ni sus poderes.
- Los espectadores siguen recibiendo el `state` completo (ven la pregunta), pero no pueden responder.

## 6. Flujo sala de espera → partida

1. El Website consulta `GET /rooms/{code}` (público) cada ~1 s mientras está en la sala de espera, para ver quién entra.
2. Cuando el host llama `POST /rooms/{code}/games`, `GET /rooms/{code}` empieza a devolver `currentGameId` (antes era `null`) y `status: "IN_GAME"`.
3. Al ver `currentGameId`, todos los clientes pasan a hacer polling de `GET /games/{currentGameId}/state`.
4. **Revancha (D13):** con la sala en `FINISHED`, el host vuelve a llamar `POST /rooms/{code}/games`. `GET /rooms/{code}` pasa a devolver el `currentGameId` nuevo y `status: "IN_GAME"`. Los clientes que siguen en la pantalla final consultan la sala y, al ver un `currentGameId` distinto del que están viendo, pasan a la partida nueva.

## 7. Reglas de negocio que el contrato da por hechas

- Una sola respuesta por participante y ronda (índice único `(roundId, participantId)` en la base de datos).
- Los poderes se usan **antes** de responder.
- Fallar da 0 puntos y quita 1 vida; el puntaje nunca baja. Sin vidas, el participante pasa a `SPECTATOR`.
- La respuesta correcta solo se publica en `REVEAL`. `POST .../answers` **no** dice si acertó.
- El bonus de velocidad es una función aislada en el servidor; su fórmula sigue **pendiente**. Los valores de los ejemplos (316 por 4.2 s) son solo ilustrativos.

## 8. Decisiones confirmadas (D1 a D13)

Confirmadas por ambos integrantes. Cualquier cambio posterior se anota aquí.

- [x] **D1.** La sala de espera usa `GET /rooms/{code}` con `currentGameId`, y pasa a `/games/{id}/state` al iniciar (sección 6).
- [x] **D2.** Crear una sala agrega automáticamente al creador como participante y host.
- [x] **D3.** `POST /rooms/{code}/players` acepta un `nickname` opcional (por defecto, el del jugador), para poder resolver el 422 sin crear otro jugador. Si el jugador ya es participante, responde 200 con su mismo `participantId` (sirve para la reconexión).
- [x] **D4.** Valores por defecto de `settings`: `maxPlayers` 8, `rounds` 10, `lives` 3, `categoryIds` vacío (todas). Mínimo para iniciar: 2 jugadores (1 en desarrollo). Nickname de 2 a 20 caracteres. 4 opciones por pregunta, exactamente 1 correcta.
- [x] **D5.** Dificultades `EASY`, `MEDIUM`, `HARD`.
- [x] **D6.** Efecto de `HINT`: el servidor quita 2 opciones incorrectas de `round.question.options` en el `state` personalizado de ese jugador. Efecto de `SHIELD`: evita perder la vida al fallar. Efecto de `DOUBLE`: multiplica x2 los puntos de la ronda (`mult_poder`). Si la ronda también es `DOUBLE`, los multiplicadores se combinan (x2 por ronda por x2 por poder = x4).
- [x] **D7.** `positionDelta = posiciónAnterior − posiciónActual` (positivo = subió, negativo = bajó).
- [x] **D8.** Header `X-Server-Time` en todas las respuestas, incluidas las 304.
- [x] **D9.** `GET /questions` y `POST /questions` incluyen `isCorrect` y son solo de administración de contenido; el Website no los usa durante una partida.
- [x] **D10.** Formato de error propio (sección 2) en lugar del `detail` de FastAPI.
- [x] **D11.** Si el host sale de la sala, el rol pasa al participante más antiguo.
- [x] **D12.** Estadísticas finales (pantalla 13): aciertos, tiempo medio de respuesta, respuesta más rápida y mejor ronda por jugador (ver `ejemplos/results.json`).
- [ ] **D13 [PROPUESTA, pendiente de aprobar con el PR].** Revancha en la misma sala: `POST /rooms/{code}/games` también se acepta con la sala en `FINISHED` (solo el host). Crea una partida nueva con los **mismos participantes y ajustes**; puntaje, vidas, estado (`ACTIVE`) e inventario de poderes se **reinician**, la sala vuelve a `IN_GAME` y `currentGameId` pasa al id nuevo. Con una partida en curso sigue respondiendo `409 GAME_ALREADY_STARTED`. Las partidas anteriores siguen existiendo. **Limitación conocida:** `DELETE` de un participante fuera de `WAITING` conserva su fila (por el historial de la partida), así que quien se va igualmente entra a la revancha sin responder; si estorba, habría que añadir un indicador de ausente.
