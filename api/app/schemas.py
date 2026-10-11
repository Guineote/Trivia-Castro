"""Cuerpos de petición. El contrato usa camelCase."""
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, field_validator
from pydantic.alias_generators import to_camel

Difficulty = Literal["EASY", "MEDIUM", "HARD"]
PowerType = Literal["DOUBLE", "SHIELD", "HINT"]

# Rangos de settings (los de los sliders de la web).
MAX_PLAYERS_RANGE = (2, 12)
ROUNDS_RANGE = (1, 15)
LIVES_RANGE = (1, 5)


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


def clean_nickname(value: str) -> str:
    value = value.strip()
    if not 2 <= len(value) <= 20:
        raise ValueError("nickname de 2 a 20 caracteres")
    return value


class PlayerIn(CamelModel):
    nickname: str

    _nick = field_validator("nickname")(clean_nickname)


class SettingsIn(CamelModel):
    max_players: StrictInt | None = Field(None, ge=MAX_PLAYERS_RANGE[0], le=MAX_PLAYERS_RANGE[1])
    rounds: StrictInt | None = Field(None, ge=ROUNDS_RANGE[0], le=ROUNDS_RANGE[1])
    lives: StrictInt | None = Field(None, ge=LIVES_RANGE[0], le=LIVES_RANGE[1])
    category_ids: list[str] | None = None


class RoomIn(CamelModel):
    settings: SettingsIn | None = None


class JoinIn(CamelModel):
    nickname: str | None = None

    @field_validator("nickname")
    @classmethod
    def _nick(cls, v: str | None) -> str | None:
        return None if v is None else clean_nickname(v)


class AnswerIn(CamelModel):
    option_id: Any = None  # un valor que no sea una opción de la pregunta → INVALID_OPTION


class PowerIn(CamelModel):
    power_type: PowerType


class OptionIn(CamelModel):
    text: str = Field(min_length=1, max_length=300)
    is_correct: StrictBool


class QuestionIn(CamelModel):
    text: str = Field(min_length=1, max_length=500)
    category_id: str
    difficulty: Difficulty
    options: list[OptionIn]

    @field_validator("options")
    @classmethod
    def _four_options(cls, v: list[OptionIn]) -> list[OptionIn]:
        if len(v) != 4 or sum(o.is_correct for o in v) != 1:
            raise ValueError("4 opciones y exactamente 1 correcta")
        return v
