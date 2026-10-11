"""Ids del contrato: cadenas con prefijo (p1, pt2, g3, q4, o5, c6)."""


def fmt(prefix: str, value: int) -> str:
    return f"{prefix}{value}"


def parse(prefix: str, raw: object) -> int | None:
    if not isinstance(raw, str) or not raw.startswith(prefix):
        return None
    rest = raw[len(prefix):]
    return int(rest) if rest.isdigit() and len(rest) < 12 else None
