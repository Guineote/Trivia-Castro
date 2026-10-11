# Pantallas — Trivia Chaos (especificación para el frontend)

Basado en el contrato (`docs/contrato/`). Si hay diferencia, gana el contrato. Las pantallas 05–11 y 15 se alimentan **solo** de `GET /games/{id}/state`.

## Estado de implementación (frontend)

| Spec | Pantalla | Ruta | Estado |
|---|---|---|---|
| 01 | Home | `/` | hecho |
| 02 | Crear sala | `/crear` | hecho |
| 03 | Unirse | `/unirse` | hecho |
| 04 | Lobby | `/sala/:code` | hecho |
| 05 | Round intro | `/partida/:gameId` (`phase = ROUND_INTRO`) | hecho |
| 06 | Pregunta | `/partida/:gameId` (`QUESTION`) | hecho |
| 07 | Reveal | `/partida/:gameId` (`REVEAL`) | hecho |
| 08 | Scoreboard | `/partida/:gameId` (`SCOREBOARD`) | hecho |
| 09 | Final / podio | `/partida/:gameId` (`FINAL`) | hecho |
| 10 | Stats | `/partida/:gameId/resultados` (vista TARJETAS) | hecho |
| 11 | Salir / volver | botones de Final y Resultados | parcial: sin revancha |
| 12 | Espectador | variante de 06–08 (`me.status = SPECTATOR`) | hecho |
| 13 | Error / reconexión | banner RECONECTANDO + `UNAUTHORIZED` → Home | hecho |
| 14 | Sala llena / código inválido / ya iniciada | `ErrorPanel` | hecho |
| 15 | Resultados detallados | `/partida/:gameId/resultados` (vista TABLA) | hecho |

Extras: sonido (WebAudio, con mute persistente) y efecto CRT opcional. La pantalla "Apuesta" del `CLAUDE.md` raíz no existe en contrato ni en esta spec y no se construye.

## Navegación general
```
01 Home → 02 Crear sala ─┐
        → 03 Unirse ─────┴→ 04 Lobby → [host inicia] →
05 Round intro → 06 Pregunta → 07 Reveal → 08 Scoreboard → (siguiente ronda: 05) …
                                                    └→ 09 Final (podio) → 10 Stats → 11 Salir/volver a Home
12 Espectador (variante de 06–08)   13 Error/reconexión   14 Sala llena / código inválido
15 Resultados finales detallados
```
(Numeración orientativa: Adler puede reordenar archivos; lo importante es el comportamiento de cada estado.)

---

## 01 · Home
- Logo animado "TRIVIA CHAOS" (pixel, letras que caen con glitch), botones **CREAR SALA** y **UNIRSE**.
- Input de nickname (2–20). Al continuar: `POST /players` → guardar token.
- Animación: fondo synthwave, logo con parpadeo tipo neón, "PRESS START" intermitente.
- Errores: `error.code` de validación → mensaje inline con sacudida del input.

## 02 · Crear sala
- Ajustes: máx. jugadores, rondas, vidas, categorías (rangos pendientes con Jared). Valores por defecto del contrato (ej. 8 / 10 / 3).
- Acción: `POST /rooms` (por D2 el creador queda como host y primer participante; la respuesta trae `code` y su `participantId`) → navegar al Lobby con el código.
- Animación: sliders pixelados con contador numérico que "rueda".

## 03 · Unirse
- Input de código de 6 caracteres (mayúsculas, auto-avance entre casillas).
- `join` → 201 (nuevo) o 200 (reconexión; mismo `participantId`). Ambos van al Lobby.
- Errores por `error.code`: sala inexistente, llena, ya iniciada, etc. (ver `endpoints.md`).

## 04 · Lobby
- Muestra código grande (copiar / QR), lista de participantes (chips que entran con "pop"), indicador de host, ajustes.
- Polling `GET /rooms/{code}` hasta que `currentGameId != null` → ir a 05.
- Host: botón **INICIAR** (habilitado según mínimo de jugadores del contrato).
- Animación: nuevos jugadores aparecen con sacudida y sonido; cuenta regresiva de arranque.

## 05 · Round intro (`ROUND_INTRO`, 3 s)
- "RONDA 3 / 10". Si `round.type == DOUBLE`: banner **x2** con destello y shake.
- Muestra vidas y puntaje propio. Si el jugador tiene poderes, se ven los slots.
- Animación: número de ronda cae con rebote; cortinilla de entrada.

