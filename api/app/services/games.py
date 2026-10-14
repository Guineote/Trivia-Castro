"""Reglas de la partida: fases perezosas, respuestas, poderes, cierre de ronda y lecturas.

Las fases no usan scheduler: en cada petición se aplican, en orden y con su hora programada,
todas las transiciones cuyo `phase_end_ms` ya pasó. Con un solo proceso y GAME_LOCK no hay
dos relojes sobre la misma partida.
"""
import random

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import scoring
from app.clock import iso, now_ms
from app.errors import ApiError
from app.ids import fmt, parse
from app.models import (
    Game,
    Participant,
    ParticipantPower,
    PowerUse,
    Question,
    Room,
    Round,
    RoundOutcome,
    SubmittedAnswer,
)

PHASE_MS = {"ROUND_INTRO": 3_000, "QUESTION": 20_000, "REVEAL": 4_000, "SCOREBOARD": 6_000}
POWER_TYPES = ["DOUBLE", "SHIELD", "HINT"]
RESULT_PHASES = ("REVEAL", "SCOREBOARD")
ANSWER_PHASES = ("QUESTION", "REVEAL", "SCOREBOARD")


# ── búsquedas ───────────────────────────────────────────────────────────────
def get_game(db: Session, raw_id: str) -> Game:
    game_id = parse("g", raw_id)
    game = db.get(Game, game_id) if game_id is not None else None
    if game is None:
        raise ApiError(404, "GAME_NOT_FOUND")
    return game


def members_of(db: Session, game: Game) -> list[Participant]:
    return list(db.scalars(select(Participant).where(Participant.room_id == game.room_id).order_by(Participant.id)))


def member_for(db: Session, game: Game, player) -> Participant:
    me = db.scalar(
        select(Participant).where(Participant.room_id == game.room_id, Participant.player_id == player.id)
    )
    if me is None:
        raise ApiError(403, "NOT_IN_GAME")
    return me


def rounds_of(db: Session, game: Game) -> list[Round]:
    return list(db.scalars(select(Round).where(Round.game_id == game.id).order_by(Round.number)))


def current_round(db: Session, game: Game) -> Round:
    return db.scalar(select(Round).where(Round.game_id == game.id, Round.number == game.round_index + 1))


def standings(members: list[Participant]) -> list[Participant]:
    """Mayor puntaje primero; el empate se resuelve por orden de unión a la sala."""
    return sorted(members, key=lambda p: (-p.score, p.id))


# ── creación ────────────────────────────────────────────────────────────────
def create_game(db: Session, room: Room, members: list[Participant]) -> Game:
    wanted = [parse("c", c) for c in (room.category_ids or [])]
    query = select(Question)
    if wanted:
        query = query.where(Question.category_id.in_(wanted))
    picked = random.sample(list(db.scalars(query)), room.rounds)

    at = now_ms()
    game = Game(
        room_id=room.id,
        phase="ROUND_INTRO",
        phase_start_ms=at,
        phase_end_ms=at + PHASE_MS["ROUND_INTRO"],
        version=1,
        round_index=0,
        initial_order=[p.id for p in members],
    )
    db.add(game)
    db.flush()
    for number, question in enumerate(picked, start=1):
        order = [o.id for o in question.options]
        random.shuffle(order)
        # Las rondas DOUBLE aparecen cada tercera ronda (predecible para la demo).
        db.add(Round(game_id=game.id, number=number, type="DOUBLE" if number % 3 == 0 else "NORMAL",
                     question_id=question.id, option_order=order))
    # Revancha (D13): el inventario de la partida anterior se descarta; si no, los poderes sin usar se acumularían.
    db.execute(delete(ParticipantPower).where(ParticipantPower.participant_id.in_([p.id for p in members])))
    for p in members:
        p.score, p.lives, p.status = 0, room.lives, "ACTIVE"
        for power in POWER_TYPES:
            db.add(ParticipantPower(participant_id=p.id, power_type=power))
    room.status = "IN_GAME"
    db.flush()
    return game


