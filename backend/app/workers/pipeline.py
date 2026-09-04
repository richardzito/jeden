"""The async research pipeline: raw_query -> subquestions -> sources ->
claims -> concepts -> relationships -> curriculum -> initial lesson plan.

This module is the orchestrator described in spec section 6. It is called
from the arq worker (app/workers/research_worker.py) and, directly, from
the integration test -- `anthropic_client` / `search_provider` are
injectable so tests can swap in mocks without touching arq or real network
calls. It never runs on the live-session request path (section 4).
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.credibility import guess_source_type, hash_query, normalize_query
from app.agents.curriculum_designer import ConceptNode, CurriculumDesigner, RelationshipEdge
from app.agents.fact_checker import FactChecker, ScoredSource, SourceMeta
from app.agents.knowledge_architect import KnowledgeArchitect
from app.agents.researcher import Researcher
from app.agents.synthesizer import Synthesizer
from app.core.config import get_settings
from app.core.logging import get_logger
from app.integrations.anthropic_client import AnthropicClient
from app.integrations.exceptions import ExternalServiceError
from app.integrations.search import SearchProvider, get_search_provider
from app.models.models import (
    Claim,
    Concept,
    ConceptRelationship,
    ConceptSource,
    CurriculumItem,
    LessonPlanBeat,
    Question,
    ResearchCache,
    ResearchRun,
    ResearchRunStatus,
    Source,
    Subquestion,
    Topic,
    TopicStatus,
    User,
    UserConceptMastery,
)

logger = get_logger(__name__)

LESSON_PLAN_PREFETCH_COUNT = 5


async def run_research_pipeline(
    topic_id: uuid.UUID,
    db: AsyncSession,
    *,
    anthropic_client: AnthropicClient | None = None,
    search_provider: SearchProvider | None = None,
) -> None:
    settings = get_settings()
    topic = await db.get(Topic, topic_id)
    if topic is None:
        logger.error("research_pipeline_topic_not_found", topic_id=str(topic_id))
        return
    user = await db.get(User, topic.user_id)
    locale = user.locale if user else settings.default_locale

    client = anthropic_client or AnthropicClient(db=db)
    search = search_provider or get_search_provider()

    research_run = ResearchRun(topic_id=topic.id, status=ResearchRunStatus.running, started_at=_now())
    db.add(research_run)
    await db.commit()
    await db.refresh(research_run)

    try:
        query_hash = hash_query(normalize_query(topic.raw_query))
        cache_hit = await _try_reuse_cached_synthesis(db, topic, query_hash)
        if not cache_hit:
            await _run_full_research(db, topic, research_run, client, search, locale, query_hash)
        await _run_curriculum_stage(db, topic, client, locale)

        topic.status = TopicStatus.ready
        research_run.status = ResearchRunStatus.done
        research_run.completed_at = _now()
        await db.commit()
    except Exception as exc:  # noqa: BLE001 - pipeline boundary, must never crash the worker silently
        await db.rollback()
        research_run.status = ResearchRunStatus.failed
        research_run.error_message = str(exc)[:2000]
        research_run.completed_at = _now()
        db.add(research_run)
        await db.commit()
        logger.error("research_pipeline_failed", topic_id=str(topic_id), error=str(exc))
        raise


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _get_or_create_source(db: AsyncSession, url: str) -> Source | None:
    result = await db.execute(select(Source).where(Source.url == url))
    return result.scalar_one_or_none()


async def _run_full_research(
    db: AsyncSession,
    topic: Topic,
    research_run: ResearchRun,
    client: AnthropicClient,
    search: SearchProvider,
    locale: str,
    query_hash: str,
) -> None:
    settings = get_settings()
    researcher = Researcher(client, search)
    fact_checker = FactChecker(client)

    subquestions = await researcher.decompose(topic.raw_query, locale, topic_id=topic.id)
    all_claims: list[Claim] = []

    for priority, subq_text in enumerate(subquestions):
        subq = Subquestion(research_run_id=research_run.id, text=subq_text, priority=priority)
        db.add(subq)
        await db.commit()

        candidates = await researcher.search_and_select(subq_text, topic_id=topic.id)
        scored_sources: list[tuple[str, ScoredSource, Source]] = []

        for candidate in candidates:
            existing = await _get_or_create_source(db, candidate.url)
            if existing is not None:
                scored = ScoredSource(
                    url=existing.url,
                    author=existing.author,
                    publisher=existing.publisher,
                    published_at=existing.published_at,
                    source_type=existing.source_type,
                    credibility_score=existing.credibility_score or 0.0,
                    credibility_rationale=existing.credibility_rationale or "",
                )
                scored_sources.append((existing.extracted_summary or "", scored, existing))
                continue

            try:
                fetched = await researcher.fetch(candidate.url)
            except ExternalServiceError as exc:
                logger.warning("source_fetch_failed", url=candidate.url, error=str(exc))
                continue

            meta = SourceMeta(
                url=candidate.url,
                author=None,
                publisher=None,
                published_at=None,
                source_type=guess_source_type(candidate.url),
                title=candidate.title or fetched.title or "",
                snippet=candidate.snippet,
            )
            try:
                scored = await fact_checker.score_source(meta, topic_id=topic.id)
            except ExternalServiceError as exc:
                logger.warning("source_scoring_failed", url=candidate.url, error=str(exc))
                continue

            source_row = Source(
                url=candidate.url,
                title=meta.title,
                source_type=scored.source_type,
                credibility_score=scored.credibility_score,
                credibility_rationale=scored.credibility_rationale,
                fetched_at=_now(),
                content_hash=fetched.content_hash,
                extracted_summary=fetched.text[:5000],
            )
            db.add(source_row)
            await db.commit()
            await db.refresh(source_row)
            scored_sources.append((fetched.text, scored, source_row))

        if not scored_sources:
            continue

        try:
            extracted = await fact_checker.extract_claims(
                subq_text,
                [(text, scored) for text, scored, _ in scored_sources],
                locale,
                topic_id=topic.id,
            )
        except ExternalServiceError as exc:
            logger.warning("claim_extraction_failed", subquestion=subq_text, error=str(exc))
            continue

        for extracted_claim in extracted:
            supporting_ids = [
                scored_sources[i][2].id for i in extracted_claim.supporting_indices if 0 <= i < len(scored_sources)
            ]
            contradicting_ids = [
                scored_sources[i][2].id
                for i in extracted_claim.contradicting_indices
                if 0 <= i < len(scored_sources)
            ]
            claim_row = Claim(
                topic_id=topic.id,
                subquestion_id=subq.id,
                text=extracted_claim.text,
                confidence=extracted_claim.suggested_confidence,
                supporting_source_ids=supporting_ids,
                contradicting_source_ids=contradicting_ids,
            )
            db.add(claim_row)
            all_claims.append(claim_row)

    await db.commit()

    if not all_claims:
        logger.warning("research_pipeline_no_claims", topic_id=str(topic.id))
        return

    synthesizer = Synthesizer(client)
    concept_draft_list = await synthesizer.build_concepts(
        topic.title, [c.text for c in all_claims], locale, topic_id=topic.id
    )

    concept_rows: list[Concept] = []
    for draft in concept_draft_list.concepts:
        concept_row = Concept(
            topic_id=topic.id,
            name=draft.name,
            definition=draft.definition,
            examples=draft.examples,
            counterexamples=draft.counterexamples,
            misconceptions=draft.misconceptions,
            applications=draft.applications,
        )
        db.add(concept_row)
        concept_rows.append(concept_row)
    await db.commit()
    for c in concept_rows:
        await db.refresh(c)

    claims_by_text = {c.text: c for c in all_claims}
    for draft, concept_row in zip(concept_draft_list.concepts, concept_rows, strict=False):
        linked_source_ids: set[uuid.UUID] = set()
        for claim_text in draft.source_claim_texts:
            matched = claims_by_text.get(claim_text)
            if matched is None:
                continue
            linked_source_ids.update(matched.supporting_source_ids)
        for source_id in linked_source_ids:
            db.add(ConceptSource(concept_id=concept_row.id, source_id=source_id))
    await db.commit()

    if concept_rows:
        architect = KnowledgeArchitect(client)
        arch_output = await architect.build_relationships(
            [(c.name, c.definition) for c in concept_rows], topic_id=topic.id
        )
        by_name = {c.name: c for c in concept_rows}
        for assignment in arch_output.importance_assignments:
            concept = by_name.get(assignment.concept_name)
            if concept:
                concept.importance = assignment.importance
        for rel in arch_output.relationships:
            from_c = by_name.get(rel.from_concept_name)
            to_c = by_name.get(rel.to_concept_name)
            if from_c and to_c and from_c.id != to_c.id:
                db.add(ConceptRelationship(from_concept_id=from_c.id, to_concept_id=to_c.id, type=rel.type))
        await db.commit()

    await _write_research_cache(db, query_hash, concept_rows, topic.id, settings.research_cache_ttl_days)


async def _write_research_cache(
    db: AsyncSession, query_hash: str, concept_rows: list[Concept], topic_id: uuid.UUID, ttl_days: int
) -> None:
    relationships_result = await db.execute(
        select(ConceptRelationship).where(
            ConceptRelationship.from_concept_id.in_([c.id for c in concept_rows])
        )
    )
    relationships = relationships_result.scalars().all()
    id_to_name = {c.id: c.name for c in concept_rows}

    payload = {
        "source_topic_id": str(topic_id),
        "concepts": [
            {
                "name": c.name,
                "definition": c.definition,
                "importance": c.importance.value,
                "examples": c.examples,
                "counterexamples": c.counterexamples,
                "misconceptions": c.misconceptions,
                "applications": c.applications,
            }
            for c in concept_rows
        ],
        "relationships": [
            {
                "from_name": id_to_name.get(r.from_concept_id),
                "to_name": id_to_name.get(r.to_concept_id),
                "type": r.type.value,
            }
            for r in relationships
            if r.from_concept_id in id_to_name and r.to_concept_id in id_to_name
        ],
    }
    existing = await db.execute(select(ResearchCache).where(ResearchCache.query_hash == query_hash))
    row = existing.scalar_one_or_none()
    ttl_expires_at = _now() + timedelta(days=ttl_days)
    if row is None:
        db.add(ResearchCache(query_hash=query_hash, provider="pipeline", response_json=payload, ttl_expires_at=ttl_expires_at))
    else:
        row.response_json = payload
        row.ttl_expires_at = ttl_expires_at
    await db.commit()


async def _try_reuse_cached_synthesis(db: AsyncSession, topic: Topic, query_hash: str) -> bool:
    """Spec section 10: if a near-identical topic was already researched
    recently, skip the expensive search/claim-extraction/synthesis calls
    entirely and just re-materialize concepts+relationships for this topic.
    (Sources fetched during the original run are already deduplicated via
    the global `sources.url` uniqueness regardless of this cache.)
    """
    result = await db.execute(
        select(ResearchCache).where(
            ResearchCache.query_hash == query_hash, ResearchCache.ttl_expires_at > _now()
        )
    )
    cached = result.scalar_one_or_none()
    if cached is None or str(topic.id) == cached.response_json.get("source_topic_id"):
        return False

    name_to_row: dict[str, Concept] = {}
    for c in cached.response_json.get("concepts", []):
        row = Concept(
            topic_id=topic.id,
            name=c["name"],
            definition=c["definition"],
            importance=c["importance"],
            examples=c.get("examples") or [],
            counterexamples=c.get("counterexamples") or [],
            misconceptions=c.get("misconceptions") or [],
            applications=c.get("applications") or [],
        )
        db.add(row)
        name_to_row[c["name"]] = row
    await db.commit()

    for rel in cached.response_json.get("relationships", []):
        from_c = name_to_row.get(rel["from_name"])
        to_c = name_to_row.get(rel["to_name"])
        if from_c and to_c:
            db.add(ConceptRelationship(from_concept_id=from_c.id, to_concept_id=to_c.id, type=rel["type"]))
    await db.commit()

    logger.info("research_cache_hit", topic_id=str(topic.id), query_hash=query_hash)
    return True


async def _run_curriculum_stage(db: AsyncSession, topic: Topic, client: AnthropicClient, locale: str) -> None:
    concepts_result = await db.execute(select(Concept).where(Concept.topic_id == topic.id))
    concepts = concepts_result.scalars().all()
    if not concepts:
        return

    relationships_result = await db.execute(
        select(ConceptRelationship).where(ConceptRelationship.from_concept_id.in_([c.id for c in concepts]))
    )
    relationships = relationships_result.scalars().all()

    mastery_result = await db.execute(
        select(UserConceptMastery).where(
            UserConceptMastery.user_id == topic.user_id,
            UserConceptMastery.concept_id.in_([c.id for c in concepts]),
        )
    )
    mastery_map = {m.concept_id: m.mastery for m in mastery_result.scalars().all()}

    designer = CurriculumDesigner(client)
    concept_nodes = [ConceptNode(id=c.id, name=c.name, definition=c.definition, importance=c.importance) for c in concepts]
    edges = [RelationshipEdge(r.from_concept_id, r.to_concept_id, r.type) for r in relationships]
    entries = designer.build_curriculum(concept_nodes, edges, mastery_map)

    try:
        entries = await designer.refine_rationales(entries, locale, topic_id=topic.id)
    except ExternalServiceError as exc:
        logger.warning("curriculum_rationale_refinement_failed", error=str(exc))

    by_id = {c.id: c for c in concepts}
    for entry in entries:
        db.add(
            CurriculumItem(
                topic_id=topic.id,
                concept_id=entry.concept.id,
                order_index=entry.order_index,
                rationale=entry.rationale,
            )
        )
    await db.commit()

    prefetch_targets = [e for e in entries if not e.already_mastered][:LESSON_PLAN_PREFETCH_COUNT]
    for entry in prefetch_targets:
        await _generate_and_persist_lesson_plan(db, designer, entry.concept, by_id[entry.concept.id], locale, topic.id)


async def _generate_and_persist_lesson_plan(db, designer, concept_node, concept_row, locale, topic_id) -> None:
    try:
        beats = await designer.generate_lesson_plan_beats(concept_node, locale, topic_id=topic_id)
    except ExternalServiceError as exc:
        logger.warning("lesson_plan_generation_failed", concept=concept_node.name, error=str(exc))
        return

    pending_question_type: str | None = None
    for order_index, beat in enumerate(beats):
        content: dict = {}
        if beat.beat_type == "explain" or beat.beat_type == "transition":
            content = {"text": beat.text or ""}
        elif beat.beat_type == "question" and beat.question:
            content = {"question_type": beat.question.question_type, "text": beat.question.text}
            pending_question_type = beat.question.question_type
            db.add(
                Question(
                    concept_id=concept_row.id,
                    type=_safe_question_type(beat.question.question_type),
                    text=beat.question.text,
                    difficulty=0.5,
                )
            )
        elif beat.beat_type == "expected_answer_rubric" and beat.rubric:
            content = {
                "key_points": beat.rubric.key_points,
                "min_points_for_pass": beat.rubric.min_points_for_pass,
                "sample_good_answer": beat.rubric.sample_good_answer,
            }
        elif beat.beat_type == "follow_up":
            content = {
                "if_correct": beat.follow_up_if_correct or "",
                "if_partial": beat.follow_up_if_partial or "",
                "if_incorrect": beat.follow_up_if_incorrect or "",
            }

        db.add(
            LessonPlanBeat(
                concept_id=concept_row.id,
                order_index=order_index,
                beat_type=beat.beat_type,
                content=content,
            )
        )
    await db.commit()


def _safe_question_type(value: str):
    from app.models.models import QuestionType

    try:
        return QuestionType(value)
    except ValueError:
        return QuestionType.explain
