"""End-to-end test of the research pipeline: raw_query -> concepts, with
the search provider and Anthropic API fully mocked (spec section 11:
"co najmniej jeden test integracyjny pipeline'u researchu, od raw_query do
zapisanych concepts, z zamockowanym search/LLM")."""

import uuid
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from app.integrations.anthropic_client import AnthropicClient
from app.integrations.search import FetchedContent, SearchResult
from app.models.models import (
    Concept,
    ConceptSource,
    CurriculumItem,
    LessonPlanBeat,
    Question,
    ResearchRun,
    ResearchRunStatus,
    Topic,
    TopicStatus,
    User,
)
from app.workers.pipeline import run_research_pipeline
from tests.unit._llm_mocks import mock_structured_calls

RESPONSES = [
    # 1. Researcher.decompose
    {
        "subquestions": [
            "Co to jest fotosynteza?",
            "Jak przebiega proces fotosyntezy?",
            "Dlaczego fotosynteza jest wazna dla zycia na Ziemi?",
        ]
    },
    # 2-3. FactChecker.score_source for the two sources under subquestion 1
    {"llm_score": 0.8, "rationale": "Solidne zrodlo edukacyjne.", "suggested_source_type": "docs"},
    {"llm_score": 0.65, "rationale": "Artykul popularnonaukowy.", "suggested_source_type": "reputable_media"},
    # 4. FactChecker.extract_claims for subquestion 1
    {
        "claims": [
            {
                "text": "Fotosynteza zachodzi w chloroplastach roslin",
                "supporting_indices": [0, 1],
                "contradicting_indices": [],
                "suggested_confidence": "established",
            }
        ]
    },
    # 5. Synthesizer.build_concepts
    {
        "concepts": [
            {
                "name": "Fotosynteza",
                "definition": "Proces, w ktorym rosliny zamieniaja swiatlo sloneczne w energie chemiczna.",
                "examples": ["Liscie drzew zielenieja dzieki temu procesowi"],
                "counterexamples": [],
                "misconceptions": ["Fotosynteza zachodzi tylko w liściach"],
                "applications": ["Produkcja tlenu w atmosferze"],
                "source_claim_texts": ["Fotosynteza zachodzi w chloroplastach roslin"],
            },
            {
                "name": "Chlorofil",
                "definition": "Zielony barwnik roslinny pochlaniajacy swiatlo sloneczne.",
                "examples": ["Chlorofil nadaje liściom zielony kolor"],
                "counterexamples": [],
                "misconceptions": [],
                "applications": [],
                "source_claim_texts": [],
            },
        ]
    },
    # 6. KnowledgeArchitect.build_relationships
    {
        "importance_assignments": [
            {"concept_name": "Fotosynteza", "importance": "core"},
            {"concept_name": "Chlorofil", "importance": "secondary"},
        ],
        "relationships": [
            {"from_concept_name": "Chlorofil", "to_concept_name": "Fotosynteza", "type": "prerequisite_of"}
        ],
    },
    # 7. CurriculumDesigner.refine_rationales
    {
        "items": [
            {"concept_name": "Chlorofil", "rationale": "Trzeba go poznac, zanim zrozumiemy fotosynteze."},
            {"concept_name": "Fotosynteza", "rationale": "Glowny temat, bazujacy na chlorofilu."},
        ]
    },
    # 8. CurriculumDesigner.generate_lesson_plan_beats (Chlorofil, first in topo order)
    {
        "beats": [
            {"beat_type": "explain", "text": "Chlorofil to zielony barwnik w komorkach roslin."},
            {
                "beat_type": "question",
                "question": {"question_type": "recall", "text": "Jaki kolor ma chlorofil?"},
            },
            {
                "beat_type": "expected_answer_rubric",
                "rubric": {
                    "key_points": ["Zielony"],
                    "min_points_for_pass": 1,
                    "sample_good_answer": "Chlorofil jest zielony.",
                },
            },
            {
                "beat_type": "follow_up",
                "follow_up_if_correct": "Dokladnie!",
                "follow_up_if_partial": "Blisko, dopowiedzmy.",
                "follow_up_if_incorrect": "Sprobujmy jeszcze raz.",
            },
            {"beat_type": "transition", "text": "Teraz przejdzmy do fotosyntezy."},
        ]
    },
    # 9. CurriculumDesigner.generate_lesson_plan_beats (Fotosynteza)
    {
        "beats": [
            {"beat_type": "explain", "text": "Fotosynteza zamienia swiatlo w energie chemiczna."},
            {
                "beat_type": "question",
                "question": {"question_type": "why", "text": "Dlaczego rosliny potrzebuja swiatla?"},
            },
            {
                "beat_type": "expected_answer_rubric",
                "rubric": {
                    "key_points": ["Do produkcji energii"],
                    "min_points_for_pass": 1,
                    "sample_good_answer": "Potrzebuja swiatla do produkcji energii.",
                },
            },
            {
                "beat_type": "follow_up",
                "follow_up_if_correct": "Super!",
                "follow_up_if_partial": "Prawie, dodajmy szczegol.",
                "follow_up_if_incorrect": "Wyjasnijmy to inaczej.",
            },
            {"beat_type": "transition", "text": "To by bylo na tyle na dzis."},
        ]
    },
]