# ── fases ───────────────────────────────────────────────────────────────────
def _enter(db: Session, game: Game, phase: str, at: int) -> None:
    game.phase = phase
    game.phase_start_ms = at
    game.phase_end_ms = None if phase == "FINAL" else at + PHASE_MS[phase]
    game.version += 1
    if phase == "FINAL":
        db.get(Room, game.room_id).status = "FINISHED"


def transition(db: Session, game: Game, at: int) -> None:
    if game.phase == "ROUND_INTRO":
        _enter(db, game, "QUESTION", at)
    elif game.phase == "QUESTION":
        _close_round(db, game, current_round(db, game))
        _enter(db, game, "REVEAL", at)
    elif game.phase == "REVEAL":
        _enter(db, game, "SCOREBOARD", at)
    elif game.phase == "SCOREBOARD":
        total = db.scalar(select(func.count(Round.id)).where(Round.game_id == game.id))
        if game.round_index + 1 >= total:
            _enter(db, game, "FINAL", at)
        else:
            game.round_index += 1
            _enter(db, game, "ROUND_INTRO", at)
    db.flush()


def tick(db: Session, game: Game) -> None:
    """Aplica en orden las transiciones vencidas, cada una con su hora programada."""
    t = now_ms()
    changed = False
    for _ in range(500):
        if game.phase_end_ms is None or game.phase_end_ms > t:
            break
        transition(db, game, game.phase_end_ms)
        changed = True
    if changed:
        db.commit()


def advance(db: Session, player, raw_game_id: str) -> dict:
    game = get_game(db, raw_game_id)
    me = member_for(db, game, player)
    if not me.is_host:
        raise ApiError(403, "NOT_HOST")
    tick(db, game)
    if game.phase == "FINAL":
        raise ApiError(409, "GAME_FINISHED")
    transition(db, game, now_ms())
    db.commit()
    return {"phase": game.phase, "version": game.version}


def _close_round(db: Session, game: Game, rnd: Round) -> None:
    """Puntos, vidas, espectadores y resultados de la ronda."""
    members = members_of(db, game)
    answers = {a.participant_id: a for a in db.scalars(select(SubmittedAnswer).where(SubmittedAnswer.round_id == rnd.id))}
    uses = {u.participant_id: u for u in db.scalars(select(PowerUse).where(PowerUse.round_id == rnd.id))}
    correct_id = next(o.id for o in rnd.question.options if o.is_correct)
    for p in members:
        if p.status != "ACTIVE":
            db.add(RoundOutcome(round_id=rnd.id, participant_id=p.id, last_result=None))
            continue
        answer = answers.get(p.id)
        active = uses[p.id].power_type if p.id in uses else None
        is_correct = answer is not None and answer.option_id == correct_id
        if is_correct:
            parts = scoring.points_for(rnd.question.difficulty, answer.answer_time_ms, rnd.type, active)
        else:  # fallo o timeout: 0 puntos
            parts = {"basePoints": 0, "speedBonus": 0, "roundMultiplier": scoring.round_multiplier(rnd.type),
                     "powerMultiplier": scoring.power_multiplier(active), "pointsAwarded": 0}
        lives_lost = 0 if is_correct or active == "SHIELD" else 1
        p.lives = max(0, p.lives - lives_lost)
        became_spectator = p.lives == 0
        if became_spectator:
            p.status = "SPECTATOR"
        p.score += parts["pointsAwarded"]
        db.add(RoundOutcome(round_id=rnd.id, participant_id=p.id, last_result={
            "chosenOptionId": fmt("o", answer.option_id) if answer else None,
            "isCorrect": is_correct,
            "answerTimeMs": answer.answer_time_ms if answer else None,
            **parts,
            "livesLost": lives_lost,
            "becameSpectator": became_spectator,
            "powerUsed": active,
        }))
    rnd.closed = True
    rnd.ranking_after = [p.id for p in standings(members)]
    db.flush()


