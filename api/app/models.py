from sqlalchemy import JSON, BigInteger, Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Player(Base):
    __tablename__ = "players"
    id: Mapped[int] = mapped_column(primary_key=True)
    nickname: Mapped[str] = mapped_column(String(20))
    token: Mapped[str] = mapped_column(String(64), unique=True)


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), unique=True)


class Question(Base):
    __tablename__ = "questions"
    id: Mapped[int] = mapped_column(primary_key=True)
    text: Mapped[str] = mapped_column(String(500))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)
    difficulty: Mapped[str] = mapped_column(String(10))  # EASY | MEDIUM | HARD
    external_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    options: Mapped[list["Option"]] = relationship(order_by="Option.id", cascade="all, delete-orphan")


class Option(Base):
    __tablename__ = "options"
    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), index=True)
    text: Mapped[str] = mapped_column(String(300))
    is_correct: Mapped[bool] = mapped_column(Boolean)


class Room(Base):
    __tablename__ = "rooms"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(6), unique=True)
    status: Mapped[str] = mapped_column(String(10), default="WAITING")  # WAITING | IN_GAME | FINISHED
    max_players: Mapped[int] = mapped_column(Integer)
    rounds: Mapped[int] = mapped_column(Integer)
    lives: Mapped[int] = mapped_column(Integer)
    category_ids: Mapped[list] = mapped_column(JSON, default=list)  # ["c1", ...]; vacío = todas


class Participant(Base):
    """Cómo te va en una sala concreta (separado de Player)."""
    __tablename__ = "participants"
    __table_args__ = (UniqueConstraint("room_id", "player_id"), UniqueConstraint("room_id", "nickname"))
    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), index=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"))
    nickname: Mapped[str] = mapped_column(String(20))
    is_host: Mapped[bool] = mapped_column(Boolean, default=False)
    score: Mapped[int] = mapped_column(Integer, default=0)
    lives: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(10), default="ACTIVE")  # ACTIVE | SPECTATOR


class ParticipantPower(Base):
    """Inventario de poderes; used_ms = null mientras esté disponible."""
    __tablename__ = "participant_powers"
    id: Mapped[int] = mapped_column(primary_key=True)
    participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id"), index=True)
    power_type: Mapped[str] = mapped_column(String(10))
    used_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)


class Game(Base):
    __tablename__ = "games"
    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), index=True)
    phase: Mapped[str] = mapped_column(String(12))
    phase_start_ms: Mapped[int] = mapped_column(BigInteger)
    phase_end_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # null en FINAL
    version: Mapped[int] = mapped_column(Integer, default=0)  # base del ETag
    round_index: Mapped[int] = mapped_column(Integer, default=0)
    initial_order: Mapped[list] = mapped_column(JSON, default=list)  # participantIds antes de la ronda 1


class Round(Base):
    __tablename__ = "rounds"
    __table_args__ = (UniqueConstraint("game_id", "number"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True)
    number: Mapped[int] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(String(10))  # NORMAL | DOUBLE
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"))
    option_order: Mapped[list] = mapped_column(JSON)  # ids de Option en el orden mostrado
    closed: Mapped[bool] = mapped_column(Boolean, default=False)
    ranking_after: Mapped[list | None] = mapped_column(JSON, nullable=True)  # participantIds ordenados
    question: Mapped[Question] = relationship()


class SubmittedAnswer(Base):
    __tablename__ = "submitted_answers"
    # La garantía de "una respuesta por ronda" vive en la base de datos.
    __table_args__ = (UniqueConstraint("round_id", "participant_id", name="uq_answer_round_participant"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    round_id: Mapped[int] = mapped_column(ForeignKey("rounds.id"), index=True)
    participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id"))
    option_id: Mapped[int] = mapped_column(ForeignKey("options.id"))
    answer_time_ms: Mapped[int] = mapped_column(Integer)


class PowerUse(Base):
    __tablename__ = "power_uses"
    __table_args__ = (UniqueConstraint("round_id", "participant_id"),)  # un poder por ronda
    id: Mapped[int] = mapped_column(primary_key=True)
    round_id: Mapped[int] = mapped_column(ForeignKey("rounds.id"), index=True)
    participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id"))
    power_type: Mapped[str] = mapped_column(String(10))
    used_ms: Mapped[int] = mapped_column(BigInteger)
    removed_option_ids: Mapped[list] = mapped_column(JSON, default=list)  # HINT


class RoundOutcome(Base):
    """Resultado de cada participante al cerrar la ronda (last_result = null si ya era espectador)."""
    __tablename__ = "round_outcomes"
    __table_args__ = (UniqueConstraint("round_id", "participant_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    round_id: Mapped[int] = mapped_column(ForeignKey("rounds.id"), index=True)
    participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id"))
    last_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
