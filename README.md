# Trivia Castro

Videojuego web multijugador de trivia, inspirado en Kahoot y JKLM. Proyecto escolar de la Universidad Panamericana Aguascalientes. Equipo "Cristian Castro": Adler Antonio Calvillo Arellano (frontend) y Jared López García (API).

Se construye una **API propia desde cero** (HTTP + JSON) y un **Website** que la consume. La API ejecuta el juego: crea salas, administra jugadores y partidas, controla el tiempo de cada ronda, valida respuestas, calcula puntos y mantiene el ranking. El Website solo dibuja lo que el servidor le dice.

> Nombre del juego: **Trivia Castro**. El `CLAUDE.md` raíz, `docs/` y `.env.example` todavía dicen "Trivia Chaos" (nombre anterior); se unificará con Jared.

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

La API (FastAPI) vive en `api/`; sus instrucciones las documenta el frente A.

## Estado

- Contrato compartido v0.2 (decisiones D1–D12 confirmadas).
- Frontend: Home, Crear sala, Unirse, Lobby y el ciclo completo de partida (intro, pregunta, reveal, marcador, final, espectador) funcionando contra el mock. Faltan estadísticas, revancha, sonido y efectos.
- API: pendiente de integrar con el frontend (ver "Qué necesita el frontend de la API real" en [`web/README.md`](web/README.md#qué-necesita-el-frontend-de-la-api-real)).