# ── acciones ────────────────────────────────────────────────────────────────
def _active_round(db: Session, game: Game, me: Participant, round_number: int) -> Round:
    if me.status == "SPECTATOR":
        raise ApiError(403, "SPECTATOR_CANNOT_ACT")
    rnd = current_round(db, game)
    if game.phase != "QUESTION" or rnd.number != round_number:
        raise ApiError(409, "ROUND_NOT_ACTIVE")
    return rnd


def _answered(db: Session, rnd: Round, me: Participant) -> bool:
    return db.scalar(select(SubmittedAnswer.id).where(
        SubmittedAnswer.round_id == rnd.id, SubmittedAnswer.participant_id == me.id)) is not None


def answer(db: Session, player, raw_game_id: str, round_number: int, raw_option) -> dict:
    game = get_game(db, raw_game_id)
    me = member_for(db, game, player)
    tick(db, game)
    rnd = _active_round(db, game, me, round_number)
    option_id = parse("o", raw_option)
    if option_id is None or option_id not in rnd.option_order:
        raise ApiError(422, "INVALID_OPTION")
    if _answered(db, rnd, me):
        raise ApiError(409, "ALREADY_ANSWERED")
    # El tiempo lo mide el servidor al recibir la respuesta.
    db.add(SubmittedAnswer(round_id=rnd.id, participant_id=me.id, option_id=option_id,
                           answer_time_ms=max(0, now_ms() - game.phase_start_ms)))
    game.version += 1
    try:
        db.commit()
    except IntegrityError:  # el índice único (round, participant) es la garantía final
        db.rollback()
        raise ApiError(409, "ALREADY_ANSWERED")
    return {"accepted": True}


def use_power(db: Session, player, raw_game_id: str, round_number: int, power_type: str) -> dict:
    game = get_game(db, raw_game_id)
    me = member_for(db, game, player)
    tick(db, game)
    rnd = _active_round(db, game, me, round_number)
    if _answered(db, rnd, me):
        raise ApiError(409, "ALREADY_ANSWERED")
    already = db.scalar(select(PowerUse.id).where(PowerUse.round_id == rnd.id, PowerUse.participant_id == me.id))
    owned = db.scalar(select(ParticipantPower).where(
        ParticipantPower.participant_id == me.id, ParticipantPower.power_type == power_type,
        ParticipantPower.used_ms.is_(None)))
    if already is not None or owned is None:  # un solo poder por ronda
        raise ApiError(409, "POWER_NOT_AVAILABLE")
    owned.used_ms = now_ms()
    removed: list[int] = []
    if power_type == "HINT":  # D6: quita 2 opciones incorrectas
        wrong = [o.id for o in rnd.question.options if not o.is_correct]
        removed = random.sample(wrong, 2)
    db.add(PowerUse(round_id=rnd.id, participant_id=me.id, power_type=power_type, used_ms=now_ms(),
                    removed_option_ids=removed))
    game.version += 1
    db.commit()
    effect = {"removedOptionIds": [fmt("o", i) for i in removed]} if power_type == "HINT" else {}
    return {"powerType": power_type, "effect": effect}


# ── lecturas ────────────────────────────────────────────────────────────────
def _history(rounds: list[Round], game: Game) -> list[list[int]]:
    return [game.initial_order] + [r.ranking_after for r in rounds if r.closed]


def ranking_entries(members: list[Participant], history: list[list[int]], with_delta: bool) -> list[dict]:
    by_id = {p.id: p for p in members}
    after = len(history) - 1
    current = history[after]
    previous = history[max(after - 1, 0)]
    return [
        {"position": i + 1, "participantId": fmt("pt", pid), "nickname": by_id[pid].nickname,
         "score": by_id[pid].score, "positionDelta": (previous.index(pid) - i) if with_delta else 0}
        for i, pid in enumerate(current)
    ]


