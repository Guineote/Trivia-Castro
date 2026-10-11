import threading

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import database_url

engine = create_engine(database_url(), pool_pre_ping=True, pool_recycle=1800)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

# Un solo proceso y una sola petición a la vez sobre el estado del juego:
# evita dos relojes/escrituras concurrentes sobre la misma partida (fases perezosas).
# Lock simple, no RLock: FastAPI puede liberar la dependencia en otro hilo.
GAME_LOCK = threading.Lock()


def get_db():
    with GAME_LOCK:
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()
