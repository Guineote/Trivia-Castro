from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.ids import fmt, parse
from app.models import Category, Option, Question
from app.schemas import QuestionIn


def list_categories(db: Session) -> dict:
    rows = db.scalars(select(Category).order_by(Category.id))
    return {"items": [{"id": fmt("c", c.id), "name": c.name} for c in rows]}


def question_dict(q: Question) -> dict:
    return {
        "id": fmt("q", q.id), "text": q.text, "categoryId": fmt("c", q.category_id), "difficulty": q.difficulty,
        "options": [{"id": fmt("o", o.id), "text": o.text, "isCorrect": o.is_correct} for o in q.options],
    }


def list_questions(db: Session, category_id: str | None, difficulty: str | None, limit: int, offset: int) -> dict:
    query = select(Question)
    if category_id is not None:
        cid = parse("c", category_id)
        if cid is None:
            raise ApiError(422, "VALIDATION_ERROR")
        query = query.where(Question.category_id == cid)
    if difficulty is not None:
        if difficulty not in ("EASY", "MEDIUM", "HARD"):
            raise ApiError(422, "VALIDATION_ERROR")
        query = query.where(Question.difficulty == difficulty)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(Question.id).limit(limit).offset(offset))
    return {"items": [question_dict(q) for q in rows], "total": total}


def create_question(db: Session, body: QuestionIn) -> dict:
    cid = parse("c", body.category_id)
    if cid is None or db.get(Category, cid) is None:
        raise ApiError(422, "VALIDATION_ERROR")
    q = Question(text=body.text, category_id=cid, difficulty=body.difficulty,
                 options=[Option(text=o.text, is_correct=o.is_correct) for o in body.options])
    db.add(q)
    db.commit()
    return question_dict(q)
