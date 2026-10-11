> **Documento histórico de la etapa 2.** El contrato (`docs/contrato/`) manda. Este archivo puede mencionar rondas FAST/BOMB, 5 poderes o estados ALIVE/ELIMINATED que NO existen en el contrato. Nombre del juego: Trivia Chaos.

# Trivia Chaos — Documentación de la API

**Versión del documento:** 1.0
**Etapa:** Segunda entrega
**Versión de la API:** v1

---

## 1. Introducción

Trivia Chaos es un videojuego web multijugador de trivia por salas. Varios jugadores se
unen a una sala mediante un código y compiten respondiendo preguntas contrarreloj, con
vidas, poderes y rondas especiales.

La API de Trivia Chaos **no es un catálogo de preguntas**: es el motor del juego. Toda la
lógica que puede afectar el resultado de una partida vive en el servidor.

### 1.1 Qué hace la API

| Responsabilidad | Detalle |
|---|---|
| Identidad | Emite sesiones de jugador sin necesidad de cuentas |
| Salas | Crea, valida y administra salas por código |
| Partidas | Máquina de estados, avance de rondas y control del reloj |
| Preguntas | Selección, entrega sin filtrar la respuesta correcta, importación externa |
| Reglas | Validación de respuestas, cálculo de puntos, vidas, poderes |
| Consulta | Estado en vivo, ranking, resultados y estadísticas |

### 1.2 Qué NO hace la API

- No renderiza interfaz.
- No confía en ningún dato de tiempo, puntaje o validez enviado por el cliente.
- No consulta la API externa de trivia durante una partida en curso.

---

## 2. Arquitectura general

```
┌────────────────────────┐
│  API externa de trivia │   (Open Trivia DB u similar)
│  Solo importación      │
└───────────┬────────────┘
            │  proceso manual/programado, FUERA de la partida
            ▼
┌─────────────────────────────────────────────┐
│           Trivia Chaos API (REST)           │
│                                             │
│  Capa HTTP      → controladores, validación │
│  Capa dominio   → reglas del juego          │
│  Capa datos     → repositorios              │
│  Scheduler      → avance automático de fase │
└───────────┬─────────────────────────────────┘
            │
            ▼
┌────────────────────────┐        ┌────────────────────────┐
│    Base de datos       │        │       Website          │
│    relacional          │◀──────▶│  (cliente del juego)   │
└────────────────────────┘  HTTP  └────────────────────────┘
```

**Punto clave:** la partida en vivo solo toca la base de datos propia. La API externa es
una fuente de contenido, no una dependencia en tiempo de ejecución.

### 2.1 Stack recomendado

| Capa | Recomendación | Alternativa |
|---|---|---|
| API | Node.js + Express | ASP.NET Core Web API |
| Base de datos | PostgreSQL (SQLite en desarrollo) | SQL Server |
| Frontend | React (Vite) | HTML + JS con Fetch |

Un solo servicio, un solo repositorio. **No microservicios**: no hay ningún requisito que
los justifique y multiplicarían el costo de implementación.

---

## 3. Decisiones de diseño

Cada decisión indica la alternativa descartada y el costo de implementación.

### D-01 · Sincronización entre jugadores → **Polling de estado**

**Propuesta:** un único endpoint `GET /api/v1/games/{gameId}/state` que el cliente consulta
cada ~1 s usando `ETag` / `If-None-Match`. Si nada cambió, el servidor responde `304 Not
Modified` sin cuerpo.

**Por qué:** es la opción que mejor se documenta y se explica en una exposición de API,
mantiene todo el sistema dentro de HTTP/REST, y no requiere infraestructura adicional.

**Alternativas:** WebSockets (mejor latencia, pero el protocolo deja de ser REST y complica
la documentación y el despliegue) y SSE (punto intermedio).

**Dificultad:** baja. **Migración futura:** el estado ya está modelado como un recurso
único, así que cambiar a SSE/WebSockets solo reemplaza el transporte de ese endpoint; el
resto de la API no se toca.

### D-02 · Autenticación → **Token de sesión efímero**

`POST /api/v1/players` devuelve `playerId` + `token`. Todas las peticiones posteriores
llevan `Authorization: Bearer <token>`.

**Por qué:** sin esto, cualquiera con el `playerId` de otro podría responder por él o gastar
sus poderes. No se requieren cuentas, contraseñas ni correo.

**Alternativas:** ninguna autenticación (inseguro y no demostrable) o cuentas completas
(fuera de alcance).

**Dificultad:** baja. Un UUID guardado en tabla, o un JWT firmado sin persistencia.

### D-03 · Autoridad del reloj → **Servidor**

El servidor guarda `startedAt` y `endsAt` de cada ronda y devuelve `serverTime` en cada
respuesta. El cliente calcula el contador como `endsAt - serverTime` y corrige su desfase.
El tiempo de respuesta que puntúa es el de **recepción en el servidor**.

