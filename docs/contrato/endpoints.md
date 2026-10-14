# Endpoints — Trivia Castro (borrador v0.1)

Todas las rutas cuelgan de `/api/v1`. Convenciones, errores y enums: ver `README.md`. Los JSON completos están en `ejemplos/`.

Leyenda de auth: 🔓 público · 🔑 Bearer obligatorio · 👑 solo host de la sala.

---

## Sesión y salas

### `POST /players` 🔓
Crea un jugador y devuelve su token. Sin cuentas, contraseñas ni correo.

- **Request:** `{ "nickname": "Ana" }` (2 a 20 caracteres)
- **201:** `{ "playerId": "p1", "nickname": "Ana", "token": "9f2c1a7e..." }`
- **Errores:** 422 `VALIDATION_ERROR`
- El Website guarda el token (por ejemplo en `localStorage`) y lo envía en todas las demás llamadas.

### `POST /rooms` 🔑
Crea una sala. El creador queda como host y como primer participante **[D2]**. El código de 6 caracteres lo genera el servidor.

- **Request (todo opcional):** `{ "settings": { "maxPlayers": 8, "rounds": 10, "lives": 3, "categoryIds": [] } }`
- **201:** igual que `GET /rooms/{code}` más `participantId` (el del creador). Ver `ejemplos/room.json`.
- **Errores:** 401, 422

### `GET /rooms/{code}` 🔓
Estado de la sala de espera. Se consulta cada ~1 s en la pantalla 04.

- **200:** `code`, `status` (`WAITING | IN_GAME | FINISHED`), `hostParticipantId`, `settings`, `participants[]` (`participantId`, `nickname`, `isHost`), `currentGameId` (`null` hasta que inicia la partida).
- **Errores:** 404 `ROOM_NOT_FOUND`

### `PATCH /rooms/{code}` 👑
Cambia los ajustes de la sala antes de iniciar.

- **Request:** `{ "settings": { "rounds": 12 } }` (solo los campos que cambian)
- **200:** la sala actualizada.
- **Errores:** 401, 403 `NOT_HOST`, 404 `ROOM_NOT_FOUND`, 409 `GAME_ALREADY_STARTED`, 422

### `POST /rooms/{code}/players` 🔑
Unirse a una sala (pantalla 03).

- **Request (opcional):** `{ "nickname": "Beto" }`. Si se omite, se usa el del jugador **[D3]**.
- **201:** `{ "participantId": "pt2", "participants": [ ... ] }`
- **200:** si el jugador ya era participante, devuelve el mismo `participantId` (reconexión) **[D3]**.
- **Errores:** 401, 404 `ROOM_NOT_FOUND`, 409 `ROOM_FULL`, 409 `GAME_ALREADY_STARTED`, 422 `NICKNAME_TAKEN`
- **Mensajes en pantalla:** 404 «no existe esa sala» · 409 «la sala está llena» · 422 «ese nombre ya está en uso».

### `DELETE /rooms/{code}/players/{participantId}` 🔑
Salir de la sala, o expulsar a alguien si quien llama es el host.

- **204:** sin cuerpo.
- Si sale el host, el rol pasa al participante más antiguo **[D11]**.
- **Errores:** 401, 403 `FORBIDDEN`, 404 `ROOM_NOT_FOUND`

### `POST /rooms/{code}/games` 👑
Inicia la partida desde la sala de espera (botón INICIAR). El servidor elige preguntas, crea las rondas y arranca el scheduler en `ROUND_INTRO`.

**Revancha (D13, propuesta):** también se acepta con la sala en `FINISHED` (botón JUGAR OTRA VEZ del host): misma sala, mismos participantes y ajustes, con puntaje, vidas y poderes reiniciados.

- **Request:** vacío.
- **201:** `{ "gameId": "g8a3", "phase": "ROUND_INTRO", "version": 1 }`
- **Errores:** 401, 403 `NOT_HOST`, 404 `ROOM_NOT_FOUND`, 409 `GAME_ALREADY_STARTED`, 409 `NOT_ENOUGH_PLAYERS`, 409 `NOT_ENOUGH_QUESTIONS`

---

## Partida

### `GET /games/{id}/state` 🔑
**Recurso central.** Las 8 pantallas de partida se dibujan solo desde aquí. Ver `README.md` sección 3 (ETag y reloj) y sección 5 (qué trae cada fase).

