import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.ids import fmt
from app.models import Player


def create_player(db: Session, nickname: str) -> dict:
    player = Player(nickname=nickname, token=secrets.token_urlsafe(32))
    db.add(player)
    db.commit()
    return {"playerId": fmt("p", player.id), "nickname": player.nickname, "token": player.token}


def authenticate(db: Session, authorization: str | None) -> Player:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise ApiError(401, "UNAUTHORIZED")
    player = db.scalar(select(Player).where(Player.token == token.strip()))
    if player is None:
        raise ApiError(401, "UNAUTHORIZED")
    return player
