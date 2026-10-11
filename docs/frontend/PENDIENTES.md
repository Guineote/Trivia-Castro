# Pendientes y alertas (frontend ↔ API)

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

## Inconsistencias de la presentación
- La diapositiva 15 promete rondas "rápida" y "bomba" en v1; el contrato solo tiene `NORMAL` y `DOUBLE`. Ajustar la diapositiva o acordar con Jared.
