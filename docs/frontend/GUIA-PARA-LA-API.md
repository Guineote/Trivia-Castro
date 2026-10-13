# Guía para el frente A (API): qué espera el frontend y cómo continuar

Documento para **Jared**. Explica qué hay hecho en `web/`, qué espera exactamente de tu API y cómo conectarlos. No sustituye al contrato: si algo de aquí difiere de [`docs/contrato/`](../contrato/README.md), **gana el contrato** (y se avisa para corregir este documento).

## 1. Dónde estamos

| | Estado |
|---|---|
| Contrato (`docs/contrato/`) | v0.2 cerrado, decisiones D1–D12 confirmadas |
| Frontend (`web/`) | Completo contra un **mock**: Home, Crear sala, Unirse, Lobby, ciclo de partida (intro, pregunta, reveal, marcador, final, espectador), estadísticas, errores, sonido |
| API (`api/`) | **Implementada y probada** (12 oct): 17 de 18 endpoints, 120 preguntas, 25 pruebas pytest. Ver [`api/PLAN-API.md`](../../api/PLAN-API.md) |
| Integración real | Pendiente de registrar: el repo no tiene constancia de una partida completa del frontend contra la API real |

Lo importante: **no estás bloqueado por el frontend ni al revés**. El frontend ya funciona contra el mock; en cuanto tu API cumpla el contrato, se cambia una variable de entorno y se prueban juntos.

## 2. Cómo se conectan (5 minutos)

1. El frontend llama a rutas relativas `/api/v1/...`.
2. En desarrollo, Vite las reenvía a `http://localhost:8000` (`server.proxy` en [`web/vite.config.ts`](../../web/vite.config.ts)). **Si tu API corre en otro puerto, cambia ese valor** o avisa para confirmarlo. Con el proxy no hace falta CORS.
3. El modo mock se activa con `VITE_USE_MOCK=true` en `web/.env.local`. Para usar tu API: ponlo en `false` o bórralo, y reinicia `npm run dev`.

```powershell
cd web
npm install
Copy-Item .env.example .env.local   # luego edita: VITE_USE_MOCK=false
npm run dev                          # abre la URL que imprime Vite
```

## 3. Orden sugerido para empezar

Sigue el `PLAN.md` (A1–A12), con un cambio de prioridad que destraba la integración:

1. **A1** Proyecto FastAPI, MySQL, Alembic (`docker-compose.yml` ya tiene MySQL).
2. **A2 primero que nada: stubs.** Rutas que devuelven los JSON de [`docs/contrato/ejemplos/`](../contrato/ejemplos/) con los headers correctos (sección 6). Con eso el frontend puede probar el cliente HTTP, el polling y el 304 contra tu servidor desde el día 1, antes de que exista la lógica.
3. **A3–A6** jugadores/token, salas, contenido, partida y `GET /state` real.
4. **A7–A8** scheduler de fases y respuestas/puntos. Aquí es donde más ayuda el mock como referencia (sección 5).
5. **A9–A11** ranking, poderes, pruebas.

Puntos de integración con Adler (del `PLAN.md`): **Integración 1** cuando funcionen crear/unirse/lobby; **Integración 2** con la partida completa.

## 4. Qué hace el frontend, pantalla por pantalla

Frecuencias de polling: `GET /rooms/{code}` y `GET /games/{id}/state` cada **1 s**; si hay fallos seguidos, el intervalo sube suavemente hasta 5 s y se muestra "RECONECTANDO...".

| Pantalla (ruta) | Llamadas | Notas |
|---|---|---|
| Home (`/`) | `POST /players` | Solo si cambió el nickname; guarda `token` y `playerId`. Nickname se recorta y debe tener 2–20 caracteres (el cliente ya lo valida) |
| Crear sala (`/crear`) | `GET /categories`, `POST /rooms` | Siempre manda `settings` completos: `maxPlayers`, `rounds`, `lives`, `categoryIds` |
| Unirse (`/unirse`) | `POST /rooms/{code}/players` | Código en mayúsculas. Manda `nickname` solo si antes recibió `NICKNAME_TAKEN` (D3). 201 y 200 son ambos éxito |
| Lobby (`/sala/:code`) | `GET /rooms/{code}` (polling), `PATCH /rooms/{code}`, `POST /rooms/{code}/games`, `DELETE /rooms/{code}/players/{participantId}` | `PATCH` solo con los campos cambiados, con un debounce de 400 ms. Cuando `currentGameId` deja de ser `null`, todos pasan a la partida |
| Partida (`/partida/:id`) | `GET /games/{id}/state` (polling, ETag), `POST .../answers`, `POST .../powers` | Una sola ruta; la pantalla la decide `phase` |
| Resultados (`/partida/:id/resultados`) | `GET /games/{id}/results` | Solo tras `FINAL` (si no, `GAME_NOT_FINISHED`) |

