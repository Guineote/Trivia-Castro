# Trivia Chaos — Contexto del proyecto

> Archivo de contexto inicial. Resume lo definido en la Etapa 1 (definición de la API y diagramas de flujo) y la Etapa 2 (documentación de la API y pantallas). **Estado (oct 2026): el frontend `web/` está completo contra un mock; `api/` está por construir** (ver sección 12). Equipo de 2 personas que trabajan en paralelo y luego integran.

**Equipo:** "Cristian Castro" es el nombre del equipo (aparece en los encabezados de los documentos). Los integrantes son 2: Adler Antonio Calvillo Arellano y Jared López García.

## 1. Qué es

Videojuego web multijugador de trivia, inspirado en Kahoot y JKLM. El nombre del juego será probablemente **"Trivia Chaos"** (nombre de la Etapa 1). "Trivia Castro" fue un nombre anterior del juego y es el que aparece en la documentación de la Etapa 2; al documentar, usar Trivia Chaos. **Nombre aún no 100 % confirmado.**

Se construye una **API propia desde cero** (HTTP + JSON) y un **Website** que la consume. La API administra toda la lógica y el estado del juego:

- Crear y administrar salas mediante códigos (ej. `K7X4QM`).
- Registrar jugadores.
- Crear y administrar partidas.
- Obtener y administrar preguntas de distintas categorías (10 categorías).
- Validar respuestas y calcular puntuación según respuesta y tiempo.
- Administrar vidas y poderes especiales.
- Mantener el ranking.
- Controlar el estado de cada ronda y de la partida.

Opcionalmente puede importar preguntas de una API externa de trivia; se normalizan y se guardan en nuestra base de datos.

## 2. Principios no negociables

1. **La API no entrega preguntas; ejecuta el juego.**
2. **El tiempo** lo controla el servidor: abre y cierra la ronda. El cliente solo dibuja un contador.
3. **Los puntos** se calculan en el servidor. El cliente nunca envía un puntaje.
4. **La verdad** vive en un único recurso de estado. La pantalla lee; nunca decide.
5. **Regla general:** si un dato puede cambiar el resultado de la partida, lo produce el servidor.

## 3. Arquitectura

```
Jugador -> WEBSITE -> TRIVIA CASTRO API -> BASE DE DATOS
                          (HTTP: rutas, validación, códigos)
                          (DOMINIO: reglas del juego)
                          (DATOS: repositorios)
                      API EXTERNA (solo importación, línea punteada)
```

- Un solo servicio, un solo repositorio. **Sin microservicios.**
- Capas internas: HTTP -> Dominio -> Datos (repositorios).
- **Durante una partida la aplicación no toca la API externa.** Si esa API cae a mitad de la exposición, el juego sigue funcionando. La partida en vivo solo usa nuestra base de datos.
- La importación de preguntas nunca corre durante una partida.

## 3.1 Stack tecnológico

- **API:** Python con **FastAPI** (OpenAPI/Swagger automático, validación con Pydantic), SQLAlchemy + Alembic (ORM y migraciones).
- **Base de datos:** **MySQL** (índice único `(roundId, participantId)`).
- **Website:** **React** (sugerido: Vite + TanStack Query con `refetchInterval` para el polling).
- **Scheduler:** tarea asíncrona dentro de la API o APScheduler. Correr **un solo proceso** del servidor para evitar dos relojes sobre la misma partida.
- **Pruebas:** pytest (puntuación y transiciones de fase).
- **Entorno:** `docker-compose` con MySQL para que ambos integrantes compartan el mismo entorno.

## 4. Decisiones tomadas

### Decisión 01 — Sincronización: **POLLING** (ganó) vs WebSockets (descartado)
- `GET /games/{id}/state` con **ETag** (cada ~1 s).
- Razones: fácil de documentar e implementar, reconexión simple, latencia aceptable.
- `Game.version` es el ETag (ej. `"g8a3-v42"`). Con `If-None-Match`, si la versión no cambió responde **304 Not Modified** sin cuerpo y el cliente no redibuja.

