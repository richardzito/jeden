"""Quizmaster agent: generates active-recall questions matched to a
learner's current mastery, and evaluates spoken answers against an
explicit rubric rather than a bare correct/incorrect judgement (spec risk
A.3).

Two guardrails against over-trusting a single LLM call on noisy voice
input:
1. An empty/near-empty transcript (STT silence, cut-off audio) never goes
   to the model for "evaluation" -- there's nothing to evaluate, and
   asking an LLM to score silence invites a hallucinated score. The
   caller gets `needs_clarification=True` immediately.
2. The model also reports its own confidence in the evaluation. Below
   `CONFIDENCE_THRESHOLD`, the result is downgraded to
   `needs_clarification=True` rather than trusted at face value --
   the Tutor should ask the learner to repeat/clarify instead of silently
   recording a possibly-wrong mastery update.
"""

from dataclasses import dataclass, field

from app.integrations.anthropic_client import AnthropicClient, ModelTier
from app.models.models import QuestionType
from app.schemas.research import locale_name
from app.schemas.session import AnswerEvaluation, GeneratedQuestion

CONFIDENCE_THRESHOLD = 0.5
MIN_TRANSCRIPT_CHARS = 3

_GENERATE_QUESTION_SYSTEM = """You write one active-recall question about a concept for a spoken \
tutoring session, of the requested type:
- recall: ask the learner to state a fact/definition from memory
- definition: ask them to define the concept in their own words
- why: ask them to explain why something is true/happens
- how: ask them to explain a mechanism/process
- compare: ask them to compare/contrast with a related concept
- explain: ask them to explain the concept generally
- predict: ask them to predict an outcome given a scenario
- apply: ask them to apply the concept to a new situation
- transfer: ask them to use the concept in a different domain/context
- counterfactual: ask "what would happen if X were different"
- diagnose: give a scenario and ask them to identify what's wrong/why
- teach_back: ask them to explain the concept as if teaching someone else

Keep the question short (one sentence, spoken-friendly). Also provide a grading rubric: 2-4 key \
points a good answer should hit, the minimum number of those points needed to count as a pass, \
and one sample good answer. Write in {locale}."""

_EVALUATE_SYSTEM = """You are grading a learner's SPOKEN answer (transcribed by speech-to-text, so \
expect informal phrasing, filler words, and occasional transcription errors -- do not penalize \
phrasing or grammar, only substance) against a rubric.

List which key points from the rubric the answer covers and which it misses. Give a correctness \
score 0-1 based on rubric coverage (not vibes). If the answer reveals a specific wrong belief \
(not just an incomplete answer), name it as a misconception. Also report your own confidence \
(0-1) in this evaluation -- lower it if the transcript is garbled, ambiguous, or could reasonably \
be interpreted multiple ways. Write feedback_text as 1-2 short spoken-friendly sentences in \
{locale}, addressed directly to the learner."""


@dataclass
class EvaluationOutcome:
    correctness: float
    feedback_text: str
    needs_clarification: bool
    misconception: str | None = None
    key_points_hit: list[str] = field(default_factory=list)
    key_points_missed: list[str] = field(default_factory=list)
    llm_confidence: float | None = None


def choose_question_type(
    *, comprehension: float, recall: float, mastery: float, exposure_count: int
) -> QuestionType:
    """Active-recall heuristic (spec section H): pick a question type suited
    to what the learner's current state suggests they need practice on."""
    if exposure_count == 0:
        return QuestionType.definition
    if recall < 0.5:
        return QuestionType.recall
    if comprehension >= 0.7 and mastery < 0.7:
        return QuestionType.apply
    if mastery >= 0.7:
        return QuestionType.transfer
    return QuestionType.explain


class Quizmaster:
    def __init__(self, client: AnthropicClient):
        self._client = client

    async def generate_question(
        self,
        concept_name: str,
        concept_definition: str,
        question_type: QuestionType,
        locale: str = "pl",
        *,
        topic_id=None,
        session_id=None,
    ) -> GeneratedQuestion:
        return await self._client.structured_call(
            agent_name="quizmaster.generate_question",
            tier=ModelTier.sonnet,
            system=_GENERATE_QUESTION_SYSTEM.format(locale=locale_name(locale)),
            user_message=(
                f"Concept: {concept_name}\nDefinition: {concept_definition}\n"
                f"Question type: {question_type.value}"
            ),
            response_model=GeneratedQuestion,
            topic_id=topic_id,
            session_id=session_id,
        )

    async def evaluate_answer(
        self,
        question_text: str,
        rubric: dict,
        transcript: str,
        locale: str = "pl",
        *,
        topic_id=None,
        session_id=None,
    ) -> EvaluationOutcome:
        if not transcript or len(transcript.strip()) < MIN_TRANSCRIPT_CHARS:
            return EvaluationOutcome(
                correctness=0.0,
                feedback_text="Nie usłyszałem odpowiedzi — możesz powtórzyć?"
                if locale == "pl"
                else "I didn't catch an answer — could you repeat that?",
                needs_clarification=True,
            )

        rubric_listing = "\n".join(f"- {p}" for p in rubric.get("key_points", []))
        result: AnswerEvaluation = await self._client.structured_call(
            agent_name="quizmaster.evaluate_answer",
            tier=ModelTier.sonnet,
            system=_EVALUATE_SYSTEM.format(locale=locale_name(locale)),
            user_message=(
                f"Question: {question_text}\n\nRubric key points:\n{rubric_listing}\n"
                f"Minimum points to pass: {rubric.get('min_points_for_pass', 1)}\n"
                f"Sample good answer: {rubric.get('sample_good_answer', '')}\n\n"
                f"Learner's transcribed answer: \"{transcript}\""
            ),
            response_model=AnswerEvaluation,
            topic_id=topic_id,
            session_id=session_id,
        )

        needs_clarification = result.llm_confidence < CONFIDENCE_THRESHOLD
        return EvaluationOutcome(
            correctness=result.correctness,
            feedback_text=result.feedback_text,
            needs_clarification=needs_clarification,
            misconception=result.misconception,
            key_points_hit=result.key_points_hit,
            key_points_missed=result.key_points_missed,
            llm_confidence=result.llm_confidence,
        )