**Endpoints que el cliente tiene implementados pero ninguna pantalla usa todavía:** `POST /games/{id}/advance`, `GET /games/{id}/ranking`, `GET /games/{id}/rounds/{n}/results`. Las pantallas se dibujan solo desde `state`. Tampoco usa `GET/POST /questions` ni `/questions/import` (administración de contenido, D9).

## 5. La referencia ejecutable de las reglas: el simulador

[`web/src/mock/simulator.ts`](../../web/src/mock/simulator.ts) es una implementación completa y probada (`web/src/test/simulator.test.ts`) del servidor en TypeScript: salas, fases, puntos, vidas, poderes, ranking y estadísticas. **No hace falta que lo copies**, pero te sirve para ver exactamente qué construye el frontend a partir del `state` en cada fase. Mapa de funciones:

| Quiero ver cómo… | Función en `simulator.ts` |
|---|---|
| se crea la partida (preguntas, rondas, inventario de poderes) | `startGame` |
| avanzan las fases y cuándo | `tick` (evalúa de forma perezosa por timestamps) y `transition` / `enter` |
| se cierran la ronda, los puntos, las vidas y el paso a espectador | `closeRound` |
| se arma el `state` personalizado por fase (qué va en `null`, qué opciones llevan `isCorrect`) | `getState` y `stateQuestion` |
| se calcula `positionDelta` | `rankingEntries` (usa `rankHistory`) |
| se valida una respuesta (orden de los errores) | `answer` |
| funciona HINT / SHIELD / DOUBLE | `usePower` y `closeRound` |
| se calculan las estadísticas finales | `results` |

Dos alternativas de diseño que el simulador demuestra y que quizá te simplifiquen la vida (decides tú):

- **Fases perezosas:** en vez de un scheduler con un proceso aparte, evaluar en cada petición "¿ya pasó `phaseEnd`?" y aplicar las transiciones pendientes en orden. Evita relojes duplicados y funciona aunque nadie consulte durante un rato. Si prefieres APScheduler, también cumple el contrato mientras haya **un solo proceso**.
- **`version` como contador:** sube con cada cambio visible (respuesta, poder, cambio de fase). Es la base del ETag y del 304.

### Cosas que el mock tuvo que inventar (no son reglas del juego)

Están marcadas como `SUPUESTO DE MOCK` en el código. Son decisiones tuyas:

| Tema | Qué asume el mock | Propuesta de Adler (decides tú) |
|---|---|---|
| Puntos base por dificultad | EASY 500 · MEDIUM 800 · HARD 1100 | Lo que definas |
| Bonus de velocidad | `400·(20 s − t)/20 s` (reproduce el 316 del ejemplo a 4.2 s) | Función aislada, como pide el `PLAN.md` |
| Timeout (no respondió) | `lastResult` con `chosenOptionId: null`, `answerTimeMs: null`, puntos 0 y **pierde 1 vida** | Igual; el cliente ya maneja esos `null` |
| Cómo saber si el SHIELD absorbió la vida | No hay campo; el cliente lo infiere de `activePower === 'SHIELD'` y `livesLost === 0` | Añadir a `lastResult` un campo `powerUsed: PowerType \| null` (o `shieldAbsorbed: boolean`) |
| Un solo poder por ronda | `activePower` es un único valor; un segundo poder responde `POWER_NOT_AVAILABLE` | Confirmar |
| `activePower` | `PowerType \| null` | Confirmar |
| Rangos de `settings` | jugadores 2–12, rondas 1–15, vidas 1–5 | Los que tengas; fuera de rango, `422 VALIDATION_ERROR` |
| Rondas DOUBLE | cada tercera ronda | Aleatorio u otra regla |
| `pointsThisRound` en `SCOREBOARD` | `null` (como dice el contrato) | El frontend no lo necesita ahí |
| Desempate en ranking | por orden de unión | Confirmar criterio |

Más detalle del estado de cada punto en [`PENDIENTES.md`](PENDIENTES.md).

## 6. Headers, ETag y reloj (lo que más suele fallar)

El contrato lo describe en el `README`, secciones 3 y 5. Aquí, cómo lo usa el cliente y ejemplos de implementación con FastAPI.

**Qué hace el cliente** ([`web/src/api/http.ts`](../../web/src/api/http.ts), [`web/src/api/hooks.ts`](../../web/src/api/hooks.ts)):

