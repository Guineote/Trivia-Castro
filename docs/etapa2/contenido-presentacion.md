# Contenido de la presentación (Etapa 2)

Integrantes: Adler Antonio Calvillo Arellano y Jared López García · Universidad Panamericana Aguascalientes.

## Notas de consistencia
- Diapositiva 15 menciona rondas "normal, rápida, doble y bomba" en v1; el contrato solo tiene NORMAL y DOUBLE. Ajustar antes de exponer.
- El pie de la portada es un placeholder: completar materia/profesor/fecha.
- Pendientes con Jared: ver docs/frontend/PENDIENTES.md.

---

# Trivia Chaos — Guion de la exposición (segunda etapa)

Contenido de las 15 diapositivas, separado del diseño. Sirve para reconstruir la
presentación en Gamma, Canva, Pitch, Beautiful.ai, Figma Slides, otra IA o a mano.

---

## Cómo usar este archivo con otra herramienta

Pega esto antes del contenido:

> Arma una presentación de 15 diapositivas con el contenido que te doy abajo.
> Respeta el texto: no inventes datos, no agregues diapositivas y no cambies las cifras.
> Es un proyecto escolar de ingeniería de software: la audiencia es un profesor y un grupo
> de compañeros, la exposición dura entre 10 y 12 minutos.
> El diseño lo defines tú siguiendo esta dirección: **[escribe aquí la estética que quieras]**.
> Cada diapositiva trae su texto y sus notas del orador; las notas van en el panel de notas,
> no en la diapositiva.

Después pega el contenido de la sección siguiente.

---

## 1 · Portada

- Título: **TRIVIA CHAOS**
- Subtítulo: Documentación de la API y de su uso. Pantallas del juego en función del diagrama de flujo.
- Etiqueta: SEGUNDA ETAPA · EXPOSICIÓN
- Pie: *[nombres del equipo] · [materia] · Universidad Panamericana · [fecha]*

**Notas:** Trivia Chaos es un juego web multijugador de trivia por salas. En la primera etapa
presentamos la definición de la API y los diagramas de flujo. Hoy traemos la segunda: la
documentación completa de la API y el diseño de las pantallas conectado a esa documentación.

---

## 2 · Dónde estamos

Tres bloques, con el del medio destacado:

| Bloque | Estado | Contenido |
|---|---|---|
| Etapa 1 | Cerrada | Definición de la API y diagramas de flujo de API y Website |
| **Etapa 2** | **En curso — aquí** | **Documentación de la API y de su uso. Pantallas del juego según el diagrama de flujo. Entregable: esta exposición** |
| Etapa 3 | Siguiente | Prototipo e implementación sobre lo documentado hoy |

Cierre: *El objetivo de esta etapa es que nadie tenga que rediseñar nada para implementar: la documentación debe bastar para escribir el código.*

**Notas:** Etapa 1 cerrada. Estamos en la 2, cuyo entregable es esta exposición. Lo importante: todo lo que decidimos hoy tiene que sostener la etapa 3 sin rediseñar.

---

## 3 · La tesis del proyecto

Frase grande, a dos tiempos:

> **La API no entrega preguntas.**
> **Ejecuta el juego.**

Tres apoyos:

- **EL TIEMPO** — El servidor abre y cierra la ronda. El cliente solo dibuja un contador.
- **LOS PUNTOS** — El cálculo vive en el servidor. El cliente nunca envía un puntaje.
- **LA VERDAD** — Un único recurso de estado. La pantalla lee; nunca decide.

**Notas:** Esta es la idea que ordena todo el diseño. Si la API solo sirviera preguntas, el cliente podría mentir sobre el tiempo y sobre los puntos. Por eso la lógica del juego vive completa en el servidor.

---

## 4 · Arquitectura general

Diagrama de cuatro piezas:

```
API externa de trivia  (caja punteada, "solo importación")
        │  fuera de partida
        ▼
TRIVIA CHAOS API
   Capa HTTP     → rutas, validación, códigos
   Capa dominio  → reglas del juego
   Capa datos    → repositorios
        │
        ├──────────► Base de datos
        └──────────◄ Website  (HTTP, ida y vuelta)
```

Nota lateral — **Por qué así:** Durante una partida la aplicación no toca la API externa. Si
ese servicio se cae a mitad de la exposición, el juego sigue funcionando. Un solo servicio,
un solo repositorio. Sin microservicios.