### Decisión 02 — Identidad: token de sesión
- `POST /players` devuelve un token. **No hay cuentas, contraseñas ni correo.**
- Se envía como `Authorization: Bearer <token>`.
- Sin token, cualquiera que conozca el id de otro jugador podría responder por él o gastar sus poderes.

### Decisión 03 — Reloj: autoridad del servidor
- El servidor guarda `startedAt` y `endsAt` y devuelve `serverTime` en cada respuesta.
- El cliente calcula `contador = endsAt - serverTime`.
- El bonus por velocidad sería trivial de manipular si el navegador midiera el tiempo.

## 5. Entidades

| Entidad | Campos / notas |
|---|---|
| Player | nickname, token |
| Room | code, host, settings |
| Participant | score, lives, status (separa "quién eres" de "cómo te va en esta sala") |
| Game | phase, version (version = ETag) |
| Round | number, type, endsAt |
| Question / Option | difficulty, isCorrect |
| SubmittedAnswer | único por ronda |
| ParticipantPower | inventario, usedAt |
| PowerUse | quién, cuándo, a quién |
| Category | las 10 categorías |

Relaciones principales:

```
Room 1--< Participant
Room 1--< Game 1--< Round >-- Question 1--< Option
Round 1--< SubmittedAnswer >--1 Participant
Participant 1--< ParticipantPower
```

**Índice único `(roundId, participantId)`** en `SubmittedAnswer`: impide responder dos veces. Se garantiza **en la base de datos**, no en la aplicación.

## 6. Ciclo de una ronda (máquina de estados)

```
ROUND_INTRO (3s) -> QUESTION (20s) -> REVEAL (4s) -> SCOREBOARD (6s) -> [loop mientras queden rondas] -> FINAL
```

- Avanza un **scheduler del servidor** por temporizador. El host puede adelantar (`POST /games/{id}/advance`), pero el juego nunca depende de que un cliente lo pida.
- El cliente solo lee el campo `phase` y decide qué pantalla dibujar. Toda la lógica de transición es del servidor.
- ROUND_INTRO anuncia el tipo de ronda; en QUESTION se responde y se usan poderes; REVEAL muestra correcta, puntos y vidas.

## 7. Superficie de la API

Todas las rutas bajo `/api/v1`. **Bearer obligatorio salvo `POST /players` y `GET /rooms/{code}`.**

**Sesión y salas**
- `POST /players`
- `POST /rooms`
- `GET /rooms/{code}`
- `PATCH /rooms/{code}`
- `POST /rooms/{code}/players`
- `DELETE /rooms/{code}/players/{id}`
- `POST /rooms/{code}/games`

**Partida**
- `GET /games/{id}/state`
- `POST /games/{id}/rounds/{n}/answers`
- `POST /games/{id}/rounds/{n}/powers`
- `GET /games/{id}/rounds/{n}/results`
- `GET /games/{id}/ranking`
- `GET /games/{id}/results`
- `POST /games/{id}/advance`

**Contenido**
- `GET /categories`
- `GET /questions`
- `POST /questions`
- `POST /questions/import` (normaliza y deduplica por `externalId`; nunca durante una partida)

### Recurso central: `GET /games/{id}/state`

```json
{
  "version": 43,
  "phase": "QUESTION",
  "serverTime": "2026-09-04T18:30:06Z",
  "round": {
    "number": 3, "type": "DOUBLE",
    "endsAt": "2026-09-04T18:30:26Z",
    "question": { "text": "¿Año del primer PlayStation?",
                  "options": [ {"id":"o1","text":"1992"}, ... ] }
  },
  "me": { "score": 2450, "lives": 2, "hasAnswered": false,
          "powers": [ {"powerType":"HINT"} ] },
  "players": [ ... ]
}
```

- **Sin la respuesta correcta:** en fase QUESTION las opciones no traen `isCorrect`; la correcta aparece solo en REVEAL.
- **Personalizado por token:** `me` trae mis vidas y poderes; `players` trae de los demás solo lo público.
- **`hasAnswered` sin filtrar:** permite mostrar "3 de 5 ya respondieron" sin revelar qué respondieron.
- **304 Not Modified** con `If-None-Match` cuando `version` no cambió.

