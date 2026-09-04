"""Structured LLM outputs for the live-session agents (Tutor, Quizmaster)."""

from pydantic import BaseModel, Field


class GeneratedQuestionRubric(BaseModel):
    key_points: list[str] = Field(min_length=1, max_length=5)
    min_points_for_pass: int = Field(ge=1)
    sample_good_answer: str


class GeneratedQuestion(BaseModel):
    text: str
    rubric: GeneratedQuestionRubric


class AnswerEvaluation(BaseModel):
    key_points_hit: list[str] = Field(default_factory=list)
    key_points_missed: list[str] = Field(default_factory=list)
    correctness: float = Field(ge=0, le=1, description="Fraction of the rubric's key points covered, weighted by importance")
    llm_confidence: float = Field(
        ge=0, le=1, description="How confident the model is in this evaluation, given transcript quality/ambiguity"
    )
    misconception: str | None = Field(default=None, description="A specific wrong belief evident in the answer, if any")
    feedback_text: str = Field(description="Short (1-2 sentence) spoken feedback for the learner")


class EscalationRung(BaseModel):
    text: str = Field(description="The tutor's next attempt at explaining, per the requested strategy")