- Manda `Authorization: Bearer <token>` en **todas** las peticiones si hay sesión (incluidas las públicas).
- En `GET /state` reenvía el último `ETag` en `If-None-Match`. Un `304` conserva el estado anterior sin redibujar. Si tu `200` no trae `ETag`, el cliente funciona igual pero siempre descarga el estado completo.
- Lee `X-Server-Time` en **todas** las respuestas (también 304) y calcula `offset = serverTime − relojLocal`. Si falta el header usa `serverTime` del cuerpo. Acepta ISO 8601 o epoch.
- Un `401` con token borra la sesión y manda al jugador a Home.
- Decide los errores por `error.code`. Un `code` desconocido se muestra como "Algo salió mal".

**Lo que la API debe cuidar:**

- `X-Server-Time` en todas las respuestas, con milisegundos si se puede (`2026-09-04T18:30:06.250Z`). Con segundos enteros el contador visual puede errar hasta ~1 s.
- `ETag` = `"<gameId>-v<version>"` entre comillas y `Vary: Authorization` en `GET /state`.
- `204` sin cuerpo en `DELETE`, `304` sin cuerpo.
- Los nombres de campos van en **camelCase** y los ids son **cadenas**.

Ejemplos (FastAPI), para adaptar:

```python
# Header X-Server-Time en TODAS las respuestas (incluidas 304 y errores)
from datetime import datetime, timezone
from fastapi import FastAPI, Request

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

@app.middleware("http")
async def add_server_time(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Server-Time"] = utc_now_iso()
    return response
```

```python
# GET /games/{id}/state con ETag / 304
from fastapi import Response

etag = f'"{game.id}-v{game.version}"'
common = {"ETag": etag, "Vary": "Authorization"}
if request.headers.get("if-none-match") == etag:
    return Response(status_code=304, headers=common)   # sin cuerpo
response.headers.update(common)
return state_payload
```

```python
# Errores con el formato del contrato: { "error": { "code", "message" } }
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message

@app.exception_handler(ApiError)
async def api_error(_, exc: ApiError):
    return JSONResponse(status_code=exc.status, content={"error": {"code": exc.code, "message": exc.message}})

@app.exception_handler(RequestValidationError)
async def validation_error(_, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"error": {"code": "VALIDATION_ERROR", "message": "Revisa los datos"}})

@app.exception_handler(StarletteHTTPException)
async def http_error(_, exc: StarletteHTTPException):
    code = "UNAUTHORIZED" if exc.status_code == 401 else "NOT_FOUND"
    return JSONResponse(status_code=exc.status_code, content={"error": {"code": code, "message": str(exc.detail)}})
```

```python
# camelCase en Pydantic (el contrato usa camelCase)
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
# y en las rutas: response_model_by_alias=True (es el valor por defecto en FastAPI)
```

Si en algún momento sirves el frontend desde otro origen (no por el proxy de Vite), el CORS debe **permitir** `Authorization`, `If-None-Match` y `Content-Type`, y **exponer** `ETag` y `X-Server-Time`:

```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"],
    allow_headers=["Authorization", "If-None-Match", "Content-Type"],
    expose_headers=["ETag", "X-Server-Time"],
)
```

## 7. Detalles por endpoint que el contrato no deja del todo claros

- `POST /players`: el cliente recorta espacios y exige 2–20 antes de llamar, pero **valida también en el servidor** (`VALIDATION_ERROR`).
- `POST /rooms`: la respuesta debe traer `participantId` (el del creador) además de la sala; el frontend lo guarda y lo usa para saber si es host.
- `GET /rooms/{code}`: es público, **sin ETag**. El Lobby lo consulta cada segundo, así que debe ser barato. `currentGameId` pasa de `null` a un id cuando el host inicia, y `status` a `IN_GAME`; tras `FINAL`, `FINISHED`.
- `PATCH /rooms/{code}`: llegan solo los campos cambiados. El cliente evita bajar `maxPlayers` por debajo del número de participantes, pero el servidor debe rechazarlo igual (`422`).
- `POST /rooms/{code}/players`: si el jugador **ya es participante**, `200` con el mismo `participantId` (sirve para reconectarse aunque la partida ya haya empezado, antes de `GAME_ALREADY_STARTED`).
- `DELETE /rooms/{code}/players/{participantId}`: el id es el del **participante**, no el del jugador. Lo usa tanto "SALIR" como el host al expulsar. Si sale el host, el rol pasa al participante más antiguo (D11).
- `POST /rooms/{code}/games`: valida mínimo 2 jugadores (D4), y que haya suficientes preguntas para `rounds` en las categorías pedidas (`NOT_ENOUGH_QUESTIONS`).
- `GET /games/{id}/state`: personalizado por token. `403 NOT_IN_GAME` si el token no pertenece a la partida. Ver el `README` del contrato, sección 5, para qué va en `null` por fase. `round.endsAt` es el fin de la **fase actual**.
- `POST .../answers`: `202 {"accepted": true}`; **no** dice si acertó. El tiempo lo mide el servidor al recibir. El cliente no manda tiempos ni puntos.
- `POST .../powers`: tras la respuesta, el cliente vuelve a pedir `state`; con HINT el `state` ya trae solo 2 opciones. El cliente no usa `effect.removedOptionIds`, la verdad es el `state`.
- `GET /games/{id}/results`: la tabla y las tarjetas muestran lo que mandas sin recalcular. Ver las preguntas de D12 en [`PENDIENTES.md`](PENDIENTES.md).
- `GET /categories`: `{ "items": [ { "id", "name" } ] }`.

