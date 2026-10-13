# Trivia Castro — Plan de trabajo en paralelo

> Complementa a `CLAUDE.md` (contexto y decisiones). **Entrega: la próxima semana** (día exacto por confirmar). El plan está pensado en 7 días corridos; si la fecha es antes, se recorta según la prioridad (sección 5).
> **Estado (12 oct):** los frentes A (A1–A11) y B están construidos e integrados (prueba manual del 12 oct); falta cerrar decisiones con Adler, el manual de la API y el ensayo. Ver sección 8 y `api/PLAN-API.md`.
> **Responsables:** Jared lleva el frente A (API y datos) y Adler el frente B (Website). El bloque C (contrato compartido) es de ambos y ya está confirmado (`docs/contrato/`). Ver sección 7.

## 1. Cómo se divide

| Bloque | Contenido | Quién |
|---|---|---|
| **C. Contrato compartido** | Congelar endpoints, esquema de `/state`, enums y errores. Lo hacen juntos, al inicio. | Ambos |
| **A. API y datos** | FastAPI, MySQL, reglas del juego, scheduler, puntuación. | Jared |
| **B. Website** | React, 15 pantallas, polling, manejo de errores. | Adler |

La clave para no bloquearse: **la API arranca con stubs** (rutas que devuelven JSON de ejemplo con el formato final) y el Website trabaja contra esos stubs o contra archivos mock. Así B no espera a que A termine la lógica real.

## 2. Bloque C — Contrato compartido (Día 1, juntos)

- C1. Congelar lista de endpoints y rutas bajo `/api/v1` (ver `CLAUDE.md`, sección 7).
- C2. Congelar el JSON de `GET /games/{id}/state` y escribir **un ejemplo por fase**: `ROUND_INTRO`, `QUESTION`, `REVEAL`, `SCOREBOARD`, `FINAL`, más variantes de espectador y jugador que ya respondió.
- C3. Congelar enums: `phase`, `roundType` (NORMAL, DOUBLE), `powerType` (DOUBLE, SHIELD, HINT), `status` del participante (activo, espectador).
- C4. Congelar formato de errores (código HTTP + mensaje) y formato de fechas (ISO 8601 UTC).
- C5. Crear el repositorio con carpetas `/api`, `/web`, `/docs` y el `docker-compose` con MySQL. Ramas por frente y `main` solo para integrar.
- **Salida:** carpeta `/docs/contrato/` con los JSON de ejemplo. Es la fuente de verdad para ambos frentes.

## 3. Frente A — API y datos

| # | Tarea | Depende de |
|---|---|---|
| A1 | Proyecto FastAPI + conexión MySQL + migraciones (Alembic). Modelos de las 10 entidades, incluido el índice único `(roundId, participantId)`. | C |
| A2 | **Stubs** de todos los endpoints con el JSON del contrato (para que B pueda integrar desde el Día 2). | C |
| A3 | Jugadores y token: `POST /players`, autenticación Bearer. | A1 |
| A4 | Salas: crear, consultar, modificar, unirse (409 sala llena, 422 nombre repetido, 404 no existe), salir. | A3 |
| A5 | Contenido: tabla de categorías, seed de preguntas propias (10 categorías), `GET /categories`, `GET/POST /questions`. | A1 |
| A6 | Partidas: `POST /rooms/{code}/games`, `GET /games/{id}/state` con ETag y 304, versión que se incrementa en cada cambio. | A4, A5 |
| A7 | Scheduler de fases (INTRO 3 s, QUESTION 20 s, REVEAL 4 s, SCOREBOARD 6 s) y `POST /games/{id}/advance` para el host. | A6 |
| A8 | Respuestas y puntuación: `POST .../answers`, validación de una sola respuesta, función de puntos con **bonus de velocidad como función aislada y reemplazable** (fórmula pendiente), vidas, paso a espectador. | A7 |
| A9 | Ranking y resultados: `/ranking` (con `positionDelta`), `/rounds/{n}/results`, `/results`. | A8 |
| A10 | Poderes: `POST .../powers` (doble, escudo, pista). | A8 |
| A11 | Pruebas con pytest: puntuación, transiciones de fase, respuesta duplicada, vidas. | A8 |
| A12 | *(opcional)* `POST /questions/import` desde API externa, con deduplicación por `externalId`. | A5 |

