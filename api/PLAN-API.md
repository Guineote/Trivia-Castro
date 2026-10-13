# Plan de implementación — API (frente A · Jared)

> Estado verificado el **12 de octubre de 2026** sobre la rama `api` (último commit `f9cc073`, árbol limpio). Complementa a `PLAN.md` (tareas A1–A12) y a `api/CLAUDE.md` (reglas). Si algo difiere, **gana el contrato** (`docs/contrato/`). Nombre oficial del juego: **Trivia Castro**.

## 1. Dónde estamos (leído del repo)

- **La API está implementada** (M0–M5 completos y la mayor parte de M6): 17 de los 18 endpoints del contrato (todos menos `POST /questions/import`), modelos y migración Alembic, seed de 10 categorías y 120 preguntas, fases perezosas, puntuación, poderes, ranking, resultados y estadísticas, `play_bots.py` y **25 pruebas pytest en verde** (revisión del 12 de oct, sobre SQLite en memoria).
- **Falta:** `POST /questions/import` (opcional, A12), verificar la API contra MySQL real con una partida completa y registrar las integraciones con el Website (Integración 1 y 2 del `PLAN.md`; el repo no tiene constancia de que se hayan hecho), la limpieza de salas viejas y el README/manual final (ver §8 y §9).
- Contrato v0.2 cerrado (D1–D12) con 10 JSON de ejemplo. Las decisiones propias del frente A (§3) **no se han llevado al contrato**: esperan la revisión de Adler.
- El Website (Adler) está completo contra un mock. `web/src/mock/simulator.ts` sigue siendo la referencia de reglas; lo marcado `SUPUESTO DE MOCK` no es regla del juego.
- Puertos: API en **8000** (Vite reenvía `/api` ahí) y MySQL en `127.0.0.1:3307`. Contenedor y base se llaman **`trivia-castro` / `trivia_castro`**.
- `.env` ya no está trackeado y MySQL solo escucha en `127.0.0.1`.

## 2. Arranque

Ver `api/README.md` (comandos para PowerShell, uno por línea). Resumen: `docker compose up -d` desde la raíz → venv e instalación de `requirements.txt` → `alembic upgrade head` → `uvicorn app.main:app --port 8000` **sin** `--workers`. Si la tabla de preguntas está vacía, el seed corre solo al arrancar. Documentación interactiva en `http://localhost:8000/docs` (no hay `/health`: no se inventan endpoints).

## 3. Decisiones del frente A (estado)

Todas están **implementadas** en la API. El contrato no se ha editado: pasan a `docs/contrato/` cuando Adler las acepte (seguimiento en `docs/frontend/PENDIENTES.md`). Cada una vive en un solo lugar del código.

