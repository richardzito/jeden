import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.queue import get_arq_pool
from app.models.models import (
    Claim,
    Concept,
    ConceptSource,
    CurriculumItem,
    ResearchRun,
    Source,
    Topic,
    TopicStatus,
    User,
    UserConceptMastery,
)
from app.schemas.api import ClaimOut, ConceptOut, SourceOut, TopicCreateRequest, TopicCreateResponse, TopicStatusResponse

router = APIRouter(prefix="/topics", tags=["topics"])


def _derive_title(raw_query: str) -> str:
    title = raw_query.strip()
    return title if len(title) <= 120 else title[:117] + "..."


@router.post("", response_model=TopicCreateResponse, status_code=201)
async def create_topic(
    payload: TopicCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TopicCreateResponse:
    topic = Topic(
        user_id=user.id,
        title=_derive_title(payload.raw_query),
        raw_query=payload.raw_query,
        status=TopicStatus.researching,
    )
    db.add(topic)
    await db.commit()
    await db.refresh(topic)

    pool = await get_arq_pool()
    await pool.enqueue_job("run_research_pipeline_task", str(topic.id))

    return TopicCreateResponse(topic_id=topic.id, status=topic.status)


@router.get("/{topic_id}", response_model=TopicStatusResponse)
async def get_topic(
    topic_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TopicStatusResponse:
    topic = await db.get(Topic, topic_id)
    if topic is None or topic.user_id != user.id:
        raise HTTPException(status_code=404, detail="Topic not found")

    run_result = await db.execute(
        select(ResearchRun).where(ResearchRun.topic_id == topic_id).order_by(ResearchRun.created_at.desc())
    )
    latest_run = run_result.scalars().first()

    concepts_result = await db.execute(select(Concept).where(Concept.topic_id == topic_id))
    concepts = concepts_result.scalars().all()

    mastery_by_concept: dict[uuid.UUID, float] = {}
    order_by_concept: dict[uuid.UUID, int] = {}
    if concepts:
        concept_ids = [c.id for c in concepts]
        mastery_result = await db.execute(
            select(UserConceptMastery).where(
                UserConceptMastery.user_id == user.id,
                UserConceptMastery.concept_id.in_(concept_ids),
            )
        )
        mastery_by_concept = {m.concept_id: m.mastery for m in mastery_result.scalars().all()}

        curriculum_result = await db.execute(select(CurriculumItem).where(CurriculumItem.topic_id == topic_id))
        order_by_concept = {ci.concept_id: ci.order_index for ci in curriculum_result.scalars().all()}

    concept_out = [
        ConceptOut(
            id=c.id,
            name=c.name,
            definition=c.definition,
            importance=c.importance,
            examples=c.examples or [],
            counterexamples=c.counterexamples or [],
            misconceptions=c.misconceptions or [],
            applications=c.applications or [],
            mastery=mastery_by_concept.get(c.id, 0.0),
            order_index=order_by_concept.get(c.id),
        )
        for c in concepts
    ]
    concept_out.sort(key=lambda c: (c.order_index is None, c.order_index or 0))

    return TopicStatusResponse(
        id=topic.id,
        title=topic.title,
        raw_query=topic.raw_query,
        status=topic.status,
        research_run_status=latest_run.status if latest_run else None,
        research_run_error=latest_run.error_message if latest_run else None,
        concepts=concept_out,
    )


@router.get("/{topic_id}/sources", response_model=list[SourceOut])
async def get_topic_sources(
    topic_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SourceOut]:
    topic = await db.get(Topic, topic_id)
    if topic is None or topic.user_id != user.id:
        raise HTTPException(status_code=404, detail="Topic not found")

    concept_ids_result = await db.execute(select(Concept.id).where(Concept.topic_id == topic_id))
    concept_ids = [row[0] for row in concept_ids_result.all()]
    if not concept_ids:
        return []

    source_ids_result = await db.execute(
        select(ConceptSource.source_id).where(ConceptSource.concept_id.in_(concept_ids)).distinct()
    )
    source_ids = [row[0] for row in source_ids_result.all()]
    if not source_ids:
        return []

    sources_result = await db.execute(
        select(Source).where(Source.id.in_(source_ids)).order_by(Source.credibility_score.desc().nullslast())
    )
    return list(sources_result.scalars().all())


@router.get("/{topic_id}/claims", response_model=list[ClaimOut])
async def get_topic_claims(
    topic_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ClaimOut]:
    topic = await db.get(Topic, topic_id)
    if topic is None or topic.user_id != user.id:
        raise HTTPException(status_code=404, detail="Topic not found")
    result = await db.execute(select(Claim).where(Claim.topic_id == topic_id))
    return list(result.scalars().all())
