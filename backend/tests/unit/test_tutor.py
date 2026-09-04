import pytest

from app.agents.tutor import EscalationRung, Tutor, next_escalation_rung
from app.integrations.anthropic_client import AnthropicClient
from app.models.models import TurnType
from tests.unit._llm_mocks import mock_structured_calls


def test_escalation_ladder_progresses_in_order():
    assert next_escalation_rung(None) == EscalationRung.simpler_explanation
    assert next_escalation_rung(EscalationRung.simpler_explanation) == EscalationRung.analogy
    assert next_escalation_rung(EscalationRung.analogy) == EscalationRung.example
    assert next_escalation_rung(EscalationRung.example) == EscalationRung.counterexample
    assert next_escalation_rung(EscalationRung.counterexample) == EscalationRung.diagnostic_question
    assert next_escalation_rung(EscalationRung.diagnostic_question) == EscalationRung.exhausted


def test_escalation_ladder_stays_exhausted():
    assert next_escalation_rung(EscalationRung.exhausted) == EscalationRung.exhausted


def test_render_beat_explain_applies_length_limit(db_session):
    client = AnthropicClient(db=db_session)
    tutor = Tutor(client)
    long_text = " ".join(f"Zdanie numer {i}." for i in range(20))
    turn_type, text = tutor.render_beat("explain", {"text": long_text})
    assert turn_type == TurnType.explain
    assert len(text) <= tutor._settings.tutor_max_chars + 1
    assert text.count(".") + text.count("!") + text.count("?") <= tutor._settings.tutor_max_sentences + 1


def test_render_beat_question(db_session):
    client = AnthropicClient(db=db_session)
    tutor = Tutor(client)
    turn_type, text = tutor.render_beat("question", {"text": "Co to jest popyt?"})
    assert turn_type == TurnType.question
    assert text == "Co to jest popyt?"


def test_render_beat_rubric_is_not_spoken(db_session):
    client = AnthropicClient(db=db_session)
    tutor = Tutor(client)
    turn_type, text = tutor.render_beat("expected_answer_rubric", {"key_points": ["a"]})
    assert turn_type == TurnType.checkin
    assert text == ""


@pytest.mark.asyncio
async def test_generate_escalation_text_is_length_limited(db_session):
    client = AnthropicClient(db=db_session)
    long_text = " ".join(f"To jest zdanie {i} w bardzo długim wyjaśnieniu." for i in range(15))
    mock_structured_calls(client, [{"text": long_text}])
    tutor = Tutor(client)

    result = await tutor.generate_escalation_text("Popyt", "Ilość dobra kupowana", EscalationRung.analogy)
    assert len(result) <= tutor._settings.tutor_max_chars + 1


@pytest.mark.asyncio
async def test_generate_escalation_text_rejects_exhausted_rung(db_session):
    client = AnthropicClient(db=db_session)
    tutor = Tutor(client)
    with pytest.raises(ValueError):
        await tutor.generate_escalation_text("Popyt", "def", EscalationRung.exhausted)
