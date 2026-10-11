# Plan de implementación — API (frente A · Jared)

> Estado verificado el 11 de octubre de 2026, rama `api`, con `main` ya fusionada. Complementa a `PLAN.md` (tareas A1–A12) y a `api/CLAUDE.md` (reglas). Si algo difiere, **gana el contrato** (`docs/contrato/`).

## 1. Dónde estamos (leído del repo)

- `api/` está vacío: solo `CLAUDE.md` y `delete.txt`. No hay una línea de FastAPI.
- Contrato v0.2 cerrado (D1–D12) con 10 JSON de ejemplo. `docs/etapa2/` es material histórico y **no es contractual** (habla de rondas FAST/BOMB y 5 poderes que no existen).
- El Website (Adler) está completo contra un mock. `web/src/mock/simulator.ts` es una implementación probada de todas las reglas: **es tu mejor referencia**, pero lo marcado `SUPUESTO DE MOCK` no es regla del juego.
- `docker-compose.yml` tiene un **cambio sin commitear**: `127.0.0.1:3307:3306`. La API debe conectarse al puerto **3307**, no al 3306.
- El mock solo trae **16 preguntas**. La API necesita su propio seed.
- Vite reenvía `/api` a `http://localhost:8000`, así que la API corre en el **puerto 8000**.

## 2. Antes de la primera línea de código

1. Commit de `docker-compose.yml` (3307, solo en 127.0.0.1) y de `.env.example` con la variable de conexión:
   `DATABASE_URL=mysql+pymysql://trivia_user:change_me@127.0.0.1:3307/trivia_castro`
2. Agrega `.env.local` al `.gitignore` raíz.
3. Sube `api`, abre PR hacia `main` y fusiónalo. Después trabaja en ramas `feat/api-<tema>` desde `main`.
4. Python 3.11+ y un entorno virtual en `api/.venv`. En PowerShell, un comando por línea (no admite `&&`).
5. `docker compose up -d` y `docker compose ps` debe mostrar `healthy`.

## 3. Decisiones tuyas (el mock las inventó)

Propuesta = lo que ya asume el mock, para no obligar a Adler a cambiar nada. Apruébalas o cámbialas; cada una se anota en `docs/contrato/` **antes** de programarla.

| # | Tema | Propuesta | Se necesita en | ¿Toca el contrato? |
|---|---|---|---|---|
| 1 | Puntos base | EASY 500 · MEDIUM 800 · HARD 1100 | M4 | No |
| 2 | Bonus de velocidad | `400·(20000 − t_ms)/20000`, redondeado, función aislada | M4 | No |
| 3 | Timeout (no respondió) | `lastResult` con `chosenOptionId` y `answerTimeMs` en `null`, 0 puntos, **pierde 1 vida** (SHIELD la evita) | M4 | Sí, documentarlo |
| 4 | ¿SHIELD absorbió la vida? | Agregar `powerUsed: PowerType \| null` a `lastResult` | M4 | **Sí, acordar con Adler** |
| 5 | `activePower` | `PowerType \| null`; un solo poder por ronda; el segundo da `POWER_NOT_AVAILABLE` | M5 | Sí |
| 6 | Rangos de `settings` | jugadores 2–12 · rondas 1–15 · vidas 1–5 (los de los sliders de la web) | M2 | Sí |
| 7 | Rondas DOUBLE | cada tercera ronda (predecible para la demo) | M3 | Sí |
| 8 | `pointsThisRound` en SCOREBOARD | `null`, como dice el contrato | M4 | No |
| 9 | Desempate en el ranking | orden de unión a la sala | M5 | Sí |
| 10 | `X-Server-Time`, `serverTime`, `endsAt` | ISO 8601 con milisegundos (`...06.250Z`) | M1 | Sí |
| 11 | Estadísticas (D12) | `totalAnswers` cuenta solo rondas respondidas; promedio y más rápida valen `0` si nunca respondió | M5 | Sí |
| 12 | Salir en plena partida | `DELETE` responde 204, pero la fila del participante sigue en la partida (se queda sin responder y acaba de espectador) | M2 | Sí |
| 13 | Códigos de error extra | Agregar `NOT_FOUND` (rutas inexistentes) e `INTERNAL_ERROR` (500) a la tabla del contrato | M1 | **Sí, acordar con Adler** |

Una discrepancia detectada: el simulador acepta jugadores 2–16 y rondas 1–20, pero los **sliders** de la web son 2–12 y 1–15 (por eso propongo los de la web).

## 4. Estructura de `api/`

Un solo servicio, tres capas (HTTP → dominio → datos), sin sobreingeniería. SQLAlchemy **síncrono** (más simple y encaja con el bloqueo de filas).