Pie: *La partida en vivo solo toca nuestra propia base de datos. La API externa es una fuente de contenido, no una dependencia en tiempo de ejecución.*

**Notas:** Cuatro piezas. La clave está en la caja punteada: la API externa solo se usa para importar preguntas a nuestra base, nunca durante una partida. Eso elimina una dependencia en tiempo real y hace la demo a prueba de caídas.

---

## 5 · Decisión 01 — Cómo se sincronizan los jugadores

Bajada: *No estaba definido en la etapa 1, y sin resolverlo no se puede documentar ni un solo endpoint.*

Comparación a dos columnas:

- **ELEGIDO PARA v1 — Polling de estado.** `GET /games/{id}/state` + ETag. Todo sigue siendo HTTP y REST, así que se documenta y se demuestra igual que el resto. Si nada cambió, el servidor responde 304 sin cuerpo.
- **ALTERNATIVA DESCARTADA — WebSockets.** Conexión persistente bidireccional. Mejor latencia, pero el sistema deja de ser una API REST demostrable y complica despliegue y reconexión.

Cierre: *Y no nos encierra: el estado ya está modelado como un recurso único, así que migrar a SSE o WebSockets reemplaza el transporte de un endpoint y no toca ningún otro.*

**Notas:** Kahoot usa WebSockets. Nosotros elegimos polling con ETag por tres razones: se documenta como REST, no necesita infraestructura extra, y la reconexión sale gratis. Y no es una vía muerta: como el estado es un solo recurso, cambiar el transporte después no toca el resto de la API.

---

## 6 · Decisiones 02 y 03 — Lo que el cliente no puede decidir

Dos bloques:

- **02 · IDENTIDAD — Token de sesión.** Sin el token, cualquiera que conozca el id de otro jugador podría responder por él o gastar sus poderes. Código: `Authorization: Bearer 9f2c1a7e…`. `POST /players` devuelve el token. No hay cuentas, contraseñas ni correo.
- **03 · EL RELOJ — Autoridad del servidor.** El bonus por velocidad es trivial de manipular si el tiempo lo mide el navegador. Fórmula: `endsAt − serverTime = contador`. El servidor guarda `startedAt` y `endsAt`, y devuelve `serverTime` en cada respuesta. El cliente solo dibuja.

Cierre: **Regla general del diseño: si un dato puede cambiar el resultado de la partida, lo produce el servidor.**

**Notas:** Dos decisiones que resuelven huecos de seguridad del diseño original. Sin token, suplantación trivial. Sin reloj del servidor, el bonus de velocidad es falsificable.

---

## 7 · Entidades

Diez entidades, en dos columnas:

| Entidad | Qué guarda |
|---|---|
| Player | identidad efímera · nickname, token |
| Room | code de 6 caracteres · host · settings |
| Participant | el jugador DENTRO de la sala · score, lives, status |
| Game | status, phase, currentRound, version |
| Round | number, type, questionId, startedAt, endsAt |
| Question / Option | text, category, difficulty · isCorrect |
| SubmittedAnswer | único por (round, participant) |
| ParticipantPower | inventario · usedAt |
| PowerUse | quién, cuándo, sobre quién |
| Category | las 10 categorías del juego |

Aparte, dos detalles destacados:

- **Participant** — Separar al jugador de su participación permite que una sala juegue varias partidas seguidas.
- **Game.version** — Sube con cada cambio. Es literalmente el ETag: `"g8a3-v42"`. Hace barato el polling.

Pie: *El índice único (roundId, participantId) es lo que impide responder dos veces. En la base, no en la aplicación.*

**Notas:** Diez entidades. Dos merecen comentario: Participant separa quién eres de cómo te va en esta sala; y version es el contador que convierte el polling en algo barato, porque es el ETag. Y la regla de una respuesta por ronda la impone la base de datos con un índice único, no un if en el código.

---

## 8 · El ciclo de una ronda

Línea de tiempo de cuatro fases y un final, con bucle de regreso:

| Fase | Duración | Qué pasa |
|---|---|---|
| ROUND_INTRO | 3 s | anuncia el tipo de ronda |
| QUESTION | 20 s | se responde y se usan poderes |
| REVEAL | 4 s | correcta, puntos y vidas |
| SCOREBOARD | 6 s | ranking acumulado |
| FINAL | — | resultados de la partida |

De SCOREBOARD vuelve a ROUND_INTRO *mientras queden rondas*.