**Por qué:** el bonus por velocidad es directamente manipulable si lo mide el cliente.

**Dificultad:** baja.

### D-04 · Vista pública vs. interna de la pregunta

La entidad `Question` almacena `isCorrect` en cada opción, pero el serializador público
**nunca** lo expone durante la fase `QUESTION`. La respuesta correcta aparece únicamente en
la fase `REVEAL`.

**Dificultad:** baja, pero es un error clásico. Debe estar cubierto por una prueba.

### D-05 · Crear e iniciar partida → **Una sola operación**

`POST /api/v1/rooms/{code}/games` crea la partida **e inicia** la cuenta regresiva.

**Por qué:** en el diseño original `POST /api/games` seguido de `POST /api/games/{id}/start`
dejaba una partida en un estado intermedio sin utilidad y con posibilidad de quedar huérfana.

**Alternativa:** conservar los dos pasos si más adelante quieren una fase de configuración
posterior a la creación (hoy esa configuración vive en la sala).

### D-06 · Deadline por jugador

Los poderes **Tiempo extra** y **Bomba** modifican el tiempo de un jugador concreto. Por eso
cada participante tiene su propio `answerDeadline`, inicializado con el `endsAt` de la ronda.

La ronda avanza cuando **todos** respondieron o cuando se alcanza el mayor `answerDeadline`.

**Dificultad:** media. Si el equipo quiere reducir alcance, la alternativa es eliminar ambos
poderes de v1 y usar un único deadline por ronda.

### D-07 · Jugador sin vidas → **Espectador**

Al llegar a 0 vidas el participante pasa a `SPECTATOR`: sigue viendo preguntas, resultados y
ranking, pero no puede responder ni usar poderes.

**Por qué:** eliminar a un jugador en el minuto 2 de una partida de 10 rondas arruina la
experiencia y vacía la sala.

**Alternativa:** eliminación dura (`ELIMINATED`), configurable por sala.

### D-08 · Alcance de rondas especiales en v1

| Ronda | Valor | Dificultad | v1 |
|---|---|---|---|
| Normal | Base | — | ✅ |
| Doble | Alto (multiplicador ×2, casi gratis) | Muy baja | ✅ |
| Rápida | Alto (cambia el ritmo) | Muy baja | ✅ |
| Bomba | Medio (el último en responder pierde vida) | Baja | ✅ |
| Final con apuestas | Muy alto (cierre dramático) | Media (fase de apuesta extra) | ⚠️ v1.1 |
| Mayoría | Medio | Media-alta (puntuación sin respuesta correcta) | ❌ v2 |

**Nota:** *Doble* y *Rápida* son solo campos de configuración de la ronda, no lógica nueva.
La *ronda mayoría* requiere una vía de puntuación paralela; es la única que realmente
duplica la complejidad del cálculo.

---

## 4. Modelo de datos

### 4.1 Diagrama entidad-relación

```mermaid
erDiagram
    PLAYER ||--o{ PARTICIPANT : "juega como"
    ROOM   ||--o{ PARTICIPANT : "aloja"
    ROOM   ||--o{ GAME : "contiene"
    GAME   ||--o{ ROUND : "se divide en"
    ROUND  }o--|| QUESTION : "usa"
    QUESTION ||--o{ OPTION : "tiene"
    CATEGORY ||--o{ QUESTION : "clasifica"
    ROUND  ||--o{ SUBMITTED_ANSWER : "recibe"
    PARTICIPANT ||--o{ SUBMITTED_ANSWER : "envía"
    PARTICIPANT ||--o{ PARTICIPANT_POWER : "posee"
    PARTICIPANT_POWER ||--o| POWER_USE : "se consume en"
    ROUND ||--o{ POWER_USE : "registra"
```

### 4.2 Entidades

#### Player
Identidad efímera. No hay registro ni contraseña.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `nickname` | string(3–16) | Único dentro de una sala, no global |
| `avatarId` | string | Referencia a avatar predefinido |
| `token` | string | Secreto de sesión. **Nunca** se devuelve en listados |
| `createdAt` | timestamp | |

#### Room
Sala identificada por código corto.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `code` | string(6) | Alfanumérico en mayúsculas, sin caracteres ambiguos (0/O, 1/I) |
| `hostPlayerId` | UUID | FK → Player |
| `status` | enum | `WAITING`, `IN_GAME`, `CLOSED` |
| `settings` | json | Ver §4.3 |
| `createdAt` / `expiresAt` | timestamp | Las salas caducan (p. ej. 3 h) |

#### Participant
Un jugador **dentro** de una sala. Aquí vive el estado de juego.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `roomId` / `playerId` | UUID | FK |
| `score` | int | Acumulado en la partida actual |
| `lives` | int | |
| `status` | enum | `ALIVE`, `SPECTATOR`, `ELIMINATED`, `DISCONNECTED` |
| `isHost` | bool | |
| `answerDeadline` | timestamp | Ver D-06 |
| `joinedAt` | timestamp | |