| # | Tema | Implementación | Dónde cambiarla | ¿Toca el contrato? |
|---|---|---|---|---|
| 1 | Puntos base | EASY 500 · MEDIUM 800 · HARD 1100 | `app/scoring.py` | No |
| 2 | Bonus de velocidad | `max(0, round(400·(20000 − t_ms)/20000))` | `app/scoring.py` | No |
| 3 | Timeout (no respondió) | `lastResult` con `chosenOptionId` y `answerTimeMs` en `null`, 0 puntos, **−1 vida** (SHIELD la evita) | `services/games.py` (`_close_round`) | Sí, documentarlo |
| 4 | ¿SHIELD absorbió la vida? | Campo nuevo `powerUsed: PowerType \| null` en `lastResult` | `services/games.py` | **Sí. Adler debe añadirlo a `web/src/api/types.ts`** (hoy no existe en `web/src`) |
| 5 | `activePower` | `PowerType \| null`; un poder por ronda (índice único en `power_uses`); el segundo → `409 POWER_NOT_AVAILABLE`; vuelve a `null` en la siguiente `ROUND_INTRO` | `services/games.py` | Sí |
| 6 | Rangos de `settings` | jugadores 2–12 · rondas 1–15 · vidas 1–5; fuera de rango → `422 VALIDATION_ERROR` | `app/schemas.py` | Sí |
| 7 | Rondas DOUBLE | cada tercera ronda | `services/games.py` (`create_game`) | Sí |
| 8 | `pointsThisRound` | solo en `REVEAL`; `null` en `SCOREBOARD` | `services/games.py` | No |
| 9 | Desempate en el ranking | orden de unión a la sala (`participant.id`) | `services/games.py` (`standings`) | Sí |
| 10 | Timestamps | ISO 8601 con **milisegundos** en `serverTime`, `endsAt` y `X-Server-Time` | `app/clock.py` | Sí (el contrato muestra segundos) |
| 11 | Estadísticas (D12) | `totalAnswers` cuenta solo rondas respondidas; promedio y más rápida incluyen respuestas incorrectas y valen `0` si nunca respondió; `bestRound` `{number: 0, points: 0}` sin puntos | `services/games.py` (`results`) | Sí |
| 12 | Salir en plena partida | `DELETE` responde 204 pero la fila se conserva (se queda sin responder y acaba de espectador) | `services/rooms.py` | Sí |
| 13 | Códigos de error extra | `NOT_FOUND` (404 de ruta inexistente) e `INTERNAL_ERROR` (500) | `app/errors.py` | **Sí, acordar con Adler** |
| 14 | Ids | prefijo + entero de la BD: `p1`, `pt2`, `g3`, `q4`, `o5`, `c6` (el contrato los trata como cadenas opacas) | `app/ids.py` | No |
| 15 | CORS | permite `http://localhost:5173` (`CORS_ORIGINS`), `Authorization`, `If-None-Match`, `Content-Type`; expone `ETag` y `X-Server-Time` | `app/main.py` | No |
| 16 | Mínimo de jugadores | 2 (D4); `MIN_PLAYERS_TO_START=1` en `.env` para probar solo | `app/config.py` | No |

**Ya resueltos en el contrato (D1–D12):** efectos de poderes (HINT quita 2 incorrectas, SHIELD evita perder la vida, DOUBLE x2 y se combina con la ronda DOUBLE → x4), tipos de ronda NORMAL y DOUBLE, ajustes por defecto 8 / 10 / 3.

**Pendientes de confirmar con el equipo:** fórmula definitiva del bonus de velocidad y puntos base (el contrato los deja abiertos a propósito; hoy son valores provisionales), revancha tras `FINAL`, y fecha exacta de entrega.

## 4. Estructura real de `api/`

Un solo servicio, tres capas (rutas → servicios → modelos), SQLAlchemy **síncrono**. No hay carpetas `http/` ni `domain/` separadas: se mantuvo plano.

```
api/
├── requirements.txt        versiones fijadas (fastapi, uvicorn, SQLAlchemy 2, PyMySQL, cryptography,
│                           alembic, python-dotenv, pytest, httpx)
├── alembic.ini · alembic/versions/0001_esquema_inicial.py
├── app/
│   ├── main.py             create_app(), middleware X-Server-Time, CORS, seed al arrancar
│   ├── config.py           lee ../.env con python-dotenv (MYSQL_*, DB_HOST, DB_PORT, DATABASE_URL,
│   │                       MIN_PLAYERS_TO_START, CORS_ORIGINS)
│   ├── db.py               engine, SessionLocal, get_db y GAME_LOCK
│   ├── clock.py            now_ms()/iso() con reloj falso para pruebas
│   ├── errors.py           ApiError, mensajes y manejadores (formato { "error": { code, message } })
│   ├── ids.py              fmt()/parse() de ids con prefijo
│   ├── models.py · schemas.py (CamelModel y cuerpos de petición)
│   ├── scoring.py          puntos y bonus (lo pendiente del contrato vive aquí)
│   ├── routers/api.py      rutas /api/v1 (capa fina)
│   ├── services/           players, rooms, games (fases, respuestas, poderes, estado), content
│   └── seed.py · seed_data.py   10 categorías y 120 preguntas (12 por categoría; 42 EASY, 46 MEDIUM, 32 HARD)
├── scripts/play_bots.py    jugadores falsos (solo biblioteca estándar)
└── tests/                  conftest.py (cliente + reloj falso), test_scoring, test_rooms, test_game
```

## 5. Modelo de datos (tal como está en `models.py`)