## 4. Frente B — Website

| # | Tarea | Depende de |
|---|---|---|
| B1 | Proyecto React (Vite), rutas, cliente HTTP que adjunta el token, almacenamiento del token. | C |
| B2 | Hook de polling de `/state` cada ~1 s con `If-None-Match` (200 / 304) y contador calculado con `endsAt - serverTime`. | C |
| B3 | Pantallas fuera de partida: 01 Principal, 02 Crear partida, 03 Unirse, 04 Sala de espera. | B1 |
| B4 | Pantallas de partida desde un solo recurso (`phase`): 05 Intro de ronda, 06 Pregunta, 08 Esperando, 09 Resultado, 10 Ranking, 12 Final. Se desarrollan con **mocks** de C2. | B2 |
| B5 | Pantallas 07 Poderes y 11 Espectador. | B4 |
| B6 | Manejo de errores con los mensajes ya definidos (404, 409, 422) y pantalla de **Reconexión** cuando el polling falla. | B2 |
| B7 | *(opcional)* 13 Estadísticas y 14 Apuesta (la Apuesta aún no está definida). | B4 |
| B8 | Pulido visual y adaptación a móvil. | B4 |

## 5. Prioridades (para recortar si falta tiempo)

- **Imprescindible (MVP):** crear sala, unirse, sala de espera, iniciar partida, rondas con las 5 fases, responder, puntos, vidas, ranking, pantalla final, token, polling con ETag. Rondas NORMAL y DOUBLE.
- **Deseable:** poderes (doble, escudo, pista), espectador, reconexión, estadísticas, pruebas automáticas.
- **Si sobra tiempo:** pantalla de Apuesta, importación de la API externa, pulido visual.

## 6. Calendario sugerido (7 días)

| Día | Frente A | Frente B | Juntos |
|---|---|---|---|
| 1 | Entorno, A1 | Entorno, B1 | **Bloque C completo** |
| 2 | A2 (stubs), A3 | B2, B3 | |
| 3 | A4, A5 | B3, B4 | |
| 4 | A6, A7 | B4 | **Integración 1:** crear/unirse y sala de espera contra la API real |
| 5 | A8, A9 | B4, B5, B6 | |
| 6 | A10, A11 | B6, B8 | **Integración 2:** partida completa de punta a punta |
| 7 | Correcciones | Correcciones | **Ensayo de la exposición** con varios dispositivos |

## 7. Responsables

- Frente A (API y datos): **Jared**
- Frente B (Website): **Adler**
- Bloque C (contrato compartido): ambos. Decisiones D1 a D12 confirmadas en `docs/contrato/README.md`.

## 8. Estado por tarea (12 oct 2026)

| Tarea | Estado |
|---|---|
| C (contrato) | ✅ v0.2, D1–D12 confirmadas |
| A1–A11 (API) | ✅ Implementadas. A2 (stubs) se omitió: se hizo la lógica real. 25 pruebas pytest en verde (SQLite) |
| A12 (importar preguntas) | ⛔ Descartada: se usa el seed de 120 preguntas |
| B1–B8 (Website) | ✅ Completos contra el mock; la pantalla 14 Apuesta no se construye |
| Integración 1 (crear/unirse/lobby) | ✅ Probada a mano el 12 oct (Website con `VITE_USE_MOCK=false` + API) |
| Integración 2 (partida completa) | ✅ Probada a mano el 12 oct: pestaña normal + incógnito + bots, todos los poderes; Adler lo vio |
| Validar en MySQL real | ✅ La API corrió contra el contenedor MySQL en esa prueba |
| Manual de la API (entregable) | 🔲 Pendiente |
| Ensayo de la exposición | 🔲 Pendiente |

## 9. Pendientes de definición que pueden afectar el plan

- Fórmula del bonus de velocidad (se aísla en una función para cambiarla sin tocar lo demás).
- Puntaje base de cada dificultad (los niveles `EASY`, `MEDIUM`, `HARD` ya están definidos).
- Pantalla 14 (Apuesta): sin descripción en la documentación.
- Dónde se mostrará el juego en la exposición (local o en línea).
