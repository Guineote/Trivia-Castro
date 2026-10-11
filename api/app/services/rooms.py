import secrets

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import MIN_PLAYERS_TO_START
from app.errors import ApiError
from app.ids import fmt, parse
from app.models import Category, Game, Participant, Player, Question, Room
from app.schemas import SettingsIn
from app.services import games

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
DEFAULT_SETTINGS = {"max_players": 8, "rounds": 10, "lives": 3}


def find_room(db: Session, code: str) -> Room:
    room = db.scalar(select(Room).where(Room.code == code.upper()))
    if room is None:
        raise ApiError(404, "ROOM_NOT_FOUND")
    return room


def participants_of(db: Session, room: Room) -> list[Participant]:
    return list(db.scalars(select(Participant).where(Participant.room_id == room.id).order_by(Participant.id)))


def participant_of(db: Session, room: Room, player: Player) -> Participant | None:
    return db.scalar(select(Participant).where(Participant.room_id == room.id, Participant.player_id == player.id))


def current_game(db: Session, room: Room) -> Game | None:
    return db.scalar(select(Game).where(Game.room_id == room.id).order_by(Game.id.desc()))


def room_dict(db: Session, room: Room) -> dict:
    members = participants_of(db, room)
    game = current_game(db, room)
    host = next((p for p in members if p.is_host), None)
    return {
        "code": room.code,
        "status": room.status,
        "hostParticipantId": fmt("pt", host.id) if host else "",
        "settings": {
            "maxPlayers": room.max_players,
            "rounds": room.rounds,
            "lives": room.lives,
            "categoryIds": list(room.category_ids or []),
        },
        "participants": [{"participantId": fmt("pt", p.id), "nickname": p.nickname, "isHost": p.is_host} for p in members],
        "currentGameId": fmt("g", game.id) if game else None,
    }


def _apply_settings(db: Session, room: Room, patch: SettingsIn | None) -> None:
    if patch is None:
        return
    if patch.max_players is not None:
        room.max_players = patch.max_players
    if patch.rounds is not None:
        room.rounds = patch.rounds
    if patch.lives is not None:
        room.lives = patch.lives
    if patch.category_ids is not None:
        ids = [parse("c", c) for c in patch.category_ids]
        known = set(db.scalars(select(Category.id)))
        if any(i is None or i not in known for i in ids):
            raise ApiError(422, "VALIDATION_ERROR")
        room.category_ids = [fmt("c", i) for i in dict.fromkeys(ids)]


def create_room(db: Session, player: Player, settings: SettingsIn | None) -> dict:
    room = Room(code=_new_code(db), status="WAITING", category_ids=[], **DEFAULT_SETTINGS)
    _apply_settings(db, room, settings)
    db.add(room)
    db.flush()
    host = Participant(room_id=room.id, player_id=player.id, nickname=player.nickname, is_host=True)
    db.add(host)
    db.commit()
    return {**room_dict(db, room), "participantId": fmt("pt", host.id)}


def _new_code(db: Session) -> str:
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
        if db.scalar(select(Room.id).where(Room.code == code)) is None:
            return code


def get_room(db: Session, code: str) -> dict:
    room = find_room(db, code)
    game = current_game(db, room)
    if game is not None:
        games.tick(db, game)  # al terminar la partida la sala pasa a FINISHED
    return room_dict(db, room)


def update_room(db: Session, player: Player, code: str, settings: SettingsIn | None) -> dict:
    room = find_room(db, code)
    me = participant_of(db, room, player)
    if me is None or not me.is_host:
        raise ApiError(403, "NOT_HOST")
    if room.status != "WAITING":
        raise ApiError(409, "GAME_ALREADY_STARTED")
    _apply_settings(db, room, settings)
    if room.max_players < len(participants_of(db, room)):
        raise ApiError(422, "VALIDATION_ERROR")
    db.commit()
    return room_dict(db, room)


def join_room(db: Session, player: Player, code: str, nickname: str | None) -> tuple[bool, dict]:
    """Devuelve (creado, cuerpo). creado=False → 200 (ya era participante, reconexión)."""
    room = find_room(db, code)
    members = participants_of(db, room)
    existing = next((p for p in members if p.player_id == player.id), None)
    if existing is not None:
        return False, {"participantId": fmt("pt", existing.id), "participants": room_dict(db, room)["participants"]}
    if room.status != "WAITING":
        raise ApiError(409, "GAME_ALREADY_STARTED")
    if len(members) >= room.max_players:
        raise ApiError(409, "ROOM_FULL")
    name = nickname or player.nickname
    if any(p.nickname.lower() == name.lower() for p in members):
        raise ApiError(422, "NICKNAME_TAKEN")
    member = Participant(room_id=room.id, player_id=player.id, nickname=name, is_host=False)
    db.add(member)
    db.commit()
    return True, {"participantId": fmt("pt", member.id), "participants": room_dict(db, room)["participants"]}


def leave_room(db: Session, player: Player, code: str, participant_id: str) -> None:
    room = find_room(db, code)
    me = participant_of(db, room, player)
    if me is None:
        raise ApiError(403, "FORBIDDEN")
    target_id = parse("pt", participant_id)
    target = db.get(Participant, target_id) if target_id is not None else None
    if target is None or target.room_id != room.id:
        raise ApiError(404, "ROOM_NOT_FOUND")
    if target.id != me.id and not me.is_host:
        raise ApiError(403, "FORBIDDEN")
    if room.status != "WAITING":
        return  # en plena partida la fila se conserva: se queda sin responder y acaba de espectador
    db.delete(target)
    db.flush()
    remaining = participants_of(db, room)
    if not remaining:
        db.delete(room)
    elif target.is_host:
        remaining[0].is_host = True  # D11: el participante más antiguo
    db.commit()


def start_game(db: Session, player: Player, code: str) -> dict:
    room = find_room(db, code)
    me = participant_of(db, room, player)
    if me is None or not me.is_host:
        raise ApiError(403, "NOT_HOST")
    if room.status != "WAITING":
        raise ApiError(409, "GAME_ALREADY_STARTED")
    members = participants_of(db, room)
    if len(members) < MIN_PLAYERS_TO_START:
        raise ApiError(409, "NOT_ENOUGH_PLAYERS")
    wanted = [parse("c", c) for c in (room.category_ids or [])]
    query = select(func.count(Question.id))
    if wanted:
        query = query.where(Question.category_id.in_(wanted))
    if (db.scalar(query) or 0) < room.rounds:
        raise ApiError(409, "NOT_ENOUGH_QUESTIONS")
    game = games.create_game(db, room, members)
    db.commit()
    return {"gameId": fmt("g", game.id), "phase": game.phase, "version": game.version}
