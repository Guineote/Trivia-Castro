# Trivia Castro — Frontend (`web/`)

Website del juego: React + Vite + TypeScript. Consume la API de `api/` (FastAPI) siguiendo el contrato de [`docs/contrato/`](../docs/contrato/README.md), que **manda siempre** si algo difiere.

Se puede desarrollar **sin la API**: el modo mock simula el servidor completo (salas, partida, fases, puntos, bots).

## Requisitos

- Node `^20.19` o `>=22.12` y npm.

## Comandos

Desde `web/`:

| Comando | Qué hace |
|---|---|
| `npm install` | Instala dependencias |
| `npm run dev` | Servidor de desarrollo en `http://localhost:5173` |
| `npm run build` | Typecheck (`tsc -b`) + build de producción en `dist/` |
| `npm run lint` | oxlint |
| `npm test` | Pruebas (vitest): fixtures vs contrato, reloj, simulador, cliente HTTP, lógica de pantallas, formato y preferencias |

Antes de pedir revisión: `npm run build`, `npm run lint` y `npm test` sin errores.

## Modo mock o API real

El modo se elige con `VITE_USE_MOCK` (archivo `web/.env.local`, que git ignora):

```powershell
Copy-Item .env.example .env.local   # PowerShell
```

```bash
cp .env.example .env.local          # bash
```

| `VITE_USE_MOCK` | Comportamiento |
|---|---|
| `true` | El cliente usa un servidor falso en el navegador. No hace falta API ni base de datos. |
| vacío / `false` | El cliente llama a `/api/v1/...`. Vite lo reenvía a `http://localhost:8000` (`server.proxy` en `vite.config.ts`; puerto 8000 confirmado). |

Al cambiar `.env.local` hay que reiniciar `npm run dev`. Para un `build` de producción borra `.env.local` (si no, el mock entra en el bundle).

### El mock

- Es un servidor falso a nivel de `fetch`: devuelve `Response` reales con `ETag`, `304`, `X-Server-Time` y errores `{ "error": { "code", "message" } }`, así que el **mismo cliente real** se ejercita en mock.
- El simulador recorre las fases con los tiempos reales (`ROUND_INTRO` 3 s, `QUESTION` 20 s, `REVEAL` 4 s, `SCOREBOARD` 6 s) y trae 3 bots (Beto, Caro, Dani) y 15 preguntas de ejemplo.
- Persiste en `localStorage` (sobrevive a recargas). El botón "REINICIAR MUNDO MOCK" lo borra.
- Todo lo que el contrato deja abierto está marcado como **SUPUESTO DE MOCK** en `src/mock/simulator.ts` (puntos base por dificultad, fórmula de velocidad, timeout = pierde vida, un poder por ronda, rangos de ajustes). **No son reglas reales del juego.**

### DevPanel (solo `npm run dev`)

