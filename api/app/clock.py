"""Reloj del servidor en milisegundos epoch. Las pruebas lo reemplazan con set_fake()."""
import time
from datetime import datetime, timezone

_fake_ms: int | None = None


def now_ms() -> int:
    return _fake_ms if _fake_ms is not None else int(time.time() * 1000)


def set_fake(ms: int | None) -> None:
    global _fake_ms
    _fake_ms = ms


def advance_fake(ms: int) -> None:
    global _fake_ms
    assert _fake_ms is not None
    _fake_ms += ms


def iso(ms: int) -> str:
    """ISO 8601 UTC con milisegundos y Z."""
    return datetime.fromtimestamp(ms / 1000, timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