## 06 · Pregunta (`QUESTION`, 20 s)
- Pregunta + 4 opciones (color + símbolo), timer, vidas, puntaje, poderes disponibles, quién ya respondió.
- Responder: envía la respuesta; la UI queda en "enviado" (opción presionada, otras atenuadas). `hasAnswered` del servidor confirma.
- Poderes: activar antes de responder (DOUBLE / SHIELD / HINT). HINT: el estado personalizado ya viene con 2 opciones menos; animar el "tachado" de las eliminadas.
- Timer visual desde `round.endsAt` con offset de reloj. Últimos 5 s: pulso rojo.
- Si ya respondió: pantalla de espera con "esperando a los demás (3/4)".

## 07 · Reveal (`REVEAL`, 4 s)
- Primero neutralizar la opción elegida; luego iluminar la correcta (verde). Si falló: shake rojo + corazón roto (salvo SHIELD → escudo absorbe, animación de escudo).
- `me.lastResult`: desglose de puntos con **ScoreTally** (base + velocidad, × ronda, × poder).
- Si no respondió: mensaje "TIEMPO AGOTADO" (lastResult en este caso: pendiente con Jared).

## 08 · Scoreboard (`SCOREBOARD`, 6 s)
- Ranking con `positionDelta` (▲▼), puntos de la ronda (`pointsThisRound`), vidas.
- Animación: filas se reordenan con `layout`; el que sube destella, el que baja se oscurece.
- Mostrar cuántas rondas faltan.

## 09 · Final / Podio (`FINAL`)
- `round: null`. Usa `winner` y `ranking`.
- Animación: podio por bloques, confeti, nombre del ganador gigante, fanfarria.
- Botón para ver stats.

## 10 · Stats (resultados finales)
- Datos de `GET /games/{id}/results` o del estado final: `correctAnswers/totalAnswers`, `averageAnswerTimeMs`, `fastestAnswerMs`, `bestRound`.
- Presentarlo como "tarjetas de jugador" estilo cartas coleccionables arcade; barras de precisión que se llenan.

## 11 · Salir / volver
- Botón **JUGAR OTRA VEZ** (revancha: pendiente con Jared; por ahora volver a Home) y **SALIR**.

## 12 · Variante Espectador (SPECTATOR)
- Misma pantalla que 06–08 pero sin controles de respuesta, overlay "ESPECTADOR", filtro gris parcial.
- Ve la pregunta, quién responde, la respuesta correcta y el ranking.
- Ejemplo: `docs/contrato/ejemplos/state-question-spectator.json`.

## 13 · Error / reconexión
- Banner "RECONECTANDO…" cuando el polling falla (no bloquear si es intermitente).
- Reintentos con backoff suave; el token se conserva en `localStorage`.
- Si la sesión no es válida (`error.code` correspondiente): volver a Home con mensaje.

## 14 · Sala llena / código inválido / partida ya iniciada
- Pantalla de error con personaje pixel y botón de volver. Mensaje por `error.code`.

## 15 · Resultados detallados
- Tabla completa de ranking + stats por jugador + ronda destacada. Reutiliza datos de 10; pensada para proyector.

---

## Matriz pantalla ↔ endpoint (rutas reales del contrato)
| Pantalla | Endpoint |
|---|---|
| 01 | `POST /players` |
| 02 | `POST /rooms`, `PATCH /rooms/{code}` (host, ajustes) |
| 03 | `POST /rooms/{code}/players` (201 nuevo / 200 reconexión) |
| 04 | `GET /rooms/{code}` (polling), `POST /rooms/{code}/games` (host inicia), `DELETE /rooms/{code}/players/{participantId}` (salir) |
| 05–08, 12 | `GET /games/{id}/state` + `POST /games/{id}/rounds/{n}/answers` + `POST /games/{id}/rounds/{n}/powers` |
| 08 (detalle) | `GET /games/{id}/ranking` (usa `positionDelta`) |
| 07 (detalle) | `GET /games/{id}/rounds/{n}/results` |
| 09, 10, 15 | `GET /games/{id}/state` (FINAL), `GET /games/{id}/results` |
| Host | `POST /games/{id}/advance` (adelantar fase) |
| Ajustes | `GET /categories` |
> Cuerpos y errores exactos: `docs/contrato/endpoints.md`. Leyenda del contrato: 🔓 sin token, 🔑 Bearer, 👑 solo host.

## Orden de construcción recomendado
1. Tokens + layout base + fondo animado + PixelButton
2. 01–03 (flujo de entrada) con mock
3. 04 Lobby
4. Ciclo 05→08 con simulador y DevPanel
5. 09–10 Final y stats
6. 12–14 variantes y errores
7. Sonido, CRT, pulido de transiciones, pruebas en móvil
8. Integración real con la API de Jared
