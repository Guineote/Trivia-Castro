# CLAUDE.md — Frontend (web/) · Trivia Chaos

> Nombre del juego: **Trivia Chaos** (en docs viejos aparece "Trivia Castro"). Equipo: Adler Antonio Calvillo Arellano (frontend) y Jared López García (API).

Este archivo es el contexto de Claude Code para el **frontend**. Se lanza `claude` desde `web/`; también se carga el `CLAUDE.md` raíz del repo (reglas generales del proyecto). Si algo aquí contradice al raíz, avisa a Adler antes de decidir.

## Quién es quién
- **Adler** = frontend (`web/`): pantallas, diseño, animaciones, sensación de juego en navegador.
- **Jared** = API (`api/`): el core del juego (FastAPI + SQLAlchemy + MySQL).
- Proyecto escolar de la Universidad Panamericana Aguascalientes. Equipo de 2. Sin microservicios, sin sobreingeniería.

## Fuente de verdad
1. `docs/contrato/` (README, `endpoints.md`, `ejemplos/*.json`) **manda siempre**. Si el contrato y cualquier otro doc difieren, gana el contrato.
2. `docs/frontend/design-brief.md` = dirección visual (arcade retro).
3. `docs/frontend/pantallas-spec.md` = las 15 pantallas, estados y animaciones.
4. `docs/etapa2/*` = material histórico de la exposición. **No es contractual** (tiene rondas FAST/BOMB, 5 poderes, estados ALIVE/ELIMINATED, que NO existen en el contrato).

Nunca inventes endpoints, campos ni códigos de error. Si falta algo, déjalo anotado en `docs/frontend/PENDIENTES.md` y pregunta a Adler.

## Stack
- React + Vite + **TypeScript**
- React Router
- TanStack Query (polling con `refetchInterval`)
- `motion` (`import { motion } from "motion/react"`) para animaciones
- `canvas-confetti` para victoria/podio
- CSS variables + CSS Modules (sin Tailwind; el look arcade es custom)
- Fuentes locales: `@fontsource/press-start-2p` (títulos) y `@fontsource/jetbrains-mono` (texto)
- Opcional: SFX con WebAudio, `qrcode.react` para el código de sala
- Vite proxy: `/api` → `http://localhost:8000` (confirmar puerto con Jared)

Si quieres cambiar una librería, propón el cambio y espera confirmación.

## Modelo del juego (resumen para no equivocarte)
- **Un solo endpoint manda en partida:** `GET /api/v1/games/{id}/state`, polling ~1 s.
- Envía `If-None-Match` con el último ETag (`"gameId-v<version>"`). Un **304** significa "nada cambió": conserva el estado actual, no hay body. No es error ni "no responder".
- Todas las respuestas (incluido 304) traen `X-Server-Time`. Calcula `offset = serverTime − Date.now()` y la cuenta regresiva como `endsAt − (Date.now() + offset)`.
- **El cliente nunca avanza la fase.** Los timers son solo visuales; la fase cambia cuando el servidor lo dice.
- Fases: `ROUND_INTRO` (3 s) → `QUESTION` (20 s) → `REVEAL` (4 s) → `SCOREBOARD` (6 s) → … → `FINAL`.
- Tipos de ronda: `NORMAL` (x1), `DOUBLE` (x2). Poderes: `DOUBLE`, `SHIELD`, `HINT`. DOUBLE ronda + DOUBLE poder = x4.
- Participante: `ACTIVE` | `SPECTATOR` (0 vidas → espectador, no responde, sí ve todo).
- `round` es `null` en `FINAL`. `ranking`/`winner` solo vienen poblados al final.
- `me.lastResult` trae el desglose (base, velocidad, ronda, poder, `pointsAwarded`). Puntaje previo = `me.score − lastResult.pointsAwarded`. Úsalo para animar el conteo de puntos.
- Auth: `POST /players` (nickname 2–20) devuelve token Bearer → guardarlo y mandarlo en `Authorization`. Distingue `playerId` de `participantId`.
- Unirse a sala (`POST /rooms/{code}/players`): 201 = nuevo, 200 = reconexión (mismo `participantId`). El lobby hace polling a `GET /rooms/{code}` hasta que `currentGameId` deje de ser `null`.
- Errores: `{ "error": { "code", "message" } }`. **Decide por `error.code`, nunca por el texto.**

