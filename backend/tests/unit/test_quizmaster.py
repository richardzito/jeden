import pytest

from app.agents.quizmaster import Quizmaster, choose_question_type
from app.integrations.anthropic_client import AnthropicClient
from app.models.models import QuestionType
from tests.unit._llm_mocks import mock_structured_calls


def test_choose_question_type_first_exposure_is_definition():
    assert choose_question_type(comprehension=0, recall=0, mastery=0, exposure_count=0) == QuestionType.definition


def test_choose_question_type_low_recall_prioritizes_recall_practice():
    assert choose_question_type(comprehension=0.8, recall=0.3, mastery=0.5, exposure_count=3) == QuestionType.recall


def test_choose_question_type_high_comprehension_low_mastery_stretches_to_apply():
    assert choose_question_type(comprehension=0.8, recall=0.8, mastery=0.5, exposure_count=3) == QuestionType.apply


def test_choose_question_type_high_mastery_uses_transfer():
    assert choose_question_type(comprehension=0.9, recall=0.9, mastery=0.85, exposure_count=5) == QuestionType.transfer


@pytest.mark.asyncio
async def test_generate_question_happy_path(db_session):
    client = AnthropicClient(db=db_session)
    mock_structured_calls(
        client,
        [
            {
                "text": "Co sie stanie z cena, gdy popyt wzrosnie przy stalej podazy?",
                "rubric": {
                    "key_points": ["Cena rosnie"],
                    "min_points_for_pass": 1,
                    "sample_good_answer": "Cena zazwyczaj rosnie.",
                },
            }
        ],
    )
    quizmaster = Quizmaster(client)
    question = await quizmaster.generate_question("Popyt", "Ilość dobra, jaką kupujący chcą nabyć", QuestionType.predict)
    assert "popyt" in question.text.lower() or question.text
    assert question.rubric.min_points_for_pass == 1


@pytest.mark.asyncio
async def test_evaluate_answer_empty_transcript_skips_llm_call(db_session):
    client = AnthropicClient(db=db_session)
    client._client.messages.create = None  # would blow up if called
    quizmaster = Quizmaster(client)

    outcome = await quizmaster.evaluate_answer(
        "Pytanie?", {"key_points": ["a"], "min_points_for_pass": 1, "sample_good_answer": "a"}, ""
    )
    assert outcome.needs_clarification is True
    assert outcome.correctness == 0.0


@pytest.mark.asyncio
async def test_evaluate_answer_low_llm_confidence_forces_clarification(db_session):
    client = AnthropicClient(db=db_session)
    mock_structured_calls(
        client,
        [
            {
                "key_points_hit": [],
                "key_points_missed": ["Cena rosnie"],
                "correctness": 0.5,
                "llm_confidence": 0.2,
                "misconception": None,
                "feedback_text": "Trudno mi ocenić tę odpowiedź.",
            }
        ],
    )
    quizmaster = Quizmaster(client)
    outcome = await quizmaster.evaluate_answer(
        "Pytanie?",
        {"key_points": ["Cena rosnie"], "min_points_for_pass": 1, "sample_good_answer": "Cena rosnie."},
        "mruczy coś niewyraźnie",
    )
    assert outcome.needs_clarification is True


@pytest.mark.asyncio
async def test_evaluate_answer_confident_correct_answer(db_session):
    client = AnthropicClient(db=db_session)
    mock_structured_calls(
        client,
        [
            {
                "key_points_hit": ["Cena rosnie"],
                "key_points_missed": [],
                "correctness": 1.0,
                "llm_confidence": 0.95,
                "misconception": None,
                "feedback_text": "Świetnie!",
            }
        ],
    )
    quizmaster = Quizmaster(client)
    outcome = await quizmaster.evaluate_answer(
        "Pytanie?",
        {"key_points": ["Cena rosnie"], "min_points_for_pass": 1, "sample_good_answer": "Cena rosnie."},
        "Cena powinna wzrosnac",
    )
    assert outcome.needs_clarification is False
    assert outcome.correctness == 1.0