def _question_view(rnd: Round, phase: str, removed: list[int]) -> dict | None:
    q = rnd.question
    by_id = {o.id: o for o in q.options}
    base = {"id": fmt("q", q.id), "text": q.text, "categoryId": fmt("c", q.category_id), "difficulty": q.difficulty}
    if phase == "QUESTION":
        return {**base, "options": [{"id": fmt("o", i), "text": by_id[i].text} for i in rnd.option_order if i not in removed]}
    if phase == "REVEAL":
        return {**base, "options": [{"id": fmt("o", i), "text": by_id[i].text, "isCorrect": by_id[i].is_correct}
                                    for i in rnd.option_order]}
    return None


def build_state(db: Session, game: Game, me: Participant) -> dict:
    members = members_of(db, game)
    rounds = rounds_of(db, game)
    phase = game.phase
    is_final = phase == "FINAL"
    rnd = rounds[game.round_index]
    answered_ids = set()
    outcomes: dict[int, RoundOutcome] = {}
    use = None
    if not is_final:
        if phase in ANSWER_PHASES:
            answered_ids = set(db.scalars(select(SubmittedAnswer.participant_id).where(SubmittedAnswer.round_id == rnd.id)))
        if phase in RESULT_PHASES:
            outcomes = {o.participant_id: o for o in db.scalars(select(RoundOutcome).where(RoundOutcome.round_id == rnd.id))}
        use = db.scalar(select(PowerUse).where(PowerUse.round_id == rnd.id, PowerUse.participant_id == me.id))
    inventory = [pw for pw in POWER_TYPES if db.scalar(select(ParticipantPower.id).where(
        ParticipantPower.participant_id == me.id, ParticipantPower.power_type == pw,
        ParticipantPower.used_ms.is_(None))) is not None]
    removed = list(use.removed_option_ids) if use and use.power_type == "HINT" else []
    my_outcome = outcomes.get(me.id)
    history = _history(rounds, game)
    order = standings(members)
    return {
        "version": game.version,
        "phase": phase,
        "serverTime": iso(now_ms()),
        "round": None if is_final else {
            "number": rnd.number,
            "totalRounds": len(rounds),
            "type": rnd.type,
            "endsAt": iso(game.phase_end_ms),
            "question": _question_view(rnd, phase, removed),
        },
        "me": {
            "participantId": fmt("pt", me.id),
            "score": me.score,
            "lives": me.lives,
            "status": me.status,
            "hasAnswered": me.id in answered_ids,
            "powers": [{"powerType": pw} for pw in inventory],
            "activePower": use.power_type if use else None,
            "lastResult": my_outcome.last_result if my_outcome else None,
        },
        "players": [
            {
                "participantId": fmt("pt", p.id),
                "nickname": p.nickname,
                "score": p.score,
                "lives": p.lives,
                "status": p.status,
                "isHost": p.is_host,
                "hasAnswered": p.id in answered_ids,
                "pointsThisRound": (outcomes[p.id].last_result["pointsAwarded"]
                                    if phase == "REVEAL" and p.id in outcomes and outcomes[p.id].last_result else None),
            }
            for p in members
        ],
        "ranking": ranking_entries(members, history, True) if phase == "SCOREBOARD"
        else ranking_entries(members, history, False) if is_final else None,
        "winner": {"participantId": fmt("pt", order[0].id), "nickname": order[0].nickname, "score": order[0].score}
        if is_final else None,
    }


def read_state(db: Session, player, raw_game_id: str, if_none_match: str | None) -> tuple[Game, dict | None]:
    """Devuelve (partida, estado). estado=None → 304 (camino barato: no arma el cuerpo)."""
    game = get_game(db, raw_game_id)
    me = member_for(db, game, player)
    tick(db, game)
    if if_none_match and etag_of(game) in [t.strip().removeprefix("W/") for t in if_none_match.split(",")]:
        return game, None
    return game, build_state(db, game, me)


def etag_of(game: Game) -> str:
    return f'"{fmt("g", game.id)}-v{game.version}"'


