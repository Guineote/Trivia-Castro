# Pendientes y alertas (frontend ↔ API)

## Seguridad
- [ ] `.env` está **trackeado** en el repo público (subido por web). Arreglar: `git rm --cached .env`, commit, y avisar a Jared. Si esos valores se usan en otro lado, rotarlos. En `docker-compose.yml`, publicar MySQL solo en `127.0.0.1:3306`. Añadir `.env.local` al `.gitignore`.

## Por confirmar con Jared
- [ ] Precisión de timestamps (¿milisegundos?) para `endsAt` / `serverTime`.
- [ ] `lastResult` cuando el jugador no responde (timeout).
- [ ] Rangos permitidos en settings (rondas, vidas, maxPlayers) para los sliders.
- [ ] CORS: exponer `ETag` y `X-Server-Time`; permitir `Authorization` e `If-None-Match`. Alternativa: proxy de Vite.
- [ ] Puerto de la API (se asume 8000).
- [ ] Revancha tras FINAL.
- [ ] Forma de `activePower` (se asume `PowerType | null`).
- [ ] Fórmula de bonus por velocidad y base por dificultad (solo para textos de ayuda en UI).
- [ ] Fecha límite de entrega.

## Inconsistencias de la presentación
- La diapositiva 15 promete rondas "rápida" y "bomba" en v1; el contrato solo tiene `NORMAL` y `DOUBLE`. Ajustar la diapositiva o acordar con Jared.