Ids enteros autoincrementales, serializados con prefijo en el JSON. Los instantes de fase se guardan como milisegundos epoch (`BigInteger`).

| Tabla | Campos clave |
|---|---|
| `players` | id, nickname, `token` único |
| `categories` | id, name único |
| `questions` / `options` | texto, categoría, dificultad, `external_id` único opcional · opción con `is_correct` |
| `rooms` | `code` único (6 caracteres), status, `max_players`, `rounds`, `lives`, `category_ids` (JSON; vacío = todas). **No** guarda `current_game_id`: se calcula con la última partida de la sala |
| `participants` | room_id, player_id, nickname, is_host, score, lives, status (`ACTIVE`/`SPECTATOR`); únicos `(room_id, player_id)` y `(room_id, nickname)` |
| `participant_powers` | inventario: un renglón por poder y participante; `used_ms` es `null` mientras esté disponible |
| `games` | room_id, phase, `phase_start_ms`, `phase_end_ms` (`null` en FINAL), `round_index`, **`version`** (base del ETag), `initial_order` (JSON) |
| `rounds` | game_id, number, type, question_id, `option_order` (JSON con el orden barajado), `closed`, `ranking_after` (JSON); único `(game_id, number)` |
| `submitted_answers` | round_id, participant_id, option_id, `answer_time_ms` · **único `(round_id, participant_id)`** (la garantía de «una respuesta por ronda» vive en la BD) |
| `power_uses` | round_id, participant_id, power_type, `used_ms`, `removed_option_ids` (HINT); único `(round_id, participant_id)` |
| `round_outcomes` | una fila por participante y ronda con `last_result` (JSON; `null` si ya era espectador). Es la fuente de `lastResult`, de `/rounds/{n}/results` y de las estadísticas; `rounds.ranking_after` da el historial para `positionDelta` |

## 6. Decisiones técnicas (cómo quedó)

1. **Fases perezosas, sin scheduler.** En cada petición que toca una partida (`state`, `answers`, `powers`, `ranking`, `results`, `GET /rooms/{code}`…) `games.tick` aplica, **en orden y con su hora programada**, todas las transiciones cuyo `phase_end_ms` ya pasó. Una petición tardía no desplaza las fases siguientes.
2. **Concurrencia: un candado global, no `SELECT … FOR UPDATE`.** `get_db` toma `GAME_LOCK` (un `threading.Lock`) durante toda la petición, así que con **un solo proceso** nunca hay dos relojes ni dos escrituras sobre la misma partida. Costo: las peticiones se serializan (suficiente para la demo con pocos jugadores). Ejecutar `uvicorn` **sin `--workers`**. *(El plan original proponía bloqueo de fila; no se implementó.)*
3. **`version`** sube con cada cambio visible (respuesta, poder, cambio de fase) y el ETag es `"<gameId>-v<version>"` (por ejemplo `"g3-v43"`).
4. **Camino barato para el 304:** autenticar → comprobar pertenencia (`403 NOT_IN_GAME`) → `tick` → comparar `If-None-Match`; solo si cambió se arma el estado completo.
5. **El tiempo lo mide el servidor:** `answer_time_ms = ahora − phase_start`. Una respuesta fuera de `QUESTION` se rechaza con `ROUND_NOT_ACTIVE`.
6. **Orden de validación de `answers`:** espectador → fase y ronda actuales → opción válida → duplicado. El índice único atrapa la carrera final (`IntegrityError` → `ALREADY_ANSWERED`).
7. **Errores y cabeceras en un solo lugar:** `ApiError` + manejadores (validación de Pydantic → `VALIDATION_ERROR`, 401/403/404 de FastAPI) y un middleware `X-Server-Time` que cubre también 304 y errores 500.
8. **Pantalla personalizada:** `build_state` entrega `isCorrect` solo en `REVEAL`; con HINT quita las opciones eliminadas del `state` de ese jugador.

## 7. Hitos — estado