def ranking(db: Session, player, raw_game_id: str) -> dict:
    game = get_game(db, raw_game_id)
    member_for(db, game, player)
    tick(db, game)
    history = _history(rounds_of(db, game), game)
    return {"gameId": fmt("g", game.id), "afterRound": len(history) - 1,
            "items": ranking_entries(members_of(db, game), history, True)}


def round_results(db: Session, player, raw_game_id: str, number: int) -> dict:
    game = get_game(db, raw_game_id)
    member_for(db, game, player)
    tick(db, game)
    rnd = db.scalar(select(Round).where(Round.game_id == game.id, Round.number == number))
    if rnd is None or not rnd.closed:
        raise ApiError(409, "ROUND_NOT_FINISHED")
    members = {p.id: p for p in members_of(db, game)}
    entries = []
    for o in db.scalars(select(RoundOutcome).where(RoundOutcome.round_id == rnd.id).order_by(RoundOutcome.participant_id)):
        r = o.last_result
        entries.append({
            "participantId": fmt("pt", o.participant_id), "nickname": members[o.participant_id].nickname,
            "chosenOptionId": r["chosenOptionId"] if r else None, "isCorrect": r["isCorrect"] if r else False,
            "answerTimeMs": r["answerTimeMs"] if r else None, "pointsAwarded": r["pointsAwarded"] if r else 0,
            "livesLost": r["livesLost"] if r else 0,
        })
    entries.sort(key=lambda e: -e["pointsAwarded"])
    correct = next(o.id for o in rnd.question.options if o.is_correct)
    return {"gameId": fmt("g", game.id),
            "round": {"number": rnd.number, "type": rnd.type,
                      "question": {"id": fmt("q", rnd.question_id), "text": rnd.question.text,
                                   "correctOptionId": fmt("o", correct)}},
            "results": entries}


def results(db: Session, player, raw_game_id: str) -> dict:
    game = get_game(db, raw_game_id)
    member_for(db, game, player)
    tick(db, game)
    if game.phase != "FINAL":
        raise ApiError(409, "GAME_NOT_FINISHED")
    members = members_of(db, game)
    order = standings(members)
    rounds = rounds_of(db, game)
    round_ids = [r.id for r in rounds]
    answers = list(db.scalars(select(SubmittedAnswer).where(SubmittedAnswer.round_id.in_(round_ids))))
    outcomes = list(db.scalars(select(RoundOutcome).where(RoundOutcome.round_id.in_(round_ids))))
    number_of = {r.id: r.number for r in rounds}
    stats = []
    for p in order:
        mine = [a for a in answers if a.participant_id == p.id]
        results_ = [(number_of[o.round_id], o.last_result) for o in outcomes if o.participant_id == p.id and o.last_result]
        times = [a.answer_time_ms for a in mine]
        best = max(sorted(results_), key=lambda x: x[1]["pointsAwarded"], default=None)
        stats.append({
            "participantId": fmt("pt", p.id), "nickname": p.nickname,
            "correctAnswers": sum(1 for _, r in results_ if r["isCorrect"]),
            "totalAnswers": len(mine),  # solo rondas respondidas (los timeouts no cuentan)
            "averageAnswerTimeMs": round(sum(times) / len(times)) if times else 0,
            "fastestAnswerMs": min(times) if times else 0,
            "bestRound": {"number": best[0], "points": best[1]["pointsAwarded"]} if best else {"number": 0, "points": 0},
        })
    room = db.get(Room, game.room_id)
    return {
        "gameId": fmt("g", game.id), "roomCode": room.code, "totalRounds": len(rounds),
        "winner": {"participantId": fmt("pt", order[0].id), "nickname": order[0].nickname, "score": order[0].score},
        "ranking": [{"position": i + 1, "participantId": fmt("pt", p.id), "nickname": p.nickname, "score": p.score}
                    for i, p in enumerate(order)],
        "stats": stats,
    }
