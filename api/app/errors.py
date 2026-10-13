"""Errores con el formato del contrato: { "error": { "code", "message" } }."""
import logging

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("trivia")

MESSAGES = {
    "UNAUTHORIZED": "Tu sesión no es válida",
    "NOT_HOST": "Solo el host puede hacer esto",
    "FORBIDDEN": "No tienes permiso",
    "NOT_IN_GAME": "No estás en esta partida",
    "SPECTATOR_CANNOT_ACT": "Eres espectador",
    "ROOM_NOT_FOUND": "No existe esa sala",
    "GAME_NOT_FOUND": "No existe esa partida",
    "ROOM_FULL": "La sala está llena",
    "GAME_ALREADY_STARTED": "La partida ya comenzó",
    "NOT_ENOUGH_PLAYERS": "Faltan jugadores",
    "NOT_ENOUGH_QUESTIONS": "No hay suficientes preguntas",
    "ROUND_NOT_ACTIVE": "La ronda ya cerró",
    "ALREADY_ANSWERED": "Ya respondiste",
    "POWER_NOT_AVAILABLE": "Ese poder no está disponible",
    "ROUND_NOT_FINISHED": "Aún no hay resultados",
    "GAME_NOT_FINISHED": "La partida aún no termina",
    "GAME_FINISHED": "La partida ya terminó",
    "GAME_IN_PROGRESS": "Hay una partida en curso",
    "NICKNAME_TAKEN": "Ese nombre ya está en uso",
    "INVALID_OPTION": "Opción no válida",
    "VALIDATION_ERROR": "Revisa los datos",
    "NOT_FOUND": "No encontrado",
    "INTERNAL_ERROR": "Algo salió mal",
}


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str | None = None):
        self.status = status
        self.code = code
        self.message = message or MESSAGES.get(code, code)


def _body(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


def install_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error(_, exc: ApiError):
        return JSONResponse(status_code=exc.status, content=_body(exc.code, exc.message))

    @app.exception_handler(RequestValidationError)
    async def validation_error(_, exc: RequestValidationError):
        return JSONResponse(status_code=422, content=_body("VALIDATION_ERROR", MESSAGES["VALIDATION_ERROR"]))

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_, exc: StarletteHTTPException):
        code = {401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 405: "NOT_FOUND"}.get(exc.status_code, "VALIDATION_ERROR")
        return JSONResponse(status_code=exc.status_code, content=_body(code, MESSAGES[code]))