- **QUIÉN AVANZA** — Un scheduler del servidor, por temporizador. El host puede adelantar, pero el juego nunca depende de que un cliente lo pida.
- **QUÉ VE EL CLIENTE** — Solo lee el campo `phase` y decide qué pantalla dibujar. Toda la lógica de transición está del lado del servidor.

**Notas:** Cuatro fases con duraciones fijas. El scheduler del servidor las avanza; el host puede adelantar el marcador si quiere. El cliente no decide nada: lee el campo phase y dibuja.

---

## 9 · La superficie completa

21 endpoints en tres grupos. Cada uno con su chip de método (GET / POST / PATCH / DELETE):

**Sesión y salas**
`POST /players` · `POST /rooms` · `GET /rooms/{code}` · `PATCH /rooms/{code}` ·
`POST /rooms/{code}/players` · `DELETE /rooms/{code}/players/{id}` · `POST /rooms/{code}/games`

**Partida**
`GET /games/{id}/state` · `POST /games/{id}/rounds/{n}/answers` ·
`POST /games/{id}/rounds/{n}/powers` · `GET /games/{id}/rounds/{n}/results` ·
`GET /games/{id}/ranking` · `GET /games/{id}/results` · `POST /games/{id}/advance`

**Contenido**
`GET /categories` · `GET /questions` · `POST /questions` · `POST /questions/import`

Nota: La importación normaliza y deduplica por `externalId`. Nunca corre durante una partida.

Pie: *Todas las rutas bajo `/api/v1` · Bearer obligatorio salvo en `POST /players` y `GET /rooms/{code}`*

**Notas:** Veintiún endpoints en tres grupos. Dos cosas a defender: unirse a una sala es POST a la colección de jugadores de esa sala, no un verbo /join; y crear la partida es un solo POST, no crear y luego iniciar, porque eso dejaba una partida en un estado intermedio inútil.

---

## 10 · El endpoint central: `GET /games/{id}/state`

Bloque de código a un lado:

```json
{
  "version": 43,
  "phase": "QUESTION",
  "serverTime": "2026-09-04T18:30:06Z",
  "round": {
    "number": 3,  "type": "DOUBLE",
    "endsAt": "2026-09-04T18:30:26Z",
    "question": {
      "text": "¿Año del primer PlayStation?",
      "options": [ {"id":"o1","text":"1992"}, … ]
    }
  },
  "me": {
    "score": 2450,  "lives": 2,
    "hasAnswered": false,
    "powers": [ {"powerType":"HINT","available":true} ]
  },
  "players": [ … ]
}
```

Cuatro anotaciones al lado:

- **SIN LA RESPUESTA CORRECTA** — En fase QUESTION las opciones no traen `isCorrect`. La correcta aparece solo en REVEAL.
- **PERSONALIZADO POR TOKEN** — El bloque `me` trae mis vidas y mis poderes; `players` trae de los demás solo lo público.
- **`hasAnswered` SIN FILTRAR** — Permite mostrar «3 de 5 ya respondieron» sin revelar qué respondieron.
- **304 NOT MODIFIED** — Con `If-None-Match`, si `version` no cambió el servidor no manda cuerpo y el cliente no redibuja.

**Notas:** Este es el endpoint que sostiene el juego. Cuatro detalles: nunca viaja la respuesta correcta durante la pregunta; la respuesta está personalizada según el token; hasAnswered permite el indicador de progreso sin filtrar información; y con ETag, si no cambió nada, el servidor contesta 304 sin cuerpo.

---

## 11 · Cómo se calculan los puntos

Fórmula destacada:

```
puntos = ( base + bonus_velocidad ) × multiplicador_ronda × multiplicador_poder
```

Ejemplo trabajado en cuatro pasos, con el último destacado:

| Paso | Valor | Explicación |
|---|---|---|
| BASE | 800 | pregunta de dificultad media |
| + VELOCIDAD | 316 | respondió en 4.2 s de 20 |
| × RONDA DOBLE | ×2 | el tipo de ronda multiplica |
| **TOTAL** | **2 232** | calculado en el servidor |

Tres reglas al pie:

- **FALLAR** — 0 puntos y −1 vida. El puntaje nunca baja.
- **SIN VIDAS** — Pasa a espectador, no se le expulsa.
- **PODERES** — 1 doble, 1 escudo, 1 pista. Antes de responder.

**Notas:** Ejemplo real: pregunta media, ronda doble, responde a los 4.2 segundos de 20. Base 800, bonus 316, por dos: 2232 puntos. Todo ese cálculo ocurre en el servidor. Y quedarse sin vidas no te expulsa: pasas a espectador, porque eliminar a alguien en la ronda 2 de 10 vacía la sala.

