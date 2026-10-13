# CLAUDE.md — API (api/) · Trivia Castro

> Contexto de Claude Code para el **frente A (API y datos)**. Lanza `claude` desde `api/`; también se carga el `CLAUDE.md` raíz (decisiones y reglas generales). Si algo de aquí contradice al raíz o al contrato, avisa a Jared antes de decidir.

## Quién es quién
- **Jared** = API (`api/`): FastAPI + SQLAlchemy + MySQL. El core del juego.
- **Adler** = frontend (`web/`): React. Está **completo contra un mock**; falta registrar la integración real con esta API.
- Proyecto escolar de la Universidad Panamericana Aguascalientes. Equipo de 2. Sin microservicios, sin sobreingeniería.

## Estado (12 oct 2026)
La API **está implementada y probada** (25 pruebas pytest en verde, sobre SQLite): 17 de los 18 endpoints del contrato (falta solo `POST /questions/import`, descartado), seed de 120 preguntas, fases perezosas, puntos, poderes, ranking, estadísticas y `scripts/play_bots.py`. Detalle por hito en [`PLAN-API.md`](PLAN-API.md); cómo correrla en [`README.md`](README.md). La Integración 1 y 2 con el Website y MySQL se probó a mano el 12 oct (pestaña normal + incógnito + bots, todos los poderes).

## Fuente de verdad
1. `docs/contrato/` (README, `endpoints.md`, `ejemplos/*.json`) **manda siempre**. Los JSON de ejemplo son el formato final: se usan como mocks y como esquema de pruebas.
2. `docs/frontend/GUIA-PARA-LA-API.md` = qué espera el frontend de la API, ejemplos de headers/ETag/errores en FastAPI, cómo probar y la lista de decisiones abiertas. **Léela antes de empezar.**
3. `docs/frontend/PENDIENTES.md` = dudas abiertas entre frontend y API.
4. `PLAN.md` = tareas A1–A12 y calendario. `api/PLAN-API.md` = estado real de la API, decisiones propias del frente A y pendientes.
5. `docs/etapa2/*` = material histórico, **no contractual** (tiene rondas FAST/BOMB, 5 poderes, estados ALIVE/ELIMINATED que NO existen).

Nunca inventes endpoints, campos ni códigos de error. Si falta algo, déjalo anotado en `docs/frontend/PENDIENTES.md` y avisa.

## Reglas no negociables (del `CLAUDE.md` raíz)
1. La API no entrega preguntas; **ejecuta el juego**.
2. El **tiempo** lo controla el servidor; el cliente solo dibuja un contador.
3. Los **puntos** se calculan en el servidor; el cliente nunca envía puntaje ni tiempo.
4. La verdad vive en `GET /games/{id}/state`; la pantalla lee, nunca decide.
5. Una respuesta por participante y ronda: **índice único `(roundId, participantId)` en la BD**.
6. **Un solo proceso** (`uvicorn` **sin** `--workers`): las fases se evalúan por petición (`games.tick`) y `GAME_LOCK` serializa las peticiones; nunca dos relojes sobre la misma partida.
7. Durante una partida no se toca la API externa de preguntas.

## Stack
FastAPI · SQLAlchemy 2 **síncrono** + Alembic · MySQL 8.4 (`docker-compose.yml` en la raíz; contenedor `trivia-castro`, base `trivia_castro`, puerto `127.0.0.1:3307`) · pytest (SQLite en memoria + reloj falso) · Pydantic con `alias_generator=to_camel` (el contrato usa **camelCase**). La API corre en el puerto **8000**. Entorno: `docker compose up -d` para MySQL; `.env` a partir de `.env.example` (**nunca commitear `.env`**; ya no está trackeado).

## Convenciones del contrato que más se olvidan
- Base `/api/v1`; JSON en UTF-8; **ids como cadenas** (la API usa prefijo + entero: `p1`, `pt2`, `g3`, `q4`, `o5`, `c6`); fechas ISO 8601 UTC con `Z` y milisegundos.
- Errores: `{ "error": { "code", "message" } }` (también los de validación de Pydantic y los 401/404 de FastAPI). El frontend decide por `code`.
- `X-Server-Time` en **todas** las respuestas (también 304 y errores), ideal con milisegundos.
- `GET /games/{id}/state`: `ETag` `"<gameId>-v<version>"`, `Vary: Authorization`, `304` sin cuerpo si `If-None-Match` coincide. `version` sube con cada cambio visible.
- Listas siempre envueltas en `{ "items": [...] }`.
- Sin `isCorrect` fuera de `REVEAL`; `lastResult` solo en `REVEAL` y `SCOREBOARD`; los campos que no aplican van en `null`, no se omiten.
- Un `DELETE` responde `204` sin cuerpo. `POST /rooms/{code}/players` responde `201` (nuevo) o `200` (ya era participante, mismo `participantId`).

## Referencia ejecutable
`web/src/mock/simulator.ts` implementa todas las reglas en TypeScript (fases, puntos, vidas, poderes, ranking, estadísticas) con pruebas en `web/src/test/simulator.test.ts`. No lo copies a ciegas: **lo marcado `SUPUESTO DE MOCK` no es una regla del juego** (puntos base, fórmula de velocidad, timeout, rangos…). Son decisiones de Jared, listadas en la sección 5 de `docs/frontend/GUIA-PARA-LA-API.md`.

## Siguientes pasos
A1–A11 están hechas (los stubs de A2 se omitieron: se implementó la lógica real). Quedan: **(1)** acordar con Adler los campos extra (`powerUsed`, milisegundos, `NOT_FOUND`/`INTERNAL_ERROR`; ver `PLAN-API.md` §3) y pasarlos al contrato; **(2)** el manual de la API; **(3)** pulido (limpieza de salas) y ensayo con varios dispositivos. A12 `POST /questions/import` está descartado. Detalle en `PLAN-API.md` y `PLAN.md`.

## Pruebas
- pytest: puntuación, transiciones de fase, respuesta duplicada, vidas.
- Pruebas de **forma**: comparar las claves y enums de las respuestas reales contra `docs/contrato/ejemplos/` (el frontend lo hace con las fixtures en `web/src/test/fixtures.test.ts`).
- Antes de pedir revisión: pruebas en verde.

## Flujo de trabajo con git
- Ramas `feat/api-<tema>`; PR hacia `main`. No tocar `web/` (es de Adler) salvo acuerdo; no editar `docs/contrato/` sin acordarlo con Adler **antes** de cambiar código.
- Commits pequeños y consistentes: `feat(api): POST /players con token`.
- **Seguridad:** resuelto. `.env` ya no está trackeado y MySQL se publica solo en `127.0.0.1:3307`. Si alguna contraseña de `.env` se usa en otro lado, cámbiala (estuvo en el historial).
