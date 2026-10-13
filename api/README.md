# API — Trivia Castro (frente A)

FastAPI + SQLAlchemy 2 (síncrono) + MySQL 8.4. Implementa el contrato de [`docs/contrato/`](../docs/contrato/README.md).

## Arranque (PowerShell, un comando por línea)

```powershell
docker compose up -d                       # desde la raíz; debe quedar "healthy" (MySQL en 127.0.0.1:3307)
cd api
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m alembic upgrade head   # crea las tablas
.venv\Scripts\python -m app.seed               # 10 categorías + 120 preguntas (idempotente)
.venv\Scripts\python -m uvicorn app.main:app --port 8000   # SIN --workers: un solo proceso
```

Documentación interactiva: <http://localhost:8000/docs>. Estado, decisiones y pendientes: [`PLAN-API.md`](PLAN-API.md). La API lee `../.env` (`MYSQL_*`); ver `.env.example` para `DB_HOST`, `DB_PORT` y `MIN_PLAYERS_TO_START`.
Al arrancar, si no hay preguntas, el seed corre solo.

## Pruebas

```powershell
.venv\Scripts\python -m pytest -q
```

25 pruebas (puntuación, salas, partida completa, poderes, timeout, espectador, ETag/304, índice único). Usan SQLite en memoria y un reloj falso (`app/clock.py`), así que **no tocan MySQL**: para ejercitar el contenedor juega con el Website o usa `scripts/play_bots.py`. Incluyen pruebas de **forma** contra `docs/contrato/ejemplos/`.

## Jugar sin más personas

```powershell
.venv\Scripts\python scripts\play_bots.py --room K7X4QM --bots 3   # se unen a TU sala y juegan cuando inicies
.venv\Scripts\python scripts\play_bots.py --bots 3 --rounds 2      # crea su propia sala y juega una partida
```

## Estructura

```
app/
  main.py        app, middleware X-Server-Time, CORS, manejadores de error
  routers/api.py rutas /api/v1 (capa fina)
  services/      reglas: players, rooms, games (fases, respuestas, poderes, estado), content
  scoring.py     puntos y bonus de velocidad (aislados: lo pendiente del contrato vive aquí)
  models.py      tablas (índice único (round_id, participant_id) en submitted_answers)
  seed.py / seed_data.py   categorías y preguntas
alembic/         migraciones
scripts/play_bots.py
tests/
```

## Cómo funciona el tiempo

No hay scheduler. En cada petición que toca una partida (`state`, `answers`, `powers`, `GET /rooms/{code}`…) se aplican, **en orden y con su hora programada**, todas las transiciones cuyo `phase_end_ms` ya pasó (`games.tick`). Un candado global (`GAME_LOCK`, en `app/db.py`) serializa las peticiones, así que con un solo proceso nunca hay dos relojes sobre la misma partida. `version` sube con cada cambio visible y es la base del ETag.

## Endpoints

17 de los 18 del contrato (`docs/contrato/endpoints.md`). **No existe** `POST /questions/import` (descartado: se usa el seed). No hay `/health`: usa `/docs`.

## Decisiones propias del frente A

Ver la sección «Decisiones del frente A» de [`docs/frontend/PENDIENTES.md`](../docs/frontend/PENDIENTES.md).
