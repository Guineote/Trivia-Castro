# Pendientes y alertas (frontend ↔ API)

## Resumen para Jared (frente A)

El frontend ya recorre todo el juego contra un mock (ver [`web/README.md`](../../web/README.md)). **Guía completa: [`GUIA-PARA-LA-API.md`](GUIA-PARA-LA-API.md).** Para conectarlo a la API real, lo mínimo que necesita:

1. **Headers:** `X-Server-Time` en *todas* las respuestas (incluidas 304), `ETag` `"<gameId>-v<version>"` y `Vary: Authorization` en `GET /games/{id}/state`.
2. **Errores** en formato `{ "error": { "code", "message" } }` (también los de validación de Pydantic).
3. **Puerto y CORS:** confirmar el puerto (se asume 8000). Con el proxy de Vite no hay CORS; si no, permitir `Authorization`/`If-None-Match` y exponer `ETag`/`X-Server-Time`.
4. **Decisiones que el mock tuvo que inventar** y que dependen de ti (detalle abajo): `lastResult` en timeout, cómo saber si el SHIELD absorbió la vida, forma de `activePower`, formato/precisión de `X-Server-Time`, rangos de `settings`, y si `pointsThisRound` sigue poblado en `SCOREBOARD`.
5. **Seguridad del repo:** resuelto (`.env` ya no está trackeado y MySQL solo escucha en `127.0.0.1`; ver «Seguridad» abajo).

Los supuestos del mock están marcados como `SUPUESTO DE MOCK` en `web/src/mock/simulator.ts`: **no son reglas del juego**.

## Decisiones del frente A (API implementada, 11 oct 2026; verificada el 12 oct con 25 pruebas en verde) — **Adler: revisar**
La API en `api/` toma estas decisiones donde el contrato no decía nada. **No se editó `docs/contrato/`**: si las aceptan, se pasan al contrato. Estado completo en [`api/PLAN-API.md`](../../api/PLAN-API.md) §3. Todas son cambiables en un solo lugar (`api/app/scoring.py`, `api/app/schemas.py`, `api/app/services/games.py`).

| Tema | Decisión | ¿Afecta a `web/`? |
|---|---|---|
| Puntos base | EASY 500 · MEDIUM 800 · HARD 1100 | No |
| Bonus de velocidad | `round(400·(20000 − t_ms)/20000)`, mínimo 0 | No |
| Timeout | `lastResult` con `chosenOptionId` y `answerTimeMs` en `null`, 0 puntos, **−1 vida** (SHIELD la evita) | No (ya lo maneja) |
| **SHIELD absorbido** | `lastResult` trae un campo **nuevo `powerUsed: PowerType \| null`** | **Sí:** añadir `powerUsed` al tipo `LastResult` de `web/src/api/types.ts` (hoy no rompe nada, es un campo extra) |
| Poderes | Un solo poder por ronda; el segundo da `409 POWER_NOT_AVAILABLE`. `activePower` es `PowerType \| null` y se conserva hasta la siguiente `ROUND_INTRO` | No |
| Rangos de `settings` | jugadores 2–12 · rondas 1–15 · vidas 1–5 (los sliders); fuera de rango → `422 VALIDATION_ERROR` | No |
| Rondas DOUBLE | Cada tercera ronda | No |
| `pointsThisRound` | Solo en `REVEAL`; `null` en `SCOREBOARD` | No |
| Desempate | Por orden de unión a la sala | No |
| Timestamps | ISO 8601 con **milisegundos** (`2026-09-04T18:30:06.250Z`) en `serverTime`, `endsAt` y `X-Server-Time` | No |
| Estadísticas | `totalAnswers` cuenta solo rondas respondidas; promedio y más rápida valen `0` si nunca respondió; promedio/más rápida incluyen respuestas incorrectas | No |
| Salir en plena partida | `DELETE` responde 204 pero el participante permanece (acaba de espectador) | No |
| Errores extra | `NOT_FOUND` (404 de ruta inexistente) e `INTERNAL_ERROR` (500) | Mensaje genérico en la web |
| Ids | Prefijo + entero: `p1`, `pt2`, `g3`, `q4`, `o5`, `c6` (ids de BD) | No |
| `X-Server-Time` / CORS | En todas las respuestas (también 304 y errores); CORS permite `http://localhost:5173` y expone `ETag` y `X-Server-Time` | No |
| Puerto / BD | API en `:8000`; MySQL en `127.0.0.1:3307` | No |
| Mínimo de jugadores | 2 para iniciar (D4); `MIN_PLAYERS_TO_START=1` en `.env` para probar solo | No |
| Concurrencia | Un candado global y un solo proceso; las fases se evalúan por petición | No |