#### Game

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `roomId` | UUID | FK. Una sala puede jugar varias partidas |
| `status` | enum | Ver §5 |
| `phase` | enum | Ver §5 |
| `currentRoundNumber` | int | |
| `settingsSnapshot` | json | Copia de la configuración al iniciar |
| `version` | int | Se incrementa en cada cambio. Base del `ETag` |
| `startedAt` / `endedAt` | timestamp | |

> `version` es el mecanismo que hace barato el polling: el `ETag` es simplemente
> `"g{gameId}-v{version}"`.

#### Round

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `gameId` | UUID | FK |
| `number` | int | 1..N |
| `type` | enum | `NORMAL`, `FAST`, `DOUBLE`, `BOMB`, `FINAL_BET` |
| `questionId` | UUID | FK |
| `status` | enum | `PENDING`, `ACTIVE`, `REVEALED`, `CLOSED` |
| `startedAt` / `endsAt` | timestamp | |

#### Question / Option / Category

| Question | Tipo | Notas |
|---|---|---|
| `id` | UUID | |
| `text` | string | |
| `categoryId` | UUID | FK |
| `difficulty` | enum | `EASY`, `MEDIUM`, `HARD` |
| `source` | enum | `MANUAL`, `IMPORTED` |
| `externalId` | string | Para deduplicar importaciones |

| Option | Tipo | Notas |
|---|---|---|
| `id` | UUID | |
| `questionId` | UUID | FK |
| `text` | string | |
| `isCorrect` | bool | **Nunca expuesto en fase QUESTION** |

Categorías: Historia, Ciencia, Geografía, Música, Cine, Videojuegos, Deportes, Arte,
Tecnología, Cultura general.

#### SubmittedAnswer

| Campo | Tipo | Notas |
|---|---|---|
| `id`, `roundId`, `participantId` | UUID | Índice único `(roundId, participantId)` |
| `optionId` | UUID | `null` si no respondió |
| `responseTimeMs` | int | Calculado en el servidor |
| `isCorrect` | bool | |
| `pointsAwarded` | int | |
| `livesLost` | int | |

> El índice único es lo que impide responder dos veces. No lo dejen a nivel de aplicación.

#### ParticipantPower / PowerUse

| ParticipantPower | Tipo |
|---|---|
| `id`, `participantId` | UUID |
| `powerType` | enum |
| `usedAt` | timestamp (null = disponible) |

| PowerUse | Tipo |
|---|---|
| `id`, `roundId`, `participantId` | UUID |
| `powerType` | enum |
| `targetParticipantId` | UUID (solo `BOMB`) |
| `effectPayload` | json (p. ej. opciones eliminadas por `HINT`) |

### 4.3 Configuración de sala (`settings`)

```json
{
  "maxPlayers": 8,
  "totalRounds": 10,
  "startingLives": 3,
  "questionDurationMs": 20000,
  "fastRoundDurationMs": 10000,
  "categories": ["ciencia", "videojuegos", "cine"],
  "difficulties": ["EASY", "MEDIUM"],
  "powersEnabled": true,
  "onZeroLives": "SPECTATOR",
  "specialRoundsEnabled": true
}
```

---

## 5. Máquina de estados de la partida

```mermaid
stateDiagram-v2
    [*] --> LOBBY
    LOBBY --> ROUND_INTRO : POST /rooms/{code}/games
    ROUND_INTRO --> QUESTION : timer (3s)
    QUESTION --> REVEAL : todos respondieron o deadline
    REVEAL --> SCOREBOARD : timer (4s)
    SCOREBOARD --> ROUND_INTRO : quedan rondas
    SCOREBOARD --> FINAL_RESULTS : última ronda
    FINAL_RESULTS --> [*]
    LOBBY --> ABORTED : host cierra la sala
    QUESTION --> ABORTED : sin jugadores activos
```

| Fase | Duración por defecto | Qué muestra el cliente |
|---|---|---|
| `LOBBY` | — | Sala de espera |
| `ROUND_INTRO` | 3 s | Número y tipo de ronda |
| `QUESTION` | 20 s (10 s en rápida) | Pregunta + opciones + contador |
| `REVEAL` | 4 s | Correcta/incorrecta, puntos, vidas |
| `SCOREBOARD` | 6 s | Ranking acumulado |
| `FINAL_RESULTS` | — | Ganador y estadísticas |

El avance de fase lo ejecuta un **scheduler del servidor**. El host puede adelantar con
`POST /games/{id}/advance`, pero el juego nunca depende de que el cliente lo pida.

---

## 6. Convenciones de la API

### 6.1 Generales

| Aspecto | Valor |
|---|---|
| URL base | `https://{host}/api/v1` |
| Formato | JSON, `Content-Type: application/json; charset=utf-8` |
| Fechas | ISO 8601 UTC (`2026-09-04T18:30:00.000Z`) |
| Duraciones | Milisegundos, sufijo `Ms` |
| Nombres | `camelCase` en JSON, `kebab-case` en rutas |
| Versionado | Por ruta (`/api/v1`) |
| Idempotencia | `GET`, `PUT`, `DELETE` idempotentes; `POST /answers` protegido por índice único |

