# Pendientes y alertas (frontend ↔ API)

## Resumen para Jared (frente A)

El frontend ya recorre todo el juego contra un mock (ver [`web/README.md`](../../web/README.md)). Para conectarlo a la API real, lo mínimo que necesita:

1. **Headers:** `X-Server-Time` en *todas* las respuestas (incluidas 304), `ETag` `"<gameId>-v<version>"` y `Vary: Authorization` en `GET /games/{id}/state`.
2. **Errores** en formato `{ "error": { "code", "message" } }` (también los de validación de Pydantic).
3. **Puerto y CORS:** confirmar el puerto (se asume 8000). Con el proxy de Vite no hay CORS; si no, permitir `Authorization`/`If-None-Match` y exponer `ETag`/`X-Server-Time`.
4. **Decisiones que el mock tuvo que inventar** y que dependen de ti (detalle abajo): `lastResult` en timeout, cómo saber si el SHIELD absorbió la vida, forma de `activePower`, formato/precisión de `X-Server-Time`, rangos de `settings`, y si `pointsThisRound` sigue poblado en `SCOREBOARD`.
5. **Seguridad del repo:** `.env` está trackeado y `docker-compose.yml` publica MySQL en todas las interfaces (primer punto de abajo).

Los supuestos del mock están marcados como `SUPUESTO DE MOCK` en `web/src/mock/simulator.ts`: **no son reglas del juego**.

## Seguridad
- [ ] `.env` está **trackeado** en el repo público (subido por web). Arreglar: `git rm --cached .env`, commit, y avisar a Jared. Si esos valores se usan en otro lado, rotarlos. En `docker-compose.yml`, publicar MySQL solo en `127.0.0.1:3306`. Añadir `.env.local` al `.gitignore`.

## Por confirmar con Jared
- [ ] Precisión de timestamps (¿milisegundos?) para `endsAt` / `serverTime`.
- [ ] `lastResult` cuando el jugador no responde (timeout).
- [ ] Rangos permitidos en settings (rondas, vidas, maxPlayers) para los sliders.
- [ ] CORS: exponer `ETag` y `X-Server-Time`; permitir `Authorization` e `If-None-Match`. Alternativa: proxy de Vite.
- [ ] Puerto de la API (se asume 8000).
- [ ] Revancha tras FINAL.
- [ ] Forma de `activePower` (se asume `PowerType | null`).
- [ ] Fórmula de bonus por velocidad y base por dificultad (solo para textos de ayuda en UI).
- [ ] Fecha límite de entrega.

## Huecos del contrato detectados al construir el cliente (sesión 1)
- [ ] **`X-Server-Time`: formato y precisión.** El contrato no dice si es ISO 8601 o epoch, y los ejemplos usan segundos enteros. Con segundos el desfase de reloj del cliente puede errar hasta ~1 s (el contador es solo visual, pero la intro dura 3 s). El cliente asume ISO 8601 (acepta también epoch) y, si falta el header, usa `serverTime` del cuerpo. Pedir milisegundos (`2026-09-04T18:30:06.250Z`) en header, `serverTime` y `endsAt`.
- [ ] **No hay forma de saber si SHIELD absorbió la vida.** `lastResult` no trae `powerUsed`/`shieldAbsorbed` y `activePower` es `null` en el ejemplo de REVEAL. Inferirlo con `!isCorrect && livesLost === 0` es ambiguo con el timeout. Proponer a Jared un campo en `lastResult` (p. ej. `powerUsed: PowerType | null` o `shieldAbsorbed: boolean`) para animar el escudo en la pantalla 07.
- [ ] **`lastResult` en timeout (no respondió).** Ya estaba pendiente; para desarrollar el mock asume `chosenOptionId: null`, `answerTimeMs: null`, `basePoints: 0`, `speedBonus: 0`, `pointsAwarded: 0` y **`livesLost: 1`** (el timeout se trata como fallo; SHIELD lo evita). Confirmar con Jared que el servidor hace lo mismo. Los tipos ya permiten `null` en esos dos campos (como `round-results.json`).
- [ ] **No existe `GET /players/me`.** Un token guardado en `localStorage` solo se descubre inválido con un `401 UNAUTHORIZED` tardío (p. ej. tras reiniciar la API). El cliente reacciona limpiando la sesión y volviendo a Home con aviso; un endpoint de verificación (o aceptar el token en `GET /rooms/{code}`) lo haría inmediato.

## Spec de pantallas
- [x] **Pantalla 02 (Crear sala) corregida:** la acción es solo `POST /rooms` (por D2 el creador queda como host y primer participante, y la respuesta trae su `participantId`); no hay un segundo paso "crear sala". Corregido en `pantallas-spec.md`.

- [ ] **Pantalla 08 (Scoreboard) vs contrato:** la spec dice mostrar los puntos de la ronda (`pointsThisRound`) en el marcador, pero el contrato los manda en `null` durante `SCOREBOARD` (solo vienen en `REVEAL`). Gana el contrato: los puntos ganados por jugador se muestran en el REVEAL (07) y el marcador solo anima el puntaje propio (`me.lastResult.pointsAwarded`). Si se quiere la ganancia de todos en el marcador, pedir a Jared que `pointsThisRound` siga poblado en `SCOREBOARD`.
- [x] **Estadísticas (10/15):** implementadas en `/partida/:gameId/resultados` (tarjetas y tabla) con `GET /games/{id}/results`.
- [ ] **Revancha (11):** el final solo ofrece ESTADISTICAS y SALIR (vuelve a Home). Falta definir con Jared cómo se pide una revancha en la misma sala (¿otro `POST /rooms/{code}/games`?).
- [ ] **Semántica de las estadísticas (D12):** el cliente muestra lo que manda `/results` sin recalcular. Confirmar con Jared: si `averageAnswerTimeMs` y `fastestAnswerMs` incluyen respuestas incorrectas, qué valen cuando el jugador no respondió nunca (hoy el mock manda `0` y el cliente muestra "—") y qué `bestRound` se manda sin puntos (el cliente muestra "—" si `points` es 0). En el mock, `totalAnswers` cuenta solo las rondas respondidas (no los timeouts); confirmar qué hace el servidor real.
- [ ] **Empates en el ranking:** el cliente confía en `position` del servidor y no resuelve empates por su cuenta. Pedir a Jared el criterio de desempate (¿orden de unión?, ¿tiempo?).

## Inconsistencias de la presentación
- La diapositiva 15 promete rondas "rápida" y "bomba" en v1; el contrato solo tiene `NORMAL` y `DOUBLE`. Ajustar la diapositiva o acordar con Jared.