---

## 12 · Quince pantallas

Cuadrícula numerada. Las marcadas con ★ ocurren durante la partida y deben destacarse:

01 Principal · 02 Crear partida · 03 Unirse · 04 Sala de espera · **★05 Intro de ronda**
**★06 Pregunta** · **★07 Poderes** · **★08 Esperando** · **★09 Resultado** · **★10 Ranking**
**★11 Espectador** · 12 Final · 13 Estadísticas · 14 Apuesta · **★15 Reconexión**

Afirmación destacada: **Las ocho pantallas que ocurren durante la partida se dibujan desde un solo recurso: `GET /games/{id}/state`.**

Pie: *Tres de estas pantallas no estaban en la lista original: intro de ronda (sin ella las rondas especiales son invisibles), esperando resultados (si no, la interfaz parece congelada) y reconexión (el polling falla tarde o temprano).*

**Notas:** Quince pantallas. Añadimos tres que faltaban en la lista original y fusionamos dos que no eran pantallas: seleccionar respuesta es una interacción dentro de la pregunta, y usar un poder es un panel superpuesto, porque el temporizador no puede pararse.

---

## 13 · Cuatro pantallas clave

Cuatro mockups en fila, cada uno con su pie:

| Pantalla | Qué se ve en el mockup | Endpoints |
|---|---|---|
| 04 Sala de espera | código grande, cuadrícula de jugadores, botón INICIAR | `GET /rooms/{code}` · `POST /rooms/{code}/games` |
| 06 Pregunta | barra de tiempo, texto, 2×2 de respuestas de colores, vidas | `GET /games/{id}/state` · `POST …/rounds/{n}/answers` |
| 09 Resultado de ronda | «+2 232», la correcta en verde, barra de progreso | `GET /games/{id}/state` con `phase = REVEAL` |
| 10 Ranking | barras ordenadas, la primera destacada | `GET /games/{id}/ranking`, usa `positionDelta` |

Pie: *Cada pantalla está documentada con objetivo, elementos, botones, interacción, endpoint que consume y qué ocurre después.*

**Notas:** Cuatro de las quince, para dar la idea. Fíjense en la pantalla de pregunta: la barra de tiempo se calcula con endsAt menos serverTime, nunca con un contador local. Y en la de resultado, el color verde solo aparece en REVEAL, nunca antes.

---

## 14 · De la pantalla al endpoint

Diagrama de carriles (Website / API / Base de datos) con el flujo de unirse a una sala:

```
Pantalla 03 Unirse
  Website → API   POST /rooms/K7X4QM/players   Authorization: Bearer …
  API → BD        INSERT participant (valida cupo y nickname)
  BD → API
  API → Website   201 Created { participantId, participants[] }
Pantalla 04 Sala de espera
  y a partir de aquí: GET /games/{id}/state cada segundo → 200 · 304
```

- **ERRORES CON PANTALLA** — 404 «no existe esa sala» · 409 «la sala está llena» · 422 «ese nombre ya está en uso»
- **POR QUÉ IMPORTA** — Cada código HTTP tiene su mensaje ya escrito. La documentación y la interfaz se diseñaron juntas.

**Notas:** Este es el nivel de detalle que pedía la etapa: pantalla, petición, validación, base de datos, respuesta y pantalla siguiente. Y cada código de error tiene su mensaje en pantalla ya escrito, porque documentación e interfaz se diseñaron a la vez.

---

## 15 · Qué construimos y qué no

Tres columnas de alcance:

- **v1 — EL NÚCLEO JUGABLE.** Sesiones, salas, partida, puntuación, vidas, ranking y resultados. Rondas normal, rápida, doble y bomba. Poderes doble, escudo y pista.
- **v1.1 — SI DA TIEMPO.** Tiempo extra y bomba, que requieren deadline por jugador. Ronda final con apuestas. Reconexión completa.
- **v2 — FUERA DE ALCANCE.** Ronda mayoría: usa una vía de puntuación distinta. WebSockets. Cuentas e historial de partidas.

Cierre: **La documentación ya alcanza para escribir el código.** — *Siguiente etapa: prototipo.*

**Notas:** Cerramos con el alcance. Marcamos explícitamente lo que no vamos a construir y por qué, para no prometer de más. Con esto la etapa 3 empieza escribiendo código, no rediseñando. Gracias.