Botón **DEV** abajo a la derecha, o la tecla `` ` ``:

- **INICIAR:** crea sala con 3 bots y abre la partida.
- Saltar de fase, alternar jugador/espectador y ronda NORMAL/DOUBLE, recargar poderes.
- Red caída, latencia, timestamps en segundos enteros, cámara lenta (×2/×4).
- **Fixture estática:** congela `GET /state` con cualquiera de los JSON de `docs/contrato/ejemplos/` y abre `/partida/fixture` (para diseñar una pantalla sin esperar).
- Monitor en vivo: fase, versión, cuenta atrás, offset de reloj, contador de 200/304.

## Rutas y pantallas

Numeración de [`docs/frontend/pantallas-spec.md`](../docs/frontend/pantallas-spec.md).

| Ruta | Pantalla |
|---|---|
| `/` | 01 Home (nickname → `POST /players`) |
| `/crear` | 02 Crear sala (`POST /rooms`) |
| `/unirse` | 03 Unirse (`POST /rooms/{code}/players`, 201 nuevo / 200 reconexión) |
| `/sala/:code` | 04 Lobby (polling de `GET /rooms/{code}` hasta `currentGameId`) |
| `/partida/:gameId` | 05 Intro · 06 Pregunta · 07 Reveal · 08 Marcador · 09 Final, más variante espectador. **Una sola ruta:** la pantalla la decide `phase` del `GET /games/{id}/state` |
| `/partida/:gameId/resultados` | 10 Estadísticas (tarjetas de jugador) y 15 Resultados detallados (tabla para proyector), con un selector de vista. Usa `GET /games/{id}/results` |

Pantalla 14 (sala llena / código inválido / partida ya iniciada): `ErrorPanel` con un fantasma pixel, titulado por `error.code`. Se muestra desde Unirse (`ROOM_FULL`, `ROOM_NOT_FOUND`, `GAME_ALREADY_STARTED`), el Lobby y la partida. El banner "RECONECTANDO..." (pantalla 13) aparece cuando el polling lleva 2 o más fallos seguidos, sin bloquear la pantalla.

Aún no está: la revancha (el botón del final solo vuelve al inicio; pendiente con Jared) y la pantalla de Apuesta (no está definida en el contrato).

## Sonido y efecto CRT

Dos botones (arriba a la derecha; dentro de la barra superior durante la partida):

- **Sonido:** bleeps de arcade generados con WebAudio (sin archivos de audio). No suena nada hasta el primer clic o tecla del usuario (política de autoplay). El mute persiste en `localStorage` (`trivia-castro.prefs`). Suena en: clic de botones, enviar respuesta, tick del timer en los últimos 5 s, acierto/fallo en el reveal, vida perdida, poder, desglose de puntos, entrada de jugadores al Lobby, inicio de partida, banner ×2, cortinilla y fanfarria final. El código está en `src/lib/sound.ts`.
- **CRT:** scanlines y viñeta opcionales, apagado por defecto. Se desactiva solo con `prefers-reduced-motion`.

## Cómo está armado

```
src/
  api/          cliente HTTP (ETag/304, X-Server-Time, errores por error.code), tipos del contrato, hooks de polling, sesión
  mock/         servidor falso + simulador + fixtures (importa docs/contrato/ejemplos)
  screens/      una carpeta por pantalla (01-Home … 09-Final) y game/ (contenedor de la partida)
  components/   piezas arcade reutilizables (PixelButton, Panel, Timer, LifeHearts, PowerSlot, ScoreTally…)
  styles/       tokens.css (design brief), global.css, fuentes locales
  lib/          reloj del servidor, fases, animación, sonido (WebAudio), preferencias, formato, ajustes
  dev/          DevPanel
  test/         vitest
```

Principios que el código respeta (del `CLAUDE.md` raíz):

- **El servidor manda.** El cliente nunca avanza la fase, nunca calcula ni envía puntos o tiempos. `GET /state` se consulta cada ~1 s con `If-None-Match`; un `304` conserva el estado anterior sin redibujar.
- **El reloj es solo visual:** `restante = endsAt − (relojLocal + offset)`, con `offset` tomado de `X-Server-Time` en cada respuesta (también en 304).
- Los errores se deciden por `error.code`, nunca por el texto del servidor. Un `401` limpia la sesión y vuelve a Home.
- Mínimo 360 px de ancho; respeta `prefers-reduced-motion`.

## Qué necesita el frontend de la API real

Resumen para quien lleva `api/`. **Estado 12 oct:** la API ya implementa todo lo de la lista (ver `api/PLAN-API.md`); se probó jugando una partida real con `VITE_USE_MOCK=false` el 12 oct. **Guía completa:** [`docs/frontend/GUIA-PARA-LA-API.md`](../docs/frontend/GUIA-PARA-LA-API.md). El estado de cada duda está en [`docs/frontend/PENDIENTES.md`](../docs/frontend/PENDIENTES.md).

- [x] Todas las respuestas, **incluidas las 304**, con `X-Server-Time` (se asume ISO 8601; **mejor con milisegundos**).
- [x] `ETag` con forma `"<gameId>-v<version>"` y `Vary: Authorization` en `GET /games/{id}/state`.
- [x] Errores con el formato `{ "error": { "code", "message" } }` (manejador propio en FastAPI, incluida la validación de Pydantic).
- [x] Puerto `8000` confirmado. Si el frontend no va por el proxy de Vite, CORS debe permitir `Authorization` e `If-None-Match` y exponer `ETag` y `X-Server-Time`.
- [~] Decidido en la API (timeout = −1 vida con `null`s; `powerUsed` en `lastResult`; `activePower` es `PowerType | null`); pendiente de aceptar y de añadir `powerUsed` a `src/api/types.ts`.
- [~] Rangos de `settings` implementados: jugadores 2–12 · rondas 1–15 · vidas 1–5 (pendiente de aceptar).

Si la API real difiere del contrato, se arregla el tipo en `src/api/types.ts` y se avisa al otro integrante; el contrato se actualiza **antes** de tocar código.

## Flujo de trabajo

- Ramas `feat/web-<tema>`, PR hacia `main`. No tocar `api/` ni `docs/contrato/` sin acuerdo.
- Nunca commitear `.env`, `.env.local` ni secretos.
- Contexto para Claude Code: [`CLAUDE.md`](CLAUDE.md) (frontend) y el `CLAUDE.md` raíz.