```
api/
├── requirements.txt        fastapi, uvicorn[standard], sqlalchemy>=2, alembic, pymysql,
│                           cryptography, pydantic-settings, pytest, httpx
├── alembic.ini
├── alembic/versions/
├── app/
│   ├── main.py             app, middleware X-Server-Time, manejadores de error, routers
│   ├── config.py           lee ../.env con pydantic-settings
│   ├── clock.py            utcnow() inyectable (para probar con reloj falso)
│   ├── http/               routers (players, rooms, games, content), deps.py (auth Bearer),
│   │                       errors.py (ApiError), schemas.py (CamelModel y respuestas)
│   ├── domain/             scoring.py, phases.py, ranking.py, game_service.py,
│   │                       room_service.py, powers.py   ← reglas puras, sin FastAPI
│   ├── db/                 session.py, models.py
│   └── seed/               categories.json, questions.json, seed.py
├── scripts/play_bots.py    jugadores falsos para probar solo (ver M6)
└── tests/
```

## 5. Modelo de datos

Ids como enteros autoincrementales **serializados a cadena** en el JSON. El código de sala (6 caracteres) y el token son valores aparte. Todas las fechas en `DATETIME(3)` UTC.

| Tabla | Campos clave |
|---|---|
| `players` | id, nickname, `token` único |
| `categories` | id, name |
| `questions` / `options` | texto, dificultad, `external_id` opcional · opción con `is_correct` |
| `rooms` | `code` único, status, ajustes (max_players, rounds, lives, category_ids JSON), `current_game_id` |
| `participants` | room_id, player_id, nickname, is_host, score, lives, status, `active_power`; únicos `(room_id, player_id)` y `(room_id, nickname)` |
| `participant_powers` | un renglón por poder del inventario; se marca como usado |
| `games` | room_id, phase, `phase_start`, `phase_end` (null en FINAL), `round_index`, **`version`** |
| `rounds` | game_id, number, type, question_id, `option_order` (JSON con el orden barajado) |
| `submitted_answers` | round_id, participant_id, option_id, answer_time_ms · **índice único `(round_id, participant_id)`** |
| `round_results` | una fila por participante y ronda: elegida, acertó, tiempo, base, bono, multiplicadores, puntos, vidas perdidas, `score_after` |
| `power_uses` | quién, cuándo, ronda y `effect` (las opciones que quitó HINT) |

`round_results` es la fuente de `lastResult`, de `/rounds/{n}/results`, de las estadísticas y del historial para `positionDelta`: no hace falta guardar el ranking aparte.

## 6. Decisiones técnicas que conviene fijar desde el inicio

1. **Fases perezosas con bloqueo de fila.** En cada petición a `state`, `answers`, `powers` y `GET /rooms/{code}` se pregunta "¿ya pasó `phase_end`?". Si no, sigue sin tocar nada. Si sí, se abre una transacción con `SELECT ... FOR UPDATE` sobre la fila del juego, se vuelve a leer y se aplican **en orden** todas las transiciones vencidas. Sin esto, con 4 jugadores consultando cada segundo, dos peticiones pueden cerrar la misma ronda dos veces.
2. **Cada transición usa la hora programada, no la actual.** Como el simulador: `transition(game, phase_end)`. Así una petición tardía no desplaza las fases siguientes.
3. **`version` sube dentro de la misma transacción** que cualquier cambio visible: respuesta, poder, cambio de fase. El ETag es `"<gameId>-v<version>"`.
4. **Camino barato para el 304:** autenticar → comprobar pertenencia (`403 NOT_IN_GAME`) → aplicar fases vencidas → comparar ETag. Solo si cambió se arma el estado completo.
5. **El tiempo lo mide el servidor:** `answer_time_ms = ahora − phase_start`. Una respuesta tardía se rechaza con `ROUND_NOT_ACTIVE`.
6. **Orden de validación de `answers`** (igual que el simulador): espectador → fase y ronda actuales → opción válida → duplicado.
7. **Un solo proceso:** `uvicorn app.main:app --port 8000` **sin** `--workers`.
8. **Errores y cabeceras** salen de un solo lugar: `ApiError` + manejadores (validación de Pydantic → `VALIDATION_ERROR`, 401, 404, 500) y un middleware `X-Server-Time` que cubre también 304 y errores.
9. **No inventes endpoints.** Por eso no hay `/health`: para comprobar que arrancó usa `/docs`.

## 7. Hitos

Los días suponen entrega el viernes 16; ajusta cuando confirmen la fecha. Cada hito termina con pruebas en verde y un commit pequeño (`feat(api): ...`).

