from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.clock import iso, now_ms
from app.config import CORS_ORIGINS, WEB_DIST
from app.errors import MESSAGES, install_handlers, log
from app.routers.api import router


@asynccontextmanager
async def lifespan(_: FastAPI):
    from app.seed import seed_if_empty

    seed_if_empty()
    yield


def _mount_web(app: FastAPI, dist: Path) -> None:
    """Sirve el Website compilado desde la misma URL que la API (sin CORS). Rutas de React → index.html."""
    index = dist / "index.html"
    app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def website(path: str):
        if path == "api" or path.startswith("api/"):
            raise StarletteHTTPException(404)
        target = (dist / path).resolve()
        if path and target.is_file() and dist.resolve() in target.parents:
            return FileResponse(target)
        return FileResponse(index, headers={"Cache-Control": "no-cache"})


def create_app(use_lifespan: bool = True, web_dist: Path | None = None) -> FastAPI:
    app = FastAPI(title="Trivia Castro API", version="0.2", lifespan=lifespan if use_lifespan else None)
    install_handlers(app)
    app.include_router(router)
    if web_dist is not None and (web_dist / "index.html").is_file():
        _mount_web(app, web_dist)

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


app = create_app(web_dist=WEB_DIST)