## 8. Cómo probar tu API contra el frontend

1. **Humo con curl** (Windows 10+ trae `curl.exe`; en PowerShell usa `curl.exe`, no `curl`):

   ```powershell
   curl.exe -s -X POST http://localhost:8000/api/v1/players -H "Content-Type: application/json" -d '{\"nickname\":\"Ana\"}'
   # guarda el token y úsalo:
   curl.exe -s -X POST http://localhost:8000/api/v1/rooms -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{}'
   curl.exe -s -i http://localhost:8000/api/v1/rooms/<code>        # revisa X-Server-Time en los headers
   curl.exe -s -i http://localhost:8000/api/v1/games/<id>/state -H "Authorization: Bearer <token>"
   # segunda llamada con el ETag que devolvió: debe responder 304
   curl.exe -s -i http://localhost:8000/api/v1/games/<id>/state -H "Authorization: Bearer <token>" -H "If-None-Match: \"<etag>\""
   ```

2. **Pruebas de forma con pytest:** usa los JSON de `docs/contrato/ejemplos/` como esquema. El frontend hace algo parecido en [`web/src/test/fixtures.test.ts`](../../web/src/test/fixtures.test.ts): comprueba que cada ejemplo tenga **exactamente** las claves y los enums del contrato y la tabla "qué trae cada fase". Hacer lo mismo con las respuestas reales de tu API detecta desvíos antes de integrar.
3. **Con el frontend:** `VITE_USE_MOCK=false`, `npm run dev`, y recorre Home → Crear → Lobby → partida → resultados. En las herramientas de red del navegador revisa los `304` en `state` y los headers. El panel DEV (botón verde abajo a la derecha, o la tecla `` ` ``) sigue mostrando los contadores de 200/304/errores y el offset de reloj; el resto del panel (iniciar partida, saltar de fase, etc.) solo funciona en modo mock.
4. Si algo no cuadra, el cliente lo dice por código: un `code` desconocido sale como "Algo salió mal", y una respuesta de éxito que no sea JSON válido se trata como `INVALID_RESPONSE`.

## 9. Cómo se comunican los cambios

- El contrato (`docs/contrato/`) lo editan ambos de común acuerdo **antes** de tocar código. Si cambias algo, avisa y yo ajusto `web/src/api/types.ts`.
- Si la API real difiere del contrato, se arregla el tipo en el frontend o el contrato, no se improvisa en uno solo.
- Dudas abiertas y decisiones pendientes: [`PENDIENTES.md`](PENDIENTES.md) (resumen arriba del archivo).
- Antes de mergear a `main`: ramas `feat/api-<tema>`, PR, y que corran las pruebas del frente correspondiente.

## 10. Lista rápida de verificación (para marcar)

> Estado 12 oct: la API cumple los puntos marcados (verificado con pruebas, sobre SQLite). Falta confirmarlos de punta a punta con el frontend y MySQL real, y sigue abierta la casilla de las decisiones en el contrato.

- [x] `X-Server-Time` en todas las respuestas, también 304 y errores.
- [x] `ETag` `"<gameId>-v<version>"` + `Vary: Authorization` en `GET /state`; 304 sin cuerpo.
- [x] Errores `{ "error": { "code", "message" } }`, incluidos los de validación de Pydantic.
- [x] camelCase e ids como cadenas.
- [x] `POST /rooms` devuelve `participantId`; `POST /rooms/{code}/players` devuelve 201 o 200.
- [x] Un solo proceso con relojes de fase (o evaluación perezosa por petición).
- [x] `GET /state` sin `isCorrect` fuera de `REVEAL`; `lastResult` solo en `REVEAL` y `SCOREBOARD`.
- [ ] Decididas las preguntas de la sección 5 y anotadas en el contrato.
- [x] `.env` fuera del repo y MySQL solo en `127.0.0.1` (ver `PENDIENTES.md`).
