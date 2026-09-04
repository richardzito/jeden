"""Seeds one ready-to-use topic (with a concept + a full Lesson Plan) for a
fixed dev user, bypassing the async research pipeline.

Used by:
- Local manual exploration of the frontend without spending on/waiting for
  real research (`python scripts/seed_demo_topic.py`).
- The Playwright e2e suite (frontend/e2e/global-setup.ts), so the
  "curriculum -> session" happy path is deterministic and doesn't depend
  on live LLM calls / real API keys being configured in the test
  environment. See frontend/e2e/happy-path.spec.ts for the companion test
  that *does* drive real topic creation through the UI (covering "wpisz
  temat" without depending on the research pipeline completing).

Run with the backend's venv active and DATABASE_URL pointed at the target
Postgres instance.
"""

import asyncio
import uuid

from sqlalchemy import delete, select

from app.core.db import async_session_factory
from app.models.models import (
    BeatType,
    Concept,
    ConceptImportance,
    CurriculumItem,
    LessonPlanBeat,
    Question,
    Topic,
    TopicStatus,
    User,
)

DEV_USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")


async def seed() -> tuple[str, str]:
    async with async_session_factory() as db:
        user = await db.get(User, DEV_USER_ID)
        if user is None:
            user = User(id=DEV_USER_ID, email="dev-11111111@local.test", locale="pl")
            db.add(user)
            await db.commit()

        # Idempotent: wipe this demo user's previous topics first (cascades
        # to concepts/curriculum/beats/questions via FK ondelete=CASCADE)
        # so re-running the seed doesn't pile up duplicate topics with the
        # same title -- which would break e2e selectors like
        # `getByText("Jak działa fotosynteza?")`.
        existing_ids = (await db.execute(select(Topic.id).where(Topic.user_id == DEV_USER_ID))).scalars().all()
        if existing_ids:
            await db.execute(delete(Topic).where(Topic.id.in_(existing_ids)))
            await db.commit()

        topic = Topic(
            user_id=DEV_USER_ID,
            title="Jak działa fotosynteza?",
            raw_query="Jak działa fotosynteza?",
            status=TopicStatus.ready,
        )
        db.add(topic)
        await db.commit()
        await db.refresh(topic)

        concept = Concept(
            topic_id=topic.id,
            name="Fotosynteza",
            definition="Proces, w którym rośliny zamieniają światło słoneczne w energię chemiczną.",
            importance=ConceptImportance.core,
            examples=["Liście drzew zielenieją dzięki chlorofilowi"],
            counterexamples=[],
            misconceptions=["Fotosynteza zachodzi tylko w dzień"],
            applications=["Produkcja tlenu w atmosferze"],
        )
        db.add(concept)
        await db.commit()
        await db.refresh(concept)

        db.add(
            CurriculumItem(
                topic_id=topic.id, concept_id=concept.id, order_index=0, rationale="Podstawa tematu"
            )
        )

        question_text = "Dlaczego rośliny potrzebują światła słonecznego?"
        beats = [
            (0, BeatType.explain, {"text": "Fotosynteza to proces, w którym rośliny zamieniają światło w energię."}),
            (1, BeatType.question, {"question_type": "why", "text": question_text}),
            (
                2,
                BeatType.expected_answer_rubric,
                {
                    "key_points": ["Do produkcji energii/glukozy"],
                    "min_points_for_pass": 1,
                    "sample_good_answer": "Potrzebują go do produkcji energii.",
                },
            ),
            (
                3,
                BeatType.follow_up,
                {
                    "if_correct": "Dokładnie tak!",
                    "if_partial": "Blisko, dopowiedzmy sobie.",
                    "if_incorrect": "Spróbujmy inaczej.",
                },
            ),
            (4, BeatType.transition, {"text": "To by było na tyle na dzisiaj!"}),
        ]
        for order_index, beat_type, content in beats:
            db.add(
                LessonPlanBeat(concept_id=concept.id, order_index=order_index, beat_type=beat_type, content=content)
            )
        db.add(Question(concept_id=concept.id, type="why", text=question_text, difficulty=0.5))
        await db.commit()

        return str(topic.id), str(DEV_USER_ID)


if __name__ == "__main__":
    topic_id, user_id = asyncio.run(seed())
    print(f"TOPIC_ID={topic_id}")
    print(f"USER_ID={user_id}")