| Hito | Día | Qué se construye (tareas del `PLAN.md`) | Está listo cuando |
|---|---|---|---|
| **M0** Entorno | Dom 11 | Sección 2 | `docker compose ps` en `healthy`, venv listo, `/docs` abre |
| **M1** Esqueleto + stubs (A2) | Dom 11 | `config`, `CamelModel`, middleware, errores, los 19 endpoints devolviendo los JSON de `docs/contrato/ejemplos/` con ETag/304 | Adler cambia `VITE_USE_MOCK=false` y su cliente HTTP, el polling y el 304 funcionan contra tu servidor |
| **M2** Datos, jugadores y salas (A1, A3, A4) | Lun 12 | Modelos + migración inicial, `POST /players` y token, crear/consultar/modificar sala, unirse (201/200, `ROOM_FULL`, `NICKNAME_TAKEN`, `GAME_ALREADY_STARTED`), salir/expulsar, traspaso de host | **Integración 1:** Home → Crear → Unirse → Lobby real con dos navegadores |
| **M3** Contenido, inicio y `state` (A5, A6) | Mar 13 | Seed (ver abajo), `/categories`, `/questions`, `POST /rooms/{code}/games`, constructor de `state` por fase, ETag/304 | `state` en ROUND_INTRO tiene exactamente las claves de `state-round-intro.json` |
| **M4** Fases, respuestas y puntos (A7, A8) | Mié 14 | Fases perezosas con bloqueo, `advance`, `answers`, cierre de ronda (puntos, vidas, timeout, espectador), REVEAL, SCOREBOARD, FINAL, `room.status = FINISHED` | Una partida de 3 rondas con reloj falso pasa de punta a punta en pytest |
| **M5** Ranking, resultados y poderes (A9, A10) | Jue 15 | `/ranking` con `positionDelta`, `/rounds/{n}/results`, `/results` con estadísticas, HINT, SHIELD y DOUBLE | Las formas de `ranking.json`, `round-results.json` y `results.json` coinciden |
| **M6** Bots, forma e integración (A11) | Jue 15 – Vie 16 | `scripts/play_bots.py`, pruebas de forma contra los ejemplos, lista de verificación de la guía (§10) | **Integración 2:** partida completa con Adler |
| **M7** Pulido | Vie 16 | README de `api/`, limpieza de salas, ensayo con varios dispositivos, `POST /questions/import` solo si sobra tiempo | Ensayo de la exposición sin errores |

**Seed de preguntas (parte de M3):** 10 categorías (los ejemplos fijan `c1 = Videojuegos`; los otros nombres del mock son inventados) y al menos **120 preguntas**, mínimo 12 por categoría, con 4 opciones y exactamente 1 correcta, mezclando EASY, MEDIUM y HARD. Con menos, filtrar por una sola categoría con 15 rondas daría `NOT_ENOUGH_QUESTIONS`. Incluye la pregunta del PlayStation (`q27`) porque los ejemplos la usan.

**Qué copiar del simulador (por función):**

| Python | Función en `simulator.ts` |
|---|---|
| Crear partida | `startGame` |
| Fases y transiciones | `tick`, `transition`, `enter` |
| Cierre de ronda | `closeRound` |
| Constructor de `state` | `getState`, `stateQuestion` |
| `positionDelta` | `rankingEntries` |
| Validación de respuesta | `answer` |
| Poderes | `usePower` |
| Estadísticas finales | `results` |

## 8. Pruebas

- **Unitarias (sin base de datos):** puntos (el ejemplo del contrato: (800 + 316) × 2 = 2232), bono de velocidad, multiplicadores, transiciones de fase, `positionDelta`.
- **De servicio con reloj falso:** respuesta duplicada, respuesta tardía, timeout con y sin SHIELD, paso a espectador, dos peticiones simultáneas en el borde de una fase.
- **De forma:** comparar las claves y los enums de cada respuesta real con `docs/contrato/ejemplos/*.json`, como hace `web/src/test/fixtures.test.ts`. Detecta desvíos antes de integrar.
- **Base de pruebas separada** (`trivia_castro_test` en el mismo contenedor), porque el índice único y `FOR UPDATE` se comportan distinto en SQLite.
- **Humo con curl.exe** (en PowerShell hay que escribir `curl.exe`): ejemplos en la guía, §8.

## 9. Riesgos

- **Tiempo.** La fecha exacta de entrega sigue sin confirmarse. Si se acorta, lo imprescindible es M1 a M4; poderes, estadísticas y el seed grande van al final (igual que en las prioridades de `PLAN.md`).
- **Probar solo.** Con una sola persona no se puede jugar, y los bots de Adler solo existen en su mock. `play_bots.py` (jugadores que se unen, responden al azar y usan poderes) es lo que te permite recorrer una partida sin pedirle a nadie que se conecte.
- **Carga del polling.** Cada jugador pide `state` una vez por segundo: índices en las claves foráneas y sin consultas repetidas por jugador.
- **Desvío del contrato.** Cualquier cambio de campos se avisa y se escribe en `docs/contrato/` antes de tocar código.
- **Windows.** PowerShell sin `&&`; `curl.exe`; instalar `cryptography` para que PyMySQL pueda autenticarse contra MySQL 8.4.

## 10. Flujo de trabajo

- Ramas `feat/api-<tema>`, PR hacia `main`, commits pequeños. No tocar `web/`. No editar `docs/contrato/` sin avisar a Adler.
- Antes de pedir revisión: pruebas en verde.
- Nunca commitear `.env`.