- **Headers de request:** `If-None-Match: "g8a3-v43"` (opcional)
- **200:** ver `ejemplos/state-*.json`. Headers: `ETag`, `Vary: Authorization`, `X-Server-Time`.
- **304:** sin cuerpo si la versión no cambió.
- **Errores:** 401, 403 `NOT_IN_GAME`, 404 `GAME_NOT_FOUND`

### `POST /games/{id}/rounds/{n}/answers` 🔑
Responder la ronda `n`. El servidor mide el tiempo, valida y calcula los puntos. **No revela si acertó** (eso sale en `REVEAL`).

- **Request:** `{ "optionId": "o2" }`. No se envía puntaje ni tiempo.
- **202:** `{ "accepted": true }` (el `state` ahora trae `me.hasAnswered: true`)
- **Errores:** 401, 403 `SPECTATOR_CANNOT_ACT`, 404 `GAME_NOT_FOUND`, 409 `ROUND_NOT_ACTIVE`, 409 `ALREADY_ANSWERED`, 422 `INVALID_OPTION`

### `POST /games/{id}/rounds/{n}/powers` 🔑
Activar un poder **antes** de responder (pantalla 07).

- **Request:** `{ "powerType": "HINT" }`
- **200:** `{ "powerType": "HINT", "effect": { "removedOptionIds": ["o1", "o4"] } }` para `HINT`. Para `DOUBLE` y `SHIELD`: `{ "powerType": "...", "effect": {} }`. El `state` refleja el poder en `me.activePower` y lo quita de `me.powers`.
- **Errores:** 401, 403 `SPECTATOR_CANNOT_ACT`, 409 `ROUND_NOT_ACTIVE`, 409 `POWER_NOT_AVAILABLE`, 409 `ALREADY_ANSWERED`, 422 `VALIDATION_ERROR`
- El efecto exacto de `DOUBLE` y `SHIELD` sigue **pendiente** (README, D6).

### `GET /games/{id}/rounds/{n}/results` 🔑
Resultados de una ronda ya revelada. Sirve para repasar; la pantalla 09 se dibuja desde `state` en `REVEAL`.

- **200:** ver `ejemplos/round-results.json`.
- **Errores:** 401, 404 `GAME_NOT_FOUND`, 409 `ROUND_NOT_FINISHED`

### `GET /games/{id}/ranking` 🔑
Ranking acumulado (pantalla 10).

- **200:** ver `ejemplos/ranking.json`. `positionDelta = posiciónAnterior − posiciónActual` **[D7]**.
- **Errores:** 401, 404 `GAME_NOT_FOUND`

### `GET /games/{id}/results` 🔑
Resultados finales y estadísticas (pantallas 12 y 13).

- **200:** ver `ejemplos/results.json`.
- **Errores:** 401, 404 `GAME_NOT_FOUND`, 409 `GAME_NOT_FINISHED`

### `POST /games/{id}/advance` 👑
El host adelanta la fase actual. El juego nunca depende de esta llamada; es solo un atajo.

- **Request:** vacío.
- **200:** `{ "phase": "REVEAL", "version": 44 }`
- **Errores:** 401, 403 `NOT_HOST`, 404 `GAME_NOT_FOUND`, 409 `GAME_FINISHED`

---

## Contenido (administración; no se usa durante una partida) **[D9]**

### `GET /categories` 🔑
- **200:** `{ "items": [ { "id": "c1", "name": "Videojuegos" }, ... ] }` (10 categorías)

### `GET /questions` 🔑
- **Query:** `categoryId`, `difficulty`, `limit` (por defecto 20), `offset`
- **200:** `{ "items": [ { "id": "q1", "text": "...", "categoryId": "c1", "difficulty": "MEDIUM", "options": [ { "id": "o1", "text": "...", "isCorrect": false } ] } ], "total": 120 }`

### `POST /questions` 🔑
- **Request:** `{ "text": "...", "categoryId": "c1", "difficulty": "EASY", "options": [ { "text": "...", "isCorrect": true }, ... ] }` con 4 opciones y exactamente 1 correcta.
- **201:** la pregunta creada.
- **Errores:** 401, 422 `VALIDATION_ERROR`

### `POST /questions/import` 🔑 *(opcional)*
Importa preguntas de la API externa. Normaliza y deduplica por `externalId`. Nunca corre durante una partida.

- **Request:** `{ "amount": 50, "categoryId": "c1" }`
- **200:** `{ "imported": 42, "duplicates": 8 }`
- **Errores:** 401, 409 `GAME_IN_PROGRESS`
