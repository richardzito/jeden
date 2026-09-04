"""End-to-end test of a LEARN voice session against pre-seeded concepts +
lesson plan beats (as the research pipeline would have produced them),
with the Anthropic API mocked. Covers the happy path, the "no answer from
the learner" edge case (spec section 11 explicitly calls this out for
Tutor), and the escalation ladder triggering on a wrong answer."""

import uuid

import pytest
from sqlalchemy import select

from app.integrations.anthropic_client import AnthropicClient
from app.models.models import (
    BeatType,
    Concept,
    ConceptImportance,
    CurriculumItem,
    LessonPlanBeat,
    SessionType,
    Topic,
    TopicStatus,
    User,
    UserConceptMastery,
)
from app.services.session_service import SessionNotAwaitingAnswerError, SessionService
from tests.unit._llm_mocks import mock_structured_calls


async def _seed_topic_with_one_concept(db_session):
    user = User(id=uuid.uuid4(), email=f"{uuid.uuid4()}@test.local", locale="pl")
    db_session.add(user)
    topic = Topic(user_id=user.id, title="Popyt i podaż", raw_query="q", status=TopicStatus.ready)
    db_session.add(topic)
    await db_session.commit()
    await db_session.refresh(topic)

    concept = Concept(
        topic_id=topic.id,
        name="Popyt",
        definition="Ilość dobra, jaką kupujący chcą nabyć przy danej cenie.",
        importance=ConceptImportance.core,
    )
    db_session.add(concept)
    await db_session.commit()
    await db_session.refresh(concept)

    db_session.add(CurriculumItem(topic_id=topic.id, concept_id=concept.id, order_index=0, rationale="Podstawa"))

    beats = [
        (0, BeatType.explain, {"text": "Popyt to ilość dobra, jaką ludzie chcą kupić."}),
        (1, BeatType.question, {"question_type": "predict", "text": "Co stanie się z popytem, gdy cena wzrośnie?"}),
        (
            2,
            BeatType.expected_answer_rubric,
            {"key_points": ["Popyt spada"], "min_points_for_pass": 1, "sample_good_answer": "Popyt zwykle spada."},
        ),
        (
            3,
            BeatType.follow_up,
            {"if_correct": "Świetnie!", "if_partial": "Blisko!", "if_incorrect": "Spróbujmy inaczej."},
        ),
        (4, BeatType.transition, {"text": "To już wszystko na dziś."}),
    ]
    for order_index, beat_type, content in beats:
        db_session.add(LessonPlanBeat(concept_id=concept.id, order_index=order_index, beat_type=beat_type, content=content))
    await db_session.commit()

    return user, topic, concept


@pytest.mark.asyncio
async def test_learn_session_happy_path(db_session):
    user, topic, concept = await _seed_topic_with_one_concept(db_session)
    client = AnthropicClient(db=db_session)
    service = SessionService(db_session, client)

    session_row, turns = await service.start_session(user, topic.id, SessionType.learn)
    assert [t.turn_type.value for t in turns] == ["explain", "question"]
    assert not turns[-1].session_complete

    mock_structured_calls(
        client,
        [
            {
                "key_points_hit": ["Popyt spada"],
                "key_points_missed": [],
                "correctness": 0.95,
                "llm_confidence": 0.9,
                "misconception": None,
                "feedback_text": "Dokładnie tak!",
            }
        ],
    )
    turns = await service.submit_answer(session_row, "Popyt powinien spaść, gdy cena rośnie.")
    turn_types = [t.turn_type.value for t in turns]
    assert "feedback" in turn_types
    assert turns[-1].session_complete is True

    await db_session.refresh(session_row)
    assert session_row.ended_at is not None

    mastery_result = await db_session.execute(
        select(UserConceptMastery).where(UserConceptMastery.user_id == user.id, UserConceptMastery.concept_id == concept.id)
    )
    mastery_row = mastery_result.scalar_one()
    assert mastery_row.exposure_count == 1
    assert mastery_row.mastery > 0
    assert mastery_row.next_review_at is not None


@pytest.mark.asyncio
async def test_learn_session_no_answer_from_user_asks_to_repeat_without_llm_call(db_session):
    user, topic, concept = await _seed_topic_with_one_concept(db_session)
    client = AnthropicClient(db=db_session)
    service = SessionService(db_session, client)

    session_row, _turns = await service.start_session(user, topic.id, SessionType.learn)
    client._client.messages.create = None  # would raise if evaluate_answer tried to call it

    turns = await service.submit_answer(session_row, "")
    assert len(turns) == 1
    assert turns[0].turn_type.value == "checkin"
    assert turns[0].session_complete is False

    # The session should still be awaiting the same question -- answering
    # again (this time for real) should work, not raise.
    mock_structured_calls(
        client,
        [
            {
                "key_points_hit": [],
                "key_points_missed": ["Popyt spada"],
                "correctness": 0.2,
                "llm_confidence": 0.9,
                "misconception": "Myśli, że popyt zawsze rośnie",
                "feedback_text": "To nie do końca tak.",
            },
            {"text": "Pomyśl o tym tak: gdy coś drożeje, zwykle chcemy tego mniej."},
        ],
    )
    turns = await service.submit_answer(session_row, "Popyt zawsze rośnie")
    assert turns[0].turn_type.value == "explain"  # escalation explanation
    assert turns[1].turn_type.value == "question"  # re-asked


@pytest.mark.asyncio
async def test_submit_answer_raises_when_not_awaiting_answer(db_session):
    user, topic, concept = await _seed_topic_with_one_concept(db_session)
    client = AnthropicClient(db=db_session)
    service = SessionService(db_session, client)
    session_row, _turns = await service.start_session(user, topic.id, SessionType.learn)

    mock_structured_calls(
        client,
        [
            {
                "key_points_hit": ["Popyt spada"],
                "key_points_missed": [],
                "correctness": 1.0,
                "llm_confidence": 1.0,
                "misconception": None,
                "feedback_text": "Super!",
            }
        ],
    )
    await service.submit_answer(session_row, "Popyt spada, gdy cena rośnie.")

    with pytest.raises(SessionNotAwaitingAnswerError):
        await service.submit_answer(session_row, "cokolwiek")
