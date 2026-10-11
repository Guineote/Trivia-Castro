"""Reglas de puntuación. Todo lo pendiente del contrato está aislado aquí.

puntos = (base + bonus_velocidad) x mult_ronda x mult_poder
"""

QUESTION_WINDOW_MS = 20_000

# PENDIENTE (contrato): puntaje base por dificultad. Valores provisionales (los mismos del mock).
BASE_POINTS = {"EASY": 500, "MEDIUM": 800, "HARD": 1100}


def base_points(difficulty: str) -> int:
    return BASE_POINTS[difficulty]


def speed_bonus(answer_time_ms: int) -> int:
    """PENDIENTE (contrato): fórmula del bonus de velocidad. Provisional: 400·(20 s − t)/20 s."""
    return max(0, round(400 * (QUESTION_WINDOW_MS - answer_time_ms) / QUESTION_WINDOW_MS))


def round_multiplier(round_type: str) -> int:
    return 2 if round_type == "DOUBLE" else 1


def power_multiplier(active_power: str | None) -> int:
    return 2 if active_power == "DOUBLE" else 1


def points_for(difficulty: str, answer_time_ms: int, round_type: str, active_power: str | None) -> dict:
    base = base_points(difficulty)
    bonus = speed_bonus(answer_time_ms)
    rm, pm = round_multiplier(round_type), power_multiplier(active_power)
    return {
        "basePoints": base,
        "speedBonus": bonus,
        "roundMultiplier": rm,
        "powerMultiplier": pm,
        "pointsAwarded": (base + bonus) * rm * pm,
    }