## 8. Reglas de puntuación

```
puntos = (base + bonus_velocidad) x mult_ronda x mult_poder
```

- **Base:** depende de la dificultad (ej. 800).
- **Velocidad:** según el tiempo de respuesta sobre 20 s (ej. 4.2 s -> +316).
- **Multiplicador de ronda:** el tipo de ronda multiplica. Tipos de ronda: **NORMAL** (x1, la mayoría) y **DOUBLE** (x2, aparece de vez en cuando).
- **Poder:** multiplicador adicional si se usó el doble.
- Ejemplo del documento: (800 + 316) x 2 = **2232**, calculado en el servidor.
- **Fallar:** 0 puntos y -1 vida. **El puntaje nunca baja.**
- **Sin vidas:** pasa a **espectador**, no se le expulsa.
- **Poderes:** 1 doble, 1 escudo, 1 pista. Se usan **antes de responder**.

## 9. Pantallas del Website (15)

01 Principal · 02 Crear partida · 03 Unirse · 04 Sala de espera · 05 Intro de ronda · 06 Pregunta · 07 Poderes · 08 Esperando · 09 Resultado · 10 Ranking · 11 Espectador · 12 Final · 13 Estadísticas · 14 Apuesta · 14(15) Reconexión

> Nota: el documento numera dos pantallas como "14" (Apuesta y Reconexión) pero dice "quince pantallas". Corregir la numeración al documentar.

- Las **8 pantallas de partida en curso** se dibujan desde un solo recurso: `GET /games/{id}/state`.
- Tres pantallas se añadieron respecto a la lista original: **Intro de ronda** (sin ella las rondas especiales son invisibles), **Esperando resultados** (si no, la interfaz parece congelada) y **Reconexión** (el polling falla tarde o temprano).
- Pantallas clave ya diseñadas:
  - 04 Sala de espera: `GET /rooms/{code}`, `POST /rooms/{code}/games`
  - 06 Pregunta: `GET /games/{id}/state`, `POST .../answers`
  - 09 Resultado: `GET /games/{id}/state` con `phase = REVEAL`
  - 10 Ranking: `GET /games/{id}/ranking`, usa `positionDelta`
- Cada pantalla se documenta con: objetivo, elementos, botones, interacción, endpoint y qué ocurre después.

## 10. Flujo ejemplo: de la pantalla al endpoint (Unirse a sala)

1. Pantalla 03 Unirse -> `POST /rooms/K7X4QM/players` con `Authorization: Bearer ...`.
2. API inserta `Participant`, valida cupo y nickname -> `201 Created { participantId, participants[] }`.
3. Pantalla 04 Sala de espera; desde aquí `GET /games/{id}/state` cada segundo (200 / 304).

**Errores con mensaje en pantalla** (cada código HTTP tiene su mensaje escrito; documentación e interfaz se diseñan juntas):
- `404` «no existe esa sala»
- `409` «la sala está llena»
- `422` «ese nombre ya está en uso»

## 11. Flujos (de la Etapa 1)

- **Website:** Principal -> (Crear partida | Unirse con código) -> Sala de espera -> Host inicia -> Pregunta -> Responde -> Resultado y puntos -> Ranking -> ¿quedan preguntas? Sí: otra pregunta / No: ganador y estadísticas.
- **API en una pregunta:** inicia ronda -> obtiene pregunta -> jugador responde -> ¿correcta? Sí: calcular puntos / No: restar vida -> actualizar puntuación y ranking -> enviar resultado -> ¿siguiente ronda? o finalizar.
- **Crear/unirse:** crear sala -> API genera código; otro jugador introduce código -> API verifica sala -> ¿disponible? Sí: agrega jugador / No: error.

## 12. Estado actual y puntos abiertos

