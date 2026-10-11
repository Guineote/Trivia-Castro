"""Rutas HTTP (capa fina: validan, delegan en services y fijan códigos/headers)."""
from fastapi import APIRouter, Depends, Header, Query, Request, Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Player
from app.schemas import AnswerIn, JoinIn, PlayerIn, PowerIn, QuestionIn, RoomIn
from app.services import content, games, players, rooms

router = APIRouter(prefix="/api/v1")


def current_player(authorization: str | None = Header(None), db: Session = Depends(get_db)) -> Player:
    return players.authenticate(db, authorization)


# ── sesión ──────────────────────────────────────────────────────────────────
@router.post("/players", status_code=201)
def create_player(body: PlayerIn, db: Session = Depends(get_db)):
    return players.create_player(db, body.nickname)


# ── salas ───────────────────────────────────────────────────────────────────
@router.post("/rooms", status_code=201)
def create_room(body: RoomIn | None = None, player: Player = Depends(current_player), db: Session = Depends(get_db)):
    return rooms.create_room(db, player, body.settings if body else None)


@router.get("/rooms/{code}")
def get_room(code: str, db: Session = Depends(get_db)):
    return rooms.get_room(db, code)


@router.patch("/rooms/{code}")
def update_room(code: str, body: RoomIn, player: Player = Depends(current_player), db: Session = Depends(get_db)):
    return rooms.update_room(db, player, code, body.settings)


@router.post("/rooms/{code}/players")
def join_room(code: str, response: Response, body: JoinIn | None = None,
              player: Player = Depends(current_player), db: Session = Depends(get_db)):
    created, payload = rooms.join_room(db, player, code, body.nickname if body else None)
    response.status_code = 201 if created else 200
    return payload


@router.delete("/rooms/{code}/players/{participant_id}", status_code=204)
def leave_room(code: str, participant_id: str, player: Player = Depends(current_player), db: Session = Depends(get_db)):
    rooms.leave_room(db, player, code, participant_id)
    return Response(status_code=204)


@router.post("/rooms/{code}/games", status_code=201)
def start_game(code: str, player: Player = Depends(current_player), db: Session = Depends(get_db)):
    return rooms.start_game(db, player, code)


# ── partida ─────────────────────────────────────────────────────────────────
@router.get("/games/{game_id}/state")
def get_state(game_id: str, request: Request, response: Response,
              player: Player = Depends(current_player), db: Session = Depends(get_db)):
    game, state = games.read_state(db, player, game_id, request.headers.get("if-none-match"))
    headers = {"ETag": games.etag_of(game), "Vary": "Authorization"}
    if state is None:
        return Response(status_code=304, headers=headers)
    response.headers.update(headers)
    return state


@router.post("/games/{game_id}/rounds/{number}/answers", status_code=202)
def post_answer(game_id: str, number: int, body: AnswerIn,
                player: Player = Depends(current_player), db: Session = Depends(get_db)):
    return games.answer(db, player, game_id, number, body.option_id)


@router.post("/games/{game_id}/rounds/{number}/powers")
def post_power(game_id: str, number: int, body: PowerIn,
               player: Player = Depends(current_player), db: Session = Depends(get_db)):
    return games.use_power(db, player, game_id, number, body.power_type)


@router.get("/games/{game_id}/rounds/{number}/results")
def get_round_results(game_id: str, number: int, player: Player = Depends(current_player), db: Session = Depends(get_db)):
    return games.round_results(db, player, game_id, number)


@router.get("/games/{game_id}/ranking")
def get_ranking(game_id: str, player: Player = Depends(current_player), db: Session = Depends(get_db)):
    return games.ranking(db, player, game_id)


@router.get("/games/{game_id}/results")
def get_results(game_id: str, player: Player = Depends(current_player), db: Session = Depends(get_db)):
    return games.results(db, player, game_id)


@router.post("/games/{game_id}/advance")
def post_advance(game_id: str, player: Player = Depends(current_player), db: Session = Depends(get_db)):
    return games.advance(db, player, game_id)


# ── contenido (administración) ──────────────────────────────────────────────
@router.get("/categories")
def get_categories(player: Player = Depends(current_player), db: Session = Depends(get_db)):
    return content.list_categories(db)


@router.get("/questions")
def get_questions(categoryId: str | None = None, difficulty: str | None = None,
                  limit: int = Query(20, ge=1, le=200), offset: int = Query(0, ge=0),
                  player: Player = Depends(current_player), db: Session = Depends(get_db)):
    return content.list_questions(db, categoryId, difficulty, limit, offset)


@router.post("/questions", status_code=201)
def post_question(body: QuestionIn, player: Player = Depends(current_player), db: Session = Depends(get_db)):
    return content.create_question(db, body)