### 6.2 Autenticación

```http
Authorization: Bearer 9f2c1a7e-4d3b-4f61-9c02-8a7f5b1d0e33
```

Se obtiene en `POST /players`. Si falta → `401`. Si el token es válido pero no autoriza la
acción (p. ej. un jugador intenta iniciar la partida) → `403`.

### 6.3 Formato de error

Todos los errores usan el mismo sobre:

```json
{
  "error": {
    "code": "ROOM_FULL",
    "message": "La sala ya alcanzó el número máximo de jugadores.",
    "details": { "maxPlayers": 8 }
  },
  "requestId": "req_01J9X4M2",
  "timestamp": "2026-09-04T18:30:00.000Z"
}
```

### 6.4 Códigos HTTP

| Código | Uso |
|---|---|
| `200` | Consulta o acción correcta |
| `201` | Recurso creado (jugador, sala, partida, respuesta) |
| `204` | Acción sin cuerpo (salir de la sala) |
| `304` | Estado sin cambios (polling con `If-None-Match`) |
| `400` | JSON malformado o parámetro faltante |
| `401` | Token ausente o inválido |
| `403` | Token válido, sin permiso |
| `404` | Sala, partida o recurso inexistente |
| `409` | Conflicto de estado (ya respondió, partida ya iniciada, sala llena) |
| `410` | La ronda ya cerró |
| `422` | Validación semántica (nickname repetido, poder no disponible) |
| `429` | Demasiadas peticiones (protege el polling) |
| `500` | Error interno |

---

## 7. Referencia de endpoints