## Verificación del frontend contra la API real (14 oct 2026, Adler)
Corrida con la API de Jared sobre SQLite (sin Docker) y `VITE_USE_MOCK=false`; un navegador y bots (uno que sigue la revancha). Resultado:
- [x] Crear sala, unirse, lobby (polling), iniciar, partida completa de 2 rondas, podio, estadísticas y SALIR (`DELETE` → 204).
- [x] Escudo en timeout: `lastResult.powerUsed = "SHIELD"`, `livesLost = 0`. Sin escudo: −1 vida y paso a espectador (`becameSpectator`).
- [x] `NICKNAME_TAKEN` real (422) → la pantalla pide otro nombre y entra con el nuevo (D3).
- [x] `GET /state` con `ETag` `"g5-v10"`, `Vary: Authorization`, `304` con `X-Server-Time` en milisegundos.
- [x] Revancha como host (se reinicia puntaje y poderes) y como invitado (espera y entra sola).
- [x] **MySQL 8.4.4 (14 oct, Adler):** instancia nativa temporal (mismo motor que la imagen `mysql:8.4`; el contenedor en sí no se probó). `alembic upgrade head` crea las 12 tablas con sus índices únicos (incluido `uq_answer_round_participant`), el seed carga 120 preguntas / 480 opciones; partida de 4 jugadores con `play_bots.py`, revancha (3 filas de poderes por jugador, 0 respuestas duplicadas), 7 jugadores enviando cada respuesta dos veces a la vez (siempre un 202 y un 409), apodos con acento y emoji (utf8mb4) y reinicio de la API en plena partida (el estado sobrevive).
- [x] **Hallazgo solo de MySQL, corregido en `fix/api-apodos-mysql`:** el índice único `(room_id, nickname)` usa la collation `utf8mb4_0900_ai_ci` (ignora mayúsculas **y acentos**); con el host `José`, entrar como `Jose`/`jose`/`JOSE` daba **500** en vez de `422 NICKNAME_TAKEN`. SQLite no lo detecta, por eso las pruebas pasaban. Arreglo: comparar apodos sin acentos (`_name_key`) y convertir un `IntegrityError` al insertar en `422 NICKNAME_TAKEN`.
- [ ] Sin probar: el contenedor de Docker, varios dispositivos en red, Azure.

## Seguridad
- [x] `.env` ya **no está trackeado** (commit `9b99b72`) y `docker-compose.yml` publica MySQL solo en `127.0.0.1:3307`. `.env.local` lo ignora `web/.gitignore`.
- [ ] Si las contraseñas que estuvieron en el historial de git se usan en otro lado, rotarlas.

## Por confirmar con Jared
Implementado en la API, **pendiente de que Adler lo acepte** y de pasarlo al contrato (tabla de arriba):

- [~] Precisión de timestamps: milisegundos en `endsAt`, `serverTime` y `X-Server-Time`.
- [~] `lastResult` en timeout: `chosenOptionId` y `answerTimeMs` en `null`, 0 puntos, −1 vida (SHIELD la evita).
- [~] Rangos de settings: jugadores 2–12 · rondas 1–15 · vidas 1–5.
- [~] CORS: permite `http://localhost:5173`, `Authorization`, `If-None-Match`, `Content-Type`; expone `ETag` y `X-Server-Time`.
- [x] Puerto de la API: 8000 (confirmado).
- [~] Forma de `activePower`: `PowerType | null`.
- [~] SHIELD absorbido: campo nuevo `powerUsed` en `lastResult`. **Adler: añadirlo a `LastResult` en `web/src/api/types.ts`** (hoy no aparece en `web/src`).

Siguen abiertos:

- [~] Revancha tras FINAL: **implementada el 14 oct (D13)**: `POST /rooms/{code}/games` acepta salas `FINISHED` (ver `docs/contrato/README.md` D13). Pendiente de que Jared la apruebe en el PR.
- [ ] Fórmula de bonus por velocidad y base por dificultad (definitivas; hoy provisionales en `api/app/scoring.py`).
- [ ] Fecha límite de entrega (la semana del 12 al 16 de oct; día exacto por confirmar).
- [x] Integración real: probada a mano el 12 oct (API + Website con `VITE_USE_MOCK=false`, partida completa, todos los poderes; Adler lo vio).

## Huecos del contrato detectados al construir el cliente (sesión 1)
> Estado 12 oct: la API ya implementa una respuesta para los cuatro primeros (milisegundos, `powerUsed`, timeout con −1 vida, y sigue sin existir `GET /players/me`). Falta que Adler las acepte y se pasen al contrato.