@pytest.mark.asyncio
async def test_full_pipeline_from_raw_query_to_concepts(db_session):
    user = User(id=uuid.uuid4(), email=f"{uuid.uuid4()}@test.local", locale="pl")
    db_session.add(user)
    await db_session.commit()

    topic = Topic(
        user_id=user.id,
        title="Fotosynteza",
        raw_query="Jak dziala fotosynteza?",
        status=TopicStatus.researching,
    )
    db_session.add(topic)
    await db_session.commit()
    await db_session.refresh(topic)

    client = AnthropicClient(db=db_session)
    mock_structured_calls(client, RESPONSES)

    search_provider = AsyncMock()
    search_provider.search.side_effect = [
        [
            SearchResult(url="https://bio.example.edu/photosynthesis", title="Photosynthesis basics"),
            SearchResult(url="https://science.example.com/article", title="How plants make food"),
        ],
        [],
        [],
    ]
    search_provider.fetch.side_effect = [
        FetchedContent(
            url="https://bio.example.edu/photosynthesis",
            title="Photosynthesis basics",
            text="Fotosynteza zachodzi w chloroplastach roslin i wymaga swiatla slonecznego.",
            content_hash="hash-1",
        ),
        FetchedContent(
            url="https://science.example.com/article",
            title="How plants make food",
            text="Rosliny wykorzystuja chlorofil do produkcji energii ze swiatla.",
            content_hash="hash-2",
        ),
    ]

    await run_research_pipeline(topic.id, db_session, anthropic_client=client, search_provider=search_provider)

    await db_session.refresh(topic)
    assert topic.status == TopicStatus.ready

    research_run = (
        (await db_session.execute(select(ResearchRun).where(ResearchRun.topic_id == topic.id)))
        .scalars()
        .first()
    )
    assert research_run.status == ResearchRunStatus.done
    assert research_run.completed_at is not None

    concepts = (await db_session.execute(select(Concept).where(Concept.topic_id == topic.id))).scalars().all()
    assert {c.name for c in concepts} == {"Fotosynteza", "Chlorofil"}
    fotosynteza = next(c for c in concepts if c.name == "Fotosynteza")
    assert fotosynteza.importance.value == "core"
    assert "chloroplast" in fotosynteza.definition.lower() or fotosynteza.definition

    curriculum_items = (
        (await db_session.execute(select(CurriculumItem).where(CurriculumItem.topic_id == topic.id)))
        .scalars()
        .all()
    )
    assert len(curriculum_items) == 2
    ordered = sorted(curriculum_items, key=lambda ci: ci.order_index)
    concept_by_id = {c.id: c for c in concepts}
    # Chlorofil is a prerequisite_of Fotosynteza, so it must come first.
    assert concept_by_id[ordered[0].concept_id].name == "Chlorofil"
    assert concept_by_id[ordered[1].concept_id].name == "Fotosynteza"

    concept_ids = {c.id for c in concepts}
    beats = (await db_session.execute(select(LessonPlanBeat))).scalars().all()
    beats_for_topic = [b for b in beats if b.concept_id in concept_ids]
    assert len(beats_for_topic) == 10  # 5 beats x 2 concepts
    explain_beats = [b for b in beats_for_topic if b.beat_type.value == "explain"]
    assert len(explain_beats) == 2

    questions = (await db_session.execute(select(Question))).scalars().all()
    assert len([q for q in questions if q.concept_id in concept_ids]) == 2

    concept_sources = (
        (await db_session.execute(select(ConceptSource).where(ConceptSource.concept_id == fotosynteza.id)))
        .scalars()
        .all()
    )
    assert len(concept_sources) == 2  # both sources supported the claim linked to Fotosynteza
