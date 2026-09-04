import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.models import (
    Concept,
    Session as SessionRow,
    Topic,
    User,
    UserConceptMastery,
)
from app.schemas.api import DashboardResponse, DashboardTopicOut, ReviewDueOut

router = APIRouter(prefix="/users", tags=["users"])

MASTERED_THRESHOLD = 0.8


def _check_self(user_id: uuid.UUID, current: User) -> None:
    if user_id != current.id:
        raise HTTPException(status_code=403, detail="Cannot access another user's data")


@router.get("/{user_id}/reviews/due", response_model=list[ReviewDueOut])
async def get_reviews_due(
    user_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ReviewDueOut]:
    _check_self(user_id, user)
    result = await db.execute(
        select(UserConceptMastery, Concept.name)
        .join(Concept, Concept.id == UserConceptMastery.concept_id)
        .where(
            UserConceptMastery.user_id == user_id,
            UserConceptMastery.next_review_at <= datetime.now(timezone.utc),
        )
        .order_by(UserConceptMastery.next_review_at)
    )
    return [
        ReviewDueOut(
            concept_id=mastery.concept_id,
            concept_name=concept_name,
            scheduled_for=mastery.next_review_at,
            mastery=mastery.mastery,
        )
        for mastery, concept_name in result.all()
    ]


@router.get("/{user_id}/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    user_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardResponse:
    _check_self(user_id, user)

    topics_result = await db.execute(select(Topic).where(Topic.user_id == user_id).order_by(Topic.created_at.desc()))
    topics = topics_result.scalars().all()

    topic_outs = []
    for topic in topics:
        concept_count_result = await db.execute(select(func.count(Concept.id)).where(Concept.topic_id == topic.id))
        concept_count = concept_count_result.scalar_one()

        mastered_count = 0
        if concept_count:
            concept_ids_result = await db.execute(select(Concept.id).where(Concept.topic_id == topic.id))
            concept_ids = [row[0] for row in concept_ids_result.all()]
            mastered_result = await db.execute(
                select(func.count(UserConceptMastery.id)).where(
                    UserConceptMastery.user_id == user_id,
                    UserConceptMastery.concept_id.in_(concept_ids),
                    UserConceptMastery.mastery >= MASTERED_THRESHOLD,
                )
            )
            mastered_count = mastered_result.scalar_one()

        topic_outs.append(
            DashboardTopicOut(
                id=topic.id, title=topic.title, status=topic.status, concept_count=concept_count, mastered_count=mastered_count
            )
        )

    due_count_result = await db.execute(
        select(func.count(UserConceptMastery.id)).where(
            UserConceptMastery.user_id == user_id,
            UserConceptMastery.next_review_at <= datetime.now(timezone.utc),
        )
    )
    due_count = due_count_result.scalar_one()

    sessions_result = await db.execute(
        select(SessionRow.id).where(SessionRow.user_id == user_id).order_by(SessionRow.created_at.desc()).limit(10)
    )
    recent_sessions = [row[0] for row in sessions_result.all()]

    return DashboardResponse(topics=topic_outs, due_review_count=due_count, recent_sessions=recent_sessions)
