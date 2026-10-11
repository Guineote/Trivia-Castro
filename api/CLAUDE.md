# CLAUDE.md — API (api/) · Trivia Castro

> Contexto de Claude Code para el **frente A (API y datos)**. Lanza `claude` desde `api/`; también se carga el `CLAUDE.md` raíz (decisiones y reglas generales). Si algo de aquí contradice al raíz o al contrato, avisa a Jared antes de decidir.

## Quién es quién
- **Jared** = API (`api/`): FastAPI + SQLAlchemy + MySQL. El core del juego.
- **Adler** = frontend (`web/`): React. Ya está **completo contra un mock**; falta integrarlo con esta API.
- Proyecto escolar de la Universidad Panamericana Aguascalientes. Equipo de 2. Sin microservicios, sin sobreingeniería.

## Fuente de verdad
1. `docs/contrato/` (README, `endpoints.md`, `ejemplos/*.json`) **manda siempre**. Los JSON de ejemplo son el formato final: se usan como mocks y como esquema de pruebas.
2. `docs/frontend/GUIA-PARA-LA-API.md` = qué espera el frontend de la API, ejemplos de headers/ETag/errores en FastAPI, cómo probar y la lista de decisiones abiertas. **Léela antes de empezar.**
3. `docs/frontend/PENDIENTES.md` = dudas abiertas entre frontend y API.
4. `PLAN.md` = tareas A1–A12 y calendario.
5. `docs/etapa2/*` = material histórico, **no contractual** (tiene rondas FAST/BOMB, 5 poderes, estados ALIVE/ELIMINATED que NO existen).

Nunca inventes endpoints, campos ni códigos de error. Si falta algo, déjalo anotado en `docs/frontend/PENDIENTES.md` y avisa.

## Reglas no negociables (del `CLAUDE.md` raíz)
1. La API no entrega preguntas; **ejecuta el juego**.
2. El **tiempo** lo controla el servidor; el cliente solo dibuja un contador.
3. Los **puntos** se calculan en el servidor; el cliente nunca envía puntaje ni tiempo.
4. La verdad vive en `GET /games/{id}/state`; la pantalla lee, nunca decide.
5. Una respuesta por participante y ronda: **índice único `(roundId, participantId)` en la BD**.
6. **Un solo proceso** del servidor (o fases evaluadas por petición): nunca dos relojes sobre la misma partida.
7. Durante una partida no se toca la API externa de preguntas.

## Stack
FastAPI · SQLAlchemy + Alembic · MySQL 8.4 (`docker-compose.yml` en la raíz) · pytest · Pydantic con `alias_generator=to_camel` (el contrato usa **camelCase**). Entorno: `docker compose up -d` para MySQL; `.env` a partir de `.env.example` (**nunca commitear `.env`**).

## Convenciones del contrato que más se olvidan
- Base `/api/v1`; JSON en UTF-8; **ids como cadenas**; fechas ISO 8601 UTC con `Z`.
- Errores: `{ "error": { "code", "message" } }` (también los de validación de Pydantic y los 401/404 de FastAPI). El frontend decide por `code`.
- `X-Server-Time` en **todas** las respuestas (también 304 y errores), ideal con milisegundos.
- `GET /games/{id}/state`: `ETag` `"<gameId>-v<version>"`, `Vary: Authorization`, `304` sin cuerpo si `If-None-Match` coincide. `version` sube con cada cambio visible.
- Listas siempre envueltas en `{ "items": [...] }`.
- Sin `isCorrect` fuera de `REVEAL`; `lastResult` solo en `REVEAL` y `SCOREBOARD`; los campos que no aplican van en `null`, no se omiten.
- Un `DELETE` responde `204` sin cuerpo. `POST /rooms/{code}/players` responde `201` (nuevo) o `200` (ya era participante, mismo `participantId`).

## Referencia ejecutable
`web/src/mock/simulator.ts` implementa todas las reglas en TypeScript (fases, puntos, vidas, poderes, ranking, estadísticas) con pruebas en `web/src/test/simulator.test.ts`. No lo copies a ciegas: **lo marcado `SUPUESTO DE MOCK` no es una regla del juego** (puntos base, fórmula de velocidad, timeout, rangos…). Son decisiones de Jared, listadas en la sección 5 de `docs/frontend/GUIA-PARA-LA-API.md`.

## Orden de trabajo sugerido
A1 proyecto/BD → **A2 stubs con los JSON de `ejemplos/` y los headers correctos** (para que Adler integre desde el día 1) → A3 token → A4 salas → A5 contenido → A6 partida y `state` → A7 fases → A8 respuestas y puntos → A9 ranking/resultados → A10 poderes → A11 pruebas. Detalle en `PLAN.md`.

## Pruebas
- pytest: puntuación, transiciones de fase, respuesta duplicada, vidas.
- Pruebas de **forma**: comparar las claves y enums de las respuestas reales contra `docs/contrato/ejemplos/` (el frontend lo hace con las fixtures en `web/src/test/fixtures.test.ts`).
- Antes de pedir revisión: pruebas en verde.

## Flujo de trabajo con git
- Ramas `feat/api-<tema>`; PR hacia `main`. No tocar `web/` (es de Adler) salvo acuerdo; no editar `docs/contrato/` sin acordarlo con Adler **antes** de cambiar código.
- Commits pequeños y consistentes: `feat(api): POST /players con token`.
- **Seguridad:** `.env` está trackeado en el repo y MySQL se publica en todas las interfaces (ver `docs/frontend/PENDIENTES.md`): arreglar con `git rm --cached .env` y `127.0.0.1:3306` en `docker-compose.yml`.
