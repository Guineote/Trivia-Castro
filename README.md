# Trivia Castro

Videojuego web multijugador de trivia, inspirado en Kahoot y JKLM. Proyecto escolar de la Universidad Panamericana Aguascalientes. Equipo "Cristian Castro": Adler Antonio Calvillo Arellano (frontend) y Jared López García (API).

Se construye una **API propia desde cero** (HTTP + JSON) y un **Website** que la consume. La API ejecuta el juego: crea salas, administra jugadores y partidas, controla el tiempo de cada ronda, valida respuestas, calcula puntos y mantiene el ranking. El Website solo dibuja lo que el servidor le dice.

> Nombre oficial del juego: **Trivia Castro**.

## Estructura del repositorio

```
├── api/            Frente A (Jared): FastAPI + SQLAlchemy + MySQL
├── web/            Frente B (Adler): React + Vite + TypeScript   → ver web/README.md
├── docs/
│   ├── contrato/   Contrato compartido API ↔ Website (fuente de verdad)
│   ├── frontend/   Design brief, spec de pantallas y PENDIENTES (huecos del contrato)
│   └── etapa2/     Material histórico de la exposición (no contractual)
├── docker-compose.yml   MySQL para ambos
├── CLAUDE.md       Contexto y decisiones del proyecto
└── PLAN.md         Plan de trabajo en paralelo
```

## Por dónde empezar

| Quiero… | Lee |
|---|---|
| Entender qué es el proyecto y las decisiones tomadas | [`CLAUDE.md`](CLAUDE.md) |
| Ver el plan y quién hace qué | [`PLAN.md`](PLAN.md) |
| Saber exactamente qué manda/recibe cada endpoint | [`docs/contrato/`](docs/contrato/README.md) ([endpoints](docs/contrato/endpoints.md), [ejemplos JSON](docs/contrato/ejemplos/)) |
| Correr o tocar el frontend | [`web/README.md`](web/README.md) |
| **Construir la API (Jared): qué espera el frontend, cómo probar y decisiones abiertas** | [`docs/frontend/GUIA-PARA-LA-API.md`](docs/frontend/GUIA-PARA-LA-API.md) y [`api/CLAUDE.md`](api/CLAUDE.md) |
| Saber qué dudas del contrato siguen abiertas | [`docs/frontend/PENDIENTES.md`](docs/frontend/PENDIENTES.md) |

**Si algo difiere entre documentos, gana el contrato.** Si el contrato cambia, se avisa al otro integrante y se actualiza `docs/contrato/` antes de tocar código.

## Arranque rápido

**Frontend** (no necesita API: trae un modo mock):

```bash
cd web
npm install
cp .env.example .env.local   # VITE_USE_MOCK=true
npm run dev                  # http://localhost:5173
```

En PowerShell: `Copy-Item .env.example .env.local` y los comandos uno por línea (no admite `&&`).

**Base de datos** (para la API):

```bash
cp .env.example .env         # cambia las contraseñas; .env no se debe commitear
docker compose up -d
```

**API** (FastAPI en `api/`, puerto 8000): los pasos completos están en [`api/README.md`](api/README.md) (venv, `alembic upgrade head`, `uvicorn app.main:app --port 8000`). Para jugar sin más personas: `python scripts/play_bots.py --bots 3`.

## Estado

- Contrato compartido v0.2 (decisiones D1–D12 confirmadas).
- Frontend: Home, Crear sala, Unirse, Lobby, el ciclo completo de partida (intro, pregunta, reveal, marcador, final, espectador), estadísticas y resultados detallados, pantallas de error, sonido y efecto CRT, todo funcionando contra el mock. Falta la revancha (pendiente con Jared).
- API: implementada y probada (17 de 18 endpoints, 120 preguntas, 25 pruebas en verde); detalle en [`api/PLAN-API.md`](api/PLAN-API.md). Integración con el frontend probada a mano el 12 oct, con MySQL (ver "Qué necesita el frontend de la API real" en [`web/README.md`](web/README.md#qué-necesita-el-frontend-de-la-api-real)).