| Hito | Qué se construye (tareas del `PLAN.md`) | Estado |
|---|---|---|
| **M0** Entorno | docker-compose (3307, solo `127.0.0.1`), `.env.example`, venv | ✅ Hecho |
| **M1** Esqueleto + stubs (A2) | Se **omitieron los stubs**: se implementó directamente la lógica real, con middleware, errores y CORS | ✅ Superado |
| **M2** Datos, jugadores y salas (A1, A3, A4) | Modelos + migración, `POST /players`, salas, unirse (201/200), salir/expulsar, traspaso de host | ✅ Hecho |
| **M3** Contenido, inicio y `state` (A5, A6) | Seed (10 × 12 = 120 preguntas), `/categories`, `/questions`, `POST /rooms/{code}/games`, `state` por fase con ETag/304 | ✅ Hecho |
| **M4** Fases, respuestas y puntos (A7, A8) | Fases perezosas, `advance`, `answers`, cierre de ronda, espectador, `room.status = FINISHED` | ✅ Hecho |
| **M5** Ranking, resultados y poderes (A9, A10) | `/ranking` con `positionDelta`, `/rounds/{n}/results`, `/results`, HINT / SHIELD / DOUBLE | ✅ Hecho |
| **M6** Bots, forma e integración (A11) | `scripts/play_bots.py` y pruebas de forma contra `docs/contrato/ejemplos/` listos. **Integración 1 y 2 con Adler: sin constancia en el repo** | 🟡 Parcial |
| **M7** Pulido | README de `api/` listo. Falta: limpieza de salas, ensayo con varios dispositivos y, si sobra tiempo, `POST /questions/import` (A12) | 🔲 Pendiente |

## 8. Pruebas

- **25 pruebas pytest en verde** (`python -m pytest -q` desde `api/`): `test_scoring` (4: ejemplo del contrato (800 + 316) × 2 = 2232, bonus acotado, multiplicadores), `test_rooms` (8: headers y errores, nickname, sala con la forma del contrato, 201/200, ajustes, salir/expulsar y host, categorías y preguntas) y `test_game` (13: iniciar y errores, ETag/304, acceso, partida completa de 3 rondas, resultados antes del final, respuesta tardía, timeout con y sin SHIELD, HINT, DOUBLE de poder y de ronda, espectador, `advance`, reloj perezoso hasta FINAL, índice único en la BD).
- **Pruebas de forma:** comparan las claves de cada respuesta real con `docs/contrato/ejemplos/*.json` (`powerUsed` se permite como campo extra de `lastResult`).
- **Limitación:** las pruebas usan **SQLite en memoria** y un reloj falso; no ejercitan MySQL. Falta una corrida completa contra el contenedor (`play_bots.py` es la forma de hacerla).
- **Humo manual:** `curl.exe` (ejemplos en `docs/frontend/GUIA-PARA-LA-API.md`, §8) y `play_bots.py`.

## 9. Pendientes y riesgos

- **Integración con el Website.** Registrar el resultado de la Integración 1 (Home → Crear → Unirse → Lobby) y la 2 (partida completa). `web/.env.local` está en `VITE_USE_MOCK=false` en la máquina de desarrollo, pero eso no prueba nada. Primero Adler debe añadir `powerUsed` a `web/src/api/types.ts` y aceptar los puntos de §3.
- **Validar en MySQL real:** `alembic upgrade head`, seed y una partida con `play_bots.py` (la migración y el índice único nunca se han probado en las pruebas automáticas).
- **Salas sin limpieza.** Una sala solo se borra si queda vacía en `WAITING`; las partidas terminadas se acumulan en la BD (irrelevante para la demo).
- **Candado global:** serializa todas las peticiones; aceptable con 2–12 jugadores en un solo proceso.
- **`DELETE` de un participante que no existe** responde `404 ROOM_NOT_FOUND` (el contrato no define un código específico).
- **`POST /questions/import`** no existe (opcional; sin fuente de API externa definida).
- **Revancha** y **pantalla de Apuesta** no se construyen.
- **Tiempo.** La fecha exacta de entrega (semana del 12 al 16 de octubre) sigue sin confirmarse.

## 10. Flujo de trabajo

- Ramas `feat/api-<tema>`, PR hacia `main`, commits pequeños (`feat(api): …`). No tocar `web/` ni editar `docs/contrato/` sin avisar a Adler.
- Antes de pedir revisión: pruebas en verde.
- Nunca commitear `.env`.
