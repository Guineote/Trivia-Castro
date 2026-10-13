# Trivia Castro — imagen de producción: API (FastAPI) + Website compilado, en un solo contenedor.
# Contexto de build: la raíz del repo.

# ── 1. Compila el Website ───────────────────────────────────────────────────
FROM node:22-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
# El código del mock importa las fixtures de docs/contrato/ejemplos (alias @contrato).
COPY docs/contrato/ /src/docs/contrato/
# Sin VITE_USE_MOCK: el build de producción usa la API real y no incluye el mock ni el DevPanel.
RUN npm run build

# ── 2. API + Website ────────────────────────────────────────────────────────
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 WEB_DIST=/app/web_dist
WORKDIR /app
COPY api/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY api/ ./
COPY --from=web /src/web/dist /app/web_dist
RUN useradd --system --no-create-home trivia
USER trivia
EXPOSE 8000
# UN SOLO proceso (sin --workers): las fases se evalúan por petición y no puede haber dos relojes.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