## Estructura sugerida de `web/src`
```
src/
  api/          cliente fetch, tipos del contrato, hooks (useGameState, useRoom…)
  mock/         fixtures desde docs/contrato/ejemplos + simulador de partida
  screens/      una carpeta por pantalla (01-… a 15-…)
  components/   piezas arcade reutilizables (PixelButton, LifeHearts, Timer, ScoreTally…)
  styles/       tokens.css (variables), global.css, animaciones
  lib/          clock offset, sonido, utilidades
  dev/          DevPanel (solo en desarrollo)
```

## Modo mock (obligatorio desde el día 1)
Adler no debe depender de que la API esté lista.
- `VITE_USE_MOCK=true` → el cliente usa fixtures y un **simulador** que recorre las fases con los tiempos reales.
- **DevPanel** (solo dev): cambiar fase manualmente, alternar jugador/espectador, ronda NORMAL/DOUBLE, simular fallo de red, cámara lenta de animaciones.
- Los tipos TypeScript se derivan de los JSON en `docs/contrato/ejemplos/`. Si la API real difiere, se arregla el tipo y se avisa a Jared.

## Reglas de calidad de UI
- Prioridad nº 1: que **se vea y se sienta como un juego**. Cada transición de fase tiene animación; nada aparece "de golpe".
- Respeta `prefers-reduced-motion` (versión sobria de las animaciones).
- Legible en proyector (la exposición) y en celular vertical. Mínimo 360 px de ancho.
- Botones de respuesta grandes y táctiles; estado deshabilitado claro tras responder.
- Nada de efecto máquina de escribir en la pregunta (el timer del servidor ya corre).
- En `REVEAL`: primero neutraliza el color de la opción elegida, luego resalta la correcta en verde (si no, "elegida" y "correcta" se confunden).
- Accesibilidad básica: foco visible, `aria-live` para cambios de fase, no depender solo del color.
- Sin `console.log` en commits. Sin claves ni tokens en el código.

## Flujo de trabajo con git
- Trabajar en ramas `feat/web-<tema>`; PR hacia `main`. No tocar `api/` (es de Jared) salvo acuerdo.
- Commits pequeños, en español o inglés pero consistentes. Mensajes claros: `feat(web): pantalla de pregunta con timer`.
- Antes de pedir revisión: `npm run build` y `npm run lint` sin errores.
- **Seguridad:** nunca commitear `.env`, `.env.local` ni secretos. (Ver `docs/frontend/PENDIENTES.md`: `.env` está trackeado en el repo.)

## Pendientes abiertos con Jared (no asumir)
Precisión en ms de timestamps · `lastResult` cuando no se responde/timeout · rangos de UI para settings (rondas, vidas, maxPlayers) · CORS (exponer `ETag`, `X-Server-Time`; permitir `Authorization`, `If-None-Match`) o usar proxy · puerto de la API · revancha tras FINAL · forma exacta de `activePower` (se asume `PowerType | null`) · día límite de entrega.

## Cómo empezar (primera sesión)
1. Lee `docs/contrato/` completo y `docs/frontend/*`.
2. Inicializa `web/` con Vite + React + TS e instala las dependencias de arriba.
3. Crea `tokens.css` desde el design brief, los tipos desde los ejemplos y el modo mock.
4. Construye en este orden: layout + tokens → Home/Crear/Unirse → Lobby → ciclo de partida (intro, pregunta, reveal, scoreboard) → Final/podio → pulido y sonido.
5. Cada pantalla se termina con su animación de entrada/salida antes de pasar a la siguiente.
