from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.clock import iso, now_ms
from app.config import CORS_ORIGINS
from app.errors import MESSAGES, install_handlers, log
from app.routers.api import router


@asynccontextmanager
async def lifespan(_: FastAPI):
    from app.seed import seed_if_empty

    seed_if_empty()
    yield


def create_app(use_lifespan: bool = True) -> FastAPI:
    app = FastAPI(title="Trivia Castro API", version="0.2", lifespan=lifespan if use_lifespan else None)
    install_handlers(app)
    app.include_router(router)

    @app.middleware("http")
    async def server_time(request: Request, call_next):
        """X-Server-Time en TODAS las respuestas (también 304 y errores)."""
        try:
            response = await call_next(request)
        except Exception:
            log.exception("Error no controlado")
            response = JSONResponse(
                status_code=500, content={"error": {"code": "INTERNAL_ERROR", "message": MESSAGES["INTERNAL_ERROR"]}})
        response.headers["X-Server-Time"] = iso(now_ms())
        return response

    # Se añade al final → queda como capa externa y también cubre las respuestas anteriores.
    app.add_middleware(
        CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"],
        allow_headers=["Authorization", "If-None-Match", "Content-Type"],
        expose_headers=["ETag", "X-Server-Time"],
    )
    return app


app = create_app()
