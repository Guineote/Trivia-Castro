"""Configuración desde variables de entorno (el .env vive en la raíz del repo)."""
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.engine import URL

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")


def database_url() -> str | URL:
    explicit = os.getenv("DATABASE_URL")
    if explicit:
        return explicit
    return URL.create(
        "mysql+pymysql",
        username=os.getenv("MYSQL_USER", "trivia_user"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "3307")),
        database=os.getenv("MYSQL_DATABASE", "trivia_castro"),
        query={"charset": "utf8mb4"},
    )


# D4: mínimo 2 jugadores para iniciar (1 en desarrollo: MIN_PLAYERS_TO_START=1).
MIN_PLAYERS_TO_START = int(os.getenv("MIN_PLAYERS_TO_START", "2"))
CORS_ORIGINS = [o for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o]