- **Etapa 1:** completada (definición de API y diagramas).
- **Etapa 2:** en curso (documentación de la API y pantallas según el diagrama de flujo).
- **Frontend (`web/`, Adler): completo contra un mock.** Home, Crear sala, Unirse, Lobby, ciclo de partida (intro, pregunta, reveal, marcador, final, espectador), estadísticas, pantallas de error, sonido y efecto CRT. Detalle en `web/README.md` y `docs/frontend/pantallas-spec.md`.
- **API (`api/`, Jared): por construir.** Empieza por `docs/frontend/GUIA-PARA-LA-API.md` y `api/CLAUDE.md`.
- Equipo de 2 personas. Falta la **integración real** (el frontend nunca ha hablado con la API de verdad).
- Pendientes por definir (no están en la documentación):
  - Nombre definitivo del producto. En el frontend se usa **Trivia Castro** (decisión de Adler); este archivo, `docs/` y `.env.example` aún dicen "Trivia Chaos": unificar con Jared.
  - Fórmula exacta del bonus de velocidad (**se deja pendiente a propósito; se definirá después**; el 316 del ejemplo es solo ilustrativo). El mock del frontend usa `400·(20 s − t)/20 s` solo para desarrollar.
  - Puntaje base de cada dificultad (niveles ya definidos: `EASY`, `MEDIUM`, `HARD`). El mock usa 500/800/1100 solo para desarrollar.
  - Pantalla "Apuesta": no está en el contrato ni en la spec del frontend; **no se construye**.
  - Fuente de la API externa de preguntas.
  - Huecos del contrato detectados por el frontend (formato de `X-Server-Time`, timeout, escudo absorbido, revancha, desempate, rangos de ajustes): ver `docs/frontend/PENDIENTES.md`.- Ya resuelto en el contrato compartido (`docs/contrato/README.md`, decisiones D1 a D12): efecto de los poderes (HINT quita 2 opciones incorrectas, SHIELD evita perder la vida al fallar, DOUBLE multiplica x2 los puntos; combinado con ronda DOUBLE da x4) y límites por defecto de sala (8 jugadores, 10 rondas, 3 vidas).

## 13. Siguiente paso

El plan de trabajo en paralelo está en **`PLAN.md`**: dos frentes (A: API y datos, B: Website) más un bloque compartido de contrato (esquema de `GET /games/{id}/state`, endpoints, enums y errores).

- **Fecha de entrega:** la semana siguiente al 9 de octubre de 2026 (día exacto por confirmar).
- **Restricción:** el stack debe ser gratuito (lo es; el hosting en línea es opcional, se puede exponer en local).
- **Responsables:** Jared lleva el frente A (API y datos) y Adler el frente B (Website). Ver `PLAN.md`, sección 7.
- **Contrato compartido:** `docs/contrato/` (README, endpoints y `ejemplos/` con los JSON). Decisiones D1 a D12 confirmadas. Es la fuente de verdad para ambos frentes.
- **Siguiente paso real:** Jared construye `api/` (primero los stubs de A2) y se hace la **Integración 1 y 2** del `PLAN.md`. Guía: `docs/frontend/GUIA-PARA-LA-API.md`.

## 14. Estructura del repositorio

```
Trivia/
├── CLAUDE.md          # este archivo (contexto)
├── PLAN.md            # plan de trabajo en paralelo
├── docker-compose.yml # MySQL para ambos
├── .gitignore
├── README.md          # descripción del repo y por dónde empezar
├── api/               # frente A (Jared): FastAPI
│   └── CLAUDE.md      # contexto de Claude Code para la API
├── web/               # frente B (Adler): React + Vite
│   ├── README.md      # cómo correr/probar el frontend, mock vs API real
│   └── CLAUDE.md      # contexto de Claude Code para el frontend
└── docs/
    ├── contrato/      # contrato compartido (fuente de verdad)
    │   ├── README.md
    │   ├── endpoints.md
    │   └── ejemplos/  # JSON usados como mocks y como esquema de pruebas
    ├── frontend/      # design brief, spec de pantallas, PENDIENTES y GUIA-PARA-LA-API
    └── etapa2/        # material histórico (no contractual)
```