- [ ] **`X-Server-Time`: formato y precisión.** El contrato no dice si es ISO 8601 o epoch, y los ejemplos usan segundos enteros. Con segundos el desfase de reloj del cliente puede errar hasta ~1 s (el contador es solo visual, pero la intro dura 3 s). El cliente asume ISO 8601 (acepta también epoch) y, si falta el header, usa `serverTime` del cuerpo. Pedir milisegundos (`2026-09-04T18:30:06.250Z`) en header, `serverTime` y `endsAt`.
- [x] **SHIELD absorbido (resuelto 14 oct):** la API manda `lastResult.powerUsed` y el frontend lo usa (`LastResult.powerUsed` en `web/src/api/types.ts`; Reveal muestra "ESCUDO: NO PIERDES LA VIDA"). Verificado con la API real. Texto original del hueco: **No hay forma de saber si SHIELD absorbió la vida.** `lastResult` no trae `powerUsed`/`shieldAbsorbed` y `activePower` es `null` en el ejemplo de REVEAL. Inferirlo con `!isCorrect && livesLost === 0` es ambiguo con el timeout. Proponer a Jared un campo en `lastResult` (p. ej. `powerUsed: PowerType | null` o `shieldAbsorbed: boolean`) para animar el escudo en la pantalla 07.
- [ ] **`lastResult` en timeout (no respondió).** Ya estaba pendiente; para desarrollar el mock asume `chosenOptionId: null`, `answerTimeMs: null`, `basePoints: 0`, `speedBonus: 0`, `pointsAwarded: 0` y **`livesLost: 1`** (el timeout se trata como fallo; SHIELD lo evita). Confirmar con Jared que el servidor hace lo mismo. Los tipos ya permiten `null` en esos dos campos (como `round-results.json`).
- [ ] **No existe `GET /players/me`.** Un token guardado en `localStorage` solo se descubre inválido con un `401 UNAUTHORIZED` tardío (p. ej. tras reiniciar la API). El cliente reacciona limpiando la sesión y volviendo a Home con aviso; un endpoint de verificación (o aceptar el token en `GET /rooms/{code}`) lo haría inmediato.

## Spec de pantallas
- [x] **Pantalla 02 (Crear sala) corregida:** la acción es solo `POST /rooms` (por D2 el creador queda como host y primer participante, y la respuesta trae su `participantId`); no hay un segundo paso "crear sala". Corregido en `pantallas-spec.md`.

- [ ] **Pantalla 08 (Scoreboard) vs contrato:** la spec dice mostrar los puntos de la ronda (`pointsThisRound`) en el marcador, pero el contrato los manda en `null` durante `SCOREBOARD` (solo vienen en `REVEAL`). Gana el contrato: los puntos ganados por jugador se muestran en el REVEAL (07) y el marcador solo anima el puntaje propio (`me.lastResult.pointsAwarded`). Si se quiere la ganancia de todos en el marcador, pedir a Jared que `pointsThisRound` siga poblado en `SCOREBOARD`.
- [x] **Estadísticas (10/15):** implementadas en `/partida/:gameId/resultados` (tarjetas y tabla) con `GET /games/{id}/results`.
- [x] **Revancha (11):** JUGAR OTRA VEZ en el podio y en los resultados. El host llama `POST /rooms/{code}/games`; los demás ven "ESPERANDO AL HOST..." y entran solos al detectar un `currentGameId` nuevo en `GET /rooms/{code}`. SALIR hace `DELETE` y limpia la sesión. Probada con la API real (host e invitado).
- [ ] **Revancha: limitaciones conocidas** (de la API, ver `api/PLAN-API.md` §9): (a) quien sale con SALIR conserva su fila de participante y entra igual a la revancha sin responder (acaba de espectador); (b) los resultados de una partida vieja muestran el puntaje reiniciado cuando empieza la revancha. Si estorban: indicador de ausente (migración) y/o guardar el puntaje por partida.
- [ ] **Semántica de las estadísticas (D12):** el cliente muestra lo que manda `/results` sin recalcular. Confirmar con Jared: si `averageAnswerTimeMs` y `fastestAnswerMs` incluyen respuestas incorrectas, qué valen cuando el jugador no respondió nunca (hoy el mock manda `0` y el cliente muestra "—") y qué `bestRound` se manda sin puntos (el cliente muestra "—" si `points` es 0). En el mock, `totalAnswers` cuenta solo las rondas respondidas (no los timeouts); confirmar qué hace el servidor real.
- [ ] **Empates en el ranking:** el cliente confía en `position` del servidor y no resuelve empates por su cuenta. Pedir a Jared el criterio de desempate (¿orden de unión?, ¿tiempo?).

## Inconsistencias de la presentación
- La diapositiva 15 promete rondas "rápida" y "bomba" en v1; el contrato solo tiene `NORMAL` y `DOUBLE`. Ajustar la diapositiva o acordar con Jared.