### 7.1 Resumen

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/players` | — | Crear sesión de jugador |
| `GET` | `/players/{id}` | ✔ | Perfil público |
| `POST` | `/rooms` | ✔ | Crear sala |
| `GET` | `/rooms/{code}` | — | Consultar sala |
| `PATCH` | `/rooms/{code}` | ✔ host | Modificar configuración |
| `POST` | `/rooms/{code}/players` | ✔ | Unirse |
| `DELETE` | `/rooms/{code}/players/{participantId}` | ✔ | Salir o expulsar |
| `DELETE` | `/rooms/{code}` | ✔ host | Cerrar sala |
| `POST` | `/rooms/{code}/games` | ✔ host | Crear e iniciar partida |
| `GET` | `/games/{id}/state` | ✔ | **Estado en vivo (polling)** |
| `POST` | `/games/{id}/rounds/{n}/answers` | ✔ | Responder |
| `POST` | `/games/{id}/rounds/{n}/powers` | ✔ | Usar poder |
| `GET` | `/games/{id}/rounds/{n}/results` | ✔ | Resultado de ronda |
| `GET` | `/games/{id}/ranking` | ✔ | Ranking acumulado |
| `GET` | `/games/{id}/results` | ✔ | Resultados finales |
| `POST` | `/games/{id}/advance` | ✔ host | Adelantar fase |
| `GET` | `/categories` | — | Catálogo de categorías |
| `GET` | `/questions` | ✔ admin | Listar preguntas |
| `POST` | `/questions` | ✔ admin | Crear pregunta |
| `POST` | `/questions/import` | ✔ admin | Importar de API externa |

---

### 7.2 Sesiones

#### `POST /players`

Crea una identidad efímera. Es el primer llamado de cualquier cliente.

**Body**
```json
{ "nickname": "Adler", "avatarId": "fox" }
```

**201 Created**
```json
{
  "playerId": "3f9b1a2c-7d41-4e88-9c3f-1b6e2a4d7c90",
  "nickname": "Adler",
  "avatarId": "fox",
  "token": "9f2c1a7e-4d3b-4f61-9c02-8a7f5b1d0e33",
  "expiresAt": "2026-09-04T21:30:00.000Z"
}
```

**Errores:** `422 NICKNAME_INVALID` (longitud o caracteres no permitidos).

---

### 7.3 Salas

#### `POST /rooms`

El jugador autenticado se convierte en host y en el primer participante.

**Body** (todo opcional; se aplican valores por defecto)
```json
{
  "settings": {
    "maxPlayers": 8,
    "totalRounds": 10,
    "startingLives": 3,
    "categories": ["ciencia", "videojuegos"],
    "powersEnabled": true
  }
}
```

**201 Created**
```json
{
  "roomId": "b21e...",
  "code": "K7X4QM",
  "status": "WAITING",
  "hostPlayerId": "3f9b1a2c-...",
  "settings": { "maxPlayers": 8, "totalRounds": 10, "startingLives": 3, "...": "..." },
  "participants": [
    { "participantId": "p1...", "nickname": "Adler", "avatarId": "fox", "isHost": true }
  ],
  "expiresAt": "2026-09-04T21:30:00.000Z"
}
```

---

#### `POST /rooms/{code}/players`

Une al jugador autenticado a la sala.

> **Nota de diseño:** se prefiere esta ruta sobre `POST /rooms/{code}/join` porque unirse
> es *crear un participante dentro de la colección de jugadores de la sala*, no invocar un
> verbo. Es la forma RESTful de la misma operación.

**Body:** vacío.

**201 Created**
```json
{
  "participantId": "p4...",
  "roomCode": "K7X4QM",
  "status": "WAITING",
  "participants": [
    { "participantId": "p1...", "nickname": "Adler",  "isHost": true },
    { "participantId": "p4...", "nickname": "Jared",  "isHost": false }
  ]
}
```

**Errores**

| Código | `error.code` | Cuándo |
|---|---|---|
| `404` | `ROOM_NOT_FOUND` | Código inexistente o caducado |
| `409` | `ROOM_FULL` | Se alcanzó `maxPlayers` |
| `409` | `GAME_ALREADY_STARTED` | La partida ya está en curso |
| `422` | `NICKNAME_TAKEN` | Nickname repetido en esa sala |

---

#### `GET /rooms/{code}`

Consulta pública de la sala (sirve para validar el código **antes** de unirse).

**200 OK**
```json
{
  "code": "K7X4QM",
  "status": "WAITING",
  "playerCount": 4,
  "maxPlayers": 8,
  "settings": { "totalRounds": 10, "startingLives": 3, "powersEnabled": true },
  "participants": [ { "nickname": "Adler", "avatarId": "fox", "isHost": true } ]
}
```

---

#### `PATCH /rooms/{code}` · solo host

Modifica la configuración mientras `status = WAITING`.

**Body:** objeto parcial de `settings`.
**Errores:** `403 NOT_ROOM_HOST`, `409 GAME_ALREADY_STARTED`.

---

#### `DELETE /rooms/{code}/players/{participantId}`

Salir de la sala (uno mismo) o expulsar (host). **204 No Content**.

Si sale el host durante `WAITING`, la titularidad pasa al participante más antiguo.

---

### 7.4 Partida

#### `POST /rooms/{code}/games` · solo host

Crea la partida, reparte poderes, selecciona las preguntas de las N rondas y entra en
`ROUND_INTRO` de la ronda 1.

**Body**
```json
{ "totalRounds": 10 }
```

**201 Created**
```json
{
  "gameId": "g8a3...",
  "status": "RUNNING",
  "phase": "ROUND_INTRO",
  "currentRoundNumber": 1,
  "totalRounds": 10,
  "serverTime": "2026-09-04T18:30:00.000Z",
  "phaseEndsAt": "2026-09-04T18:30:03.000Z"
}
```

**Errores:** `403 NOT_ROOM_HOST`, `409 NOT_ENOUGH_PLAYERS` (mínimo 2),
`409 GAME_ALREADY_STARTED`.

---

#### `GET /games/{id}/state` ⭐

**El endpoint central del sistema.** Devuelve todo lo que el cliente necesita dibujar en
este instante, adaptado a la fase actual y **personalizado según el token** (cada jugador ve
sus propias vidas, poderes y si ya respondió).

**Headers**
```http
Authorization: Bearer <token>
If-None-Match: "g8a3-v42"
```

**200 OK — fase `QUESTION`**
```json
{
  "gameId": "g8a3...",
  "version": 43,
  "phase": "QUESTION",
  "serverTime": "2026-09-04T18:30:06.120Z",
  "round": {
    "number": 3,
    "type": "DOUBLE",
    "endsAt": "2026-09-04T18:30:26.000Z",
    "question": {
      "id": "q77...",
      "text": "¿En qué año se lanzó el primer PlayStation?",
      "category": "Videojuegos",
      "difficulty": "MEDIUM",
      "options": [
        { "id": "o1", "text": "1992" },
        { "id": "o2", "text": "1994" },
        { "id": "o3", "text": "1996" },
        { "id": "o4", "text": "1998" }
      ]
    }
  },
  "me": {
    "participantId": "p1...",
    "score": 2450,
    "lives": 2,
    "status": "ALIVE",
    "hasAnswered": false,
    "answerDeadline": "2026-09-04T18:30:26.000Z",
    "powers": [
      { "powerType": "DOUBLE_POINTS", "available": true },
      { "powerType": "SHIELD",        "available": true },
      { "powerType": "HINT",          "available": false }
    ]
  },
  "players": [
    { "participantId": "p1...", "nickname": "Adler",
      "score": 2450, "lives": 2, "status": "ALIVE",     "hasAnswered": false },
    { "participantId": "p4...", "nickname": "Jared",
      "score": 2100, "lives": 3, "status": "ALIVE",     "hasAnswered": true  },
    { "participantId": "p7...", "nickname": "Luis",
      "score": 900,  "lives": 0, "status": "SPECTATOR", "hasAnswered": false }
  ]
}
```

> Las opciones **no incluyen `isCorrect`**. Ver decisión D-04.
> `players[].hasAnswered` es lo que permite mostrar “3 de 5 ya respondieron” sin filtrar
> qué respondieron.

**200 OK — fase `REVEAL`** (fragmento)
```json
{
  "phase": "REVEAL",
  "round": {
    "number": 3,
    "correctOptionId": "o2",
    "results": [
      { "participantId": "p1...", "optionId": "o2", "isCorrect": true,
        "responseTimeMs": 4200,  "pointsAwarded": 1900, "livesLost": 0 },
      { "participantId": "p4...", "optionId": "o1", "isCorrect": false,
        "responseTimeMs": 11800, "pointsAwarded": 0,    "livesLost": 1 }
    ]
  }
}
```

**304 Not Modified** — el `ETag` coincide, no hay cuerpo. El cliente no redibuja.

**Errores:** `403 NOT_A_PARTICIPANT`, `404 GAME_NOT_FOUND`, `429 TOO_MANY_REQUESTS`.

---

#### `POST /games/{id}/rounds/{n}/answers`

**Body**
```json
{ "optionId": "o2" }
```

**201 Created**
```json
{
  "accepted": true,
  "isCorrect": null,
  "responseTimeMs": 4200,
  "message": "Respuesta registrada. Espera el resultado de la ronda."
}
```

> `isCorrect` viaja como `null` a propósito: revelar el acierto en el momento del envío
> permitiría a un jugador saber la respuesta antes que el resto y comunicarla. El resultado
> llega en la fase `REVEAL`.

**Errores**

| Código | `error.code` | Cuándo |
|---|---|---|
| `403` | `PLAYER_IS_SPECTATOR` | Sin vidas |
| `409` | `ANSWER_ALREADY_SUBMITTED` | Ya respondió esta ronda |
| `409` | `WRONG_PHASE` | No es fase `QUESTION` |
| `410` | `ROUND_CLOSED` | Su `answerDeadline` ya pasó |
| `422` | `OPTION_NOT_IN_QUESTION` | `optionId` no pertenece a la pregunta |

---

#### `POST /games/{id}/rounds/{n}/powers`

**Body**
```json
{ "powerType": "HINT" }
```
o, para Bomba:
```json
{ "powerType": "BOMB", "targetParticipantId": "p4..." }
```

**200 OK — efecto de `HINT`**
```json
{
  "powerType": "HINT",
  "applied": true,
  "effect": { "removedOptionIds": ["o1", "o4"] },
  "remainingPowers": [ { "powerType": "SHIELD", "available": true } ]
}
```

**200 OK — efecto de `EXTRA_TIME`**
```json
{
  "powerType": "EXTRA_TIME",
  "applied": true,
  "effect": { "newAnswerDeadline": "2026-09-04T18:30:31.000Z" }
}
```

**Errores**

| Código | `error.code` |
|---|---|
| `409` | `POWER_ALREADY_USED` |
| `409` | `POWER_NOT_OWNED` |
| `409` | `ALREADY_ANSWERED` — los poderes se usan **antes** de responder |
| `409` | `WRONG_PHASE` |
| `422` | `TARGET_REQUIRED` / `INVALID_TARGET` (objetivo inexistente, uno mismo o espectador) |

---

#### `GET /games/{id}/ranking`

```json
{
  "gameId": "g8a3...",
  "afterRound": 3,
  "ranking": [
    { "position": 1, "participantId": "p1...", "nickname": "Adler",
      "score": 4350, "lives": 2, "positionDelta":  1 },
    { "position": 2, "participantId": "p4...", "nickname": "Jared",
      "score": 2100, "lives": 2, "positionDelta": -1 }
  ]
}
```

`positionDelta` permite animar las subidas y bajadas en la pantalla de ranking.

---

#### `GET /games/{id}/results`

Solo disponible en `FINAL_RESULTS`; si no, `409 GAME_NOT_FINISHED`.

```json
{
  "gameId": "g8a3...",
  "winner": { "participantId": "p1...", "nickname": "Adler", "score": 8200 },
  "finalRanking": [
    { "position": 1, "participantId": "p1...", "nickname": "Adler", "score": 8200 },
    { "position": 2, "participantId": "p4...", "nickname": "Jared", "score": 6400 }
  ],
  "stats": {
    "durationMs": 412000,
    "totalRounds": 10,
    "hardestQuestion":  { "questionId": "q31...", "text": "...", "correctRate": 0.12 },
    "easiestQuestion":  { "questionId": "q08...", "text": "...", "correctRate": 0.95 },
    "perPlayer": [
      {
        "participantId": "p1...",
        "nickname": "Adler",
        "correctAnswers": 8,
        "wrongAnswers": 2,
        "accuracy": 0.8,
        "avgResponseTimeMs": 5100,
        "fastestAnswerMs": 1800,
        "longestStreak": 5,
        "powersUsed": 3,
        "bestCategory": "Videojuegos"
      }
    ]
  }
}
```

---

#### `POST /games/{id}/advance` · solo host

Adelanta la fase actual sin esperar el temporizador (útil para `SCOREBOARD` y para la
demostración en clase). **200 OK** con el nuevo estado. `403 NOT_ROOM_HOST` si no es el host.

---

### 7.5 Contenido

#### `GET /questions`

**Query:** `category`, `difficulty`, `search`, `page` (def. 1), `pageSize` (def. 20, máx. 100).

```json
{
  "data": [
    {
      "id": "q77...",
      "text": "¿En qué año se lanzó el primer PlayStation?",
      "category": { "id": "c6...", "name": "Videojuegos", "slug": "videojuegos" },
      "difficulty": "MEDIUM",
      "source": "IMPORTED",
      "options": [
        { "id": "o1", "text": "1992", "isCorrect": false },
        { "id": "o2", "text": "1994", "isCorrect": true  }
      ]
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 412, "totalPages": 21 }
}
```

> Este es el único contexto donde `isCorrect` se expone, y requiere rol administrador.

#### `POST /questions/import`

Importa desde la API externa, normaliza el formato y **deduplica** por `externalId`.

**Body**
```json
{ "amount": 50, "category": "videojuegos", "difficulty": "MEDIUM" }
```

**200 OK**
```json
{ "requested": 50, "imported": 43, "duplicatesSkipped": 7, "failed": 0 }
```

**Errores:** `502 EXTERNAL_API_UNAVAILABLE`. Nótese que este fallo **no puede ocurrir
durante una partida**: la importación es una operación de mantenimiento.

---

## 8. Reglas de negocio

### 8.1 Puntuación

```
puntosBase       = { EASY: 600, MEDIUM: 800, HARD: 1000 }[dificultad]
msRestantes      = max(0, answerDeadline - horaRecepciónServidor)
bonusVelocidad   = round(puntosBase * 0.5 * (msRestantes / duraciónRonda))
subtotal         = puntosBase + bonusVelocidad
puntosFinales    = round(subtotal * multiplicadorRonda * multiplicadorPoder)
```

| Factor | Valor |
|---|---|
| Multiplicador ronda | `NORMAL` 1.0 · `FAST` 1.25 · `DOUBLE` 2.0 · `BOMB` 1.0 |
| Multiplicador poder | `DOUBLE_POINTS` 2.0, si no 1.0 |

Respuesta incorrecta o sin responder → **0 puntos**. El puntaje nunca baja.

**Ejemplo:** pregunta MEDIUM, ronda DOBLE, 20 s de duración, responde a los 4.2 s.
`800 + round(800 × 0.5 × 0.79) = 800 + 316 = 1116`; ×2 = **2232 puntos**.

### 8.2 Vidas

| Evento | Efecto |
|---|---|
| Respuesta correcta | Sin cambio |
| Respuesta incorrecta | −1 vida |
| No responder a tiempo | −1 vida |
| Escudo activo | −0 (el escudo se consume) |
| Ronda bomba: último en responder correctamente | −1 vida adicional |

Al llegar a 0 → `status = SPECTATOR` (o `ELIMINATED` según `settings.onZeroLives`).
Un espectador conserva su puntaje y aparece en el ranking final.

### 8.3 Poderes

Cada participante recibe al inicio un inventario fijo: **1 DOUBLE_POINTS, 1 SHIELD, 1 HINT**.
Es determinista y por lo tanto fácil de probar y de explicar; el reparto aleatorio queda
para v2.

| Poder | Efecto | Objetivo | Momento válido |
|---|---|---|---|
| `DOUBLE_POINTS` | ×2 puntos de la ronda | Propio | `QUESTION`, antes de responder |
| `SHIELD` | Anula la pérdida de vida de la ronda | Propio | `QUESTION`, antes de responder |
| `HINT` | Elimina 2 opciones incorrectas | Propio | `QUESTION`, antes de responder |
| `EXTRA_TIME` | +5 s al `answerDeadline` propio | Propio | `QUESTION`, antes de responder |
| `BOMB` | −5 s al `answerDeadline` del objetivo | Otro jugador `ALIVE` | `QUESTION`, antes de responder |

**Reglas transversales validadas por la API:** el poder está en el inventario, no fue usado,
la fase es `QUESTION`, el jugador aún no respondió, el jugador está `ALIVE`, y el objetivo
(si aplica) existe, no es uno mismo y está `ALIVE`.

### 8.4 Selección de preguntas

Al crear la partida se seleccionan las N preguntas **de una vez**, filtrando por las
categorías y dificultades de `settings`, sin repetición dentro de la partida. Se guardan en
las rondas con estado `PENDING`.

**Por qué de golpe y no ronda por ronda:** garantiza que no haya repetidas, evita una
consulta pesada a mitad de partida y hace la partida reproducible para depurar.

---

## 9. Flujo completo de una partida

```mermaid
sequenceDiagram
    participant H as Host (Website)
    participant J as Jugador (Website)
    participant A as Trivia Chaos API
    participant D as Base de datos

    H->>A: POST /players
    A-->>H: 201 { playerId, token }
    H->>A: POST /rooms
    A->>D: INSERT room + participant
    A-->>H: 201 { code: "K7X4QM" }

    J->>A: POST /players
    A-->>J: 201 { playerId, token }
    J->>A: GET /rooms/K7X4QM
    A-->>J: 200 { status: WAITING, playerCount: 1 }
    J->>A: POST /rooms/K7X4QM/players
    A->>D: INSERT participant
    A-->>J: 201 { participantId }

    H->>A: POST /rooms/K7X4QM/games
    A->>D: crear game + 10 rounds + poderes
    A-->>H: 201 { gameId, phase: ROUND_INTRO }

    loop cada ~1s, todos los clientes
        J->>A: GET /games/{id}/state (If-None-Match)
        A-->>J: 200 estado nuevo · o 304 sin cambios
    end

    Note over A: scheduler: ROUND_INTRO → QUESTION

    J->>A: POST /games/{id}/rounds/3/powers { HINT }
    A-->>J: 200 { removedOptionIds }
    J->>A: POST /games/{id}/rounds/3/answers { optionId }
    A->>D: INSERT submitted_answer (unique roundId+participantId)
    A-->>J: 201 { accepted: true, isCorrect: null }

    Note over A: todos respondieron → REVEAL
    A->>D: calcular puntos, vidas, version++

    J->>A: GET /games/{id}/state
    A-->>J: 200 { phase: REVEAL, correctOptionId, results }

    Note over A: REVEAL → SCOREBOARD → ronda 4 ... → FINAL_RESULTS

    J->>A: GET /games/{id}/results
    A-->>J: 200 { winner, finalRanking, stats }
```

---

## 10. Catálogo de errores

| `error.code` | HTTP | Significado |
|---|---|---|
| `NICKNAME_INVALID` | 422 | Longitud o caracteres no permitidos |
| `NICKNAME_TAKEN` | 422 | Ya usado en esa sala |
| `ROOM_NOT_FOUND` | 404 | Código inexistente o caducado |
| `ROOM_FULL` | 409 | Se alcanzó `maxPlayers` |
| `ROOM_CLOSED` | 410 | La sala fue cerrada |
| `NOT_ROOM_HOST` | 403 | Acción reservada al host |
| `NOT_A_PARTICIPANT` | 403 | El token no pertenece a la partida |
| `NOT_ENOUGH_PLAYERS` | 409 | Se requieren ≥2 jugadores |
| `GAME_ALREADY_STARTED` | 409 | La partida está en curso |
| `GAME_NOT_FINISHED` | 409 | Resultados aún no disponibles |
| `WRONG_PHASE` | 409 | La acción no aplica a la fase actual |
| `ROUND_CLOSED` | 410 | El deadline del jugador ya pasó |
| `ANSWER_ALREADY_SUBMITTED` | 409 | Una respuesta por ronda |
| `OPTION_NOT_IN_QUESTION` | 422 | `optionId` ajeno a la pregunta |
| `PLAYER_IS_SPECTATOR` | 403 | Sin vidas, no puede actuar |
| `POWER_NOT_OWNED` | 409 | No está en el inventario |
| `POWER_ALREADY_USED` | 409 | Ya se consumió |
| `INVALID_TARGET` | 422 | Objetivo inválido para Bomba |
| `TOKEN_INVALID` | 401 | Token ausente, mal formado o expirado |
| `TOO_MANY_REQUESTS` | 429 | Límite de polling excedido |
| `EXTERNAL_API_UNAVAILABLE` | 502 | Fallo de la API externa (solo importación) |

---

## 11. Alcance por versión

| Versión | Contenido | Estado |
|---|---|---|
| **v1** — Núcleo jugable | Sesiones, salas, partida, preguntas, puntuación, vidas, ranking, resultados, rondas Normal/Rápida/Doble/Bomba, poderes Doble/Escudo/Pista | Objetivo de la implementación |
| **v1.1** | Poderes Tiempo extra y Bomba (deadline por jugador), ronda final con apuestas, reconexión | Deseable |
| **v2** | Ronda mayoría, transporte por WebSockets/SSE, cuentas persistentes, historial de partidas | Fuera de alcance escolar |

---

## 12. Glosario

| Término | Significado |
|---|---|
| **Sala (Room)** | Espacio identificado por código donde se reúnen los jugadores |
| **Partida (Game)** | Una ejecución completa del juego dentro de una sala |
| **Ronda (Round)** | Una pregunta con su ventana de tiempo |
| **Participante** | Un jugador dentro de una sala, con puntaje y vidas |
| **Fase (Phase)** | Momento del ciclo de ronda que determina qué se muestra |
| **Host** | Jugador que creó la sala; único que puede configurarla e iniciarla |
