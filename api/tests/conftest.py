import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import clock
from app.db import get_db
from app.ids import parse
from app.main import create_app
from app.models import Base, Option, Round
from app.seed import seed

EJEMPLOS = Path(__file__).resolve().parents[2] / "docs" / "contrato" / "ejemplos"
T0 = 1_790_000_000_000  # reloj falso: 2026-09-21


def ejemplo(name: str) -> dict:
    return json.loads((EJEMPLOS / f"{name}.json").read_text(encoding="utf-8"))


class Api:
    """Cliente de pruebas con helpers del flujo del juego."""

    def __init__(self, client: TestClient, factory):
        self.c, self.factory = client, factory

    def player(self, nickname: str) -> dict:
        r = self.c.post("/api/v1/players", json={"nickname": nickname})
        assert r.status_code == 201, r.text
        return {"h": {"Authorization": f"Bearer {r.json()['token']}"}, **r.json()}

    def room(self, host: dict, **settings) -> dict:
        r = self.c.post("/api/v1/rooms", headers=host["h"], json={"settings": settings})
        assert r.status_code == 201, r.text
        return r.json()

    def join(self, room: dict, who: dict):
        return self.c.post(f"/api/v1/rooms/{room['code']}/players", headers=who["h"])

    def start(self, room: dict, host: dict) -> str:
        r = self.c.post(f"/api/v1/rooms/{room['code']}/games", headers=host["h"])
        assert r.status_code == 201, r.text
        return r.json()["gameId"]

    def state(self, gid: str, who: dict, **headers):
        return self.c.get(f"/api/v1/games/{gid}/state", headers={**who["h"], **headers})

    def answer(self, gid: str, n: int, who: dict, option_id):
        return self.c.post(f"/api/v1/games/{gid}/rounds/{n}/answers", headers=who["h"], json={"optionId": option_id})

    def power(self, gid: str, n: int, who: dict, power_type: str):
        return self.c.post(f"/api/v1/games/{gid}/rounds/{n}/powers", headers=who["h"], json={"powerType": power_type})

    def correct_option(self, gid: str, n: int) -> str:
        with self.factory() as db:
            rnd = db.scalar(select(Round).where(Round.game_id == parse("g", gid), Round.number == n))
            return f"o{db.scalar(select(Option.id).where(Option.question_id == rnd.question_id, Option.is_correct))}"

    def wrong_option(self, gid: str, n: int) -> str:
        good = self.correct_option(gid, n)
        with self.factory() as db:
            rnd = db.scalar(select(Round).where(Round.game_id == parse("g", gid), Round.number == n))
            return next(f"o{i}" for i in rnd.option_order if f"o{i}" != good)

    def wait(self, ms: int) -> None:
        clock.advance_fake(ms)

    def to_phase(self, gid: str, who: dict, phase: str, limit: int = 40) -> dict:
        """Avanza el reloj fase a fase hasta llegar a `phase`."""
        for _ in range(limit):
            body = self.state(gid, who).json()
            if body["phase"] == phase:
                return body
            clock.set_fake(max(clock.now_ms(), int(_ms(body["round"]["endsAt"])) if body["round"] else clock.now_ms()))
        raise AssertionError(f"no llegó a {phase}")


def _ms(iso_value: str) -> int:
    from datetime import datetime

    return int(datetime.fromisoformat(iso_value.replace("Z", "+00:00")).timestamp() * 1000)


@pytest.fixture()
def api():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        seed(db)
    app = create_app(use_lifespan=False)

    def override():
        db = factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    clock.set_fake(T0)
    yield Api(TestClient(app), factory)
    clock.set_fake(None)
