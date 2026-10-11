"""Seed idempotente de categorías y preguntas. Uso: python -m app.seed"""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Category, Option, Question
from app.seed_data import CATEGORIES, QUESTIONS


def seed(db: Session) -> None:
    for name in CATEGORIES:
        if db.scalar(select(Category.id).where(Category.name == name)) is None:
            db.add(Category(name=name))
    db.flush()
    ids = {c.name: c.id for c in db.scalars(select(Category))}
    for cat, difficulty, text, correct, wrong in QUESTIONS:
        category_id = ids[CATEGORIES[cat - 1]]
        if db.scalar(select(Question.id).where(Question.text == text, Question.category_id == category_id)):
            continue
        options = [Option(text=correct, is_correct=True)] + [Option(text=w, is_correct=False) for w in wrong]
        db.add(Question(text=text, category_id=category_id, difficulty=difficulty, options=options))
    db.commit()


def seed_if_empty() -> None:
    from app.db import SessionLocal

    with SessionLocal() as db:
        if not db.scalar(select(func.count(Question.id))):
            seed(db)


if __name__ == "__main__":
    from app.db import SessionLocal

    with SessionLocal() as session:
        seed(session)
        print("Seed listo:", session.scalar(select(func.count(Question.id))), "preguntas")
