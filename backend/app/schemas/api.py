"""Request/response models for the REST API. Kept separate from the
research-pipeline structured-output schemas (app/schemas/research.py) --
these describe the HTTP contract, not LLM tool-call payloads."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.models import (
    ClaimConfidence,
    ConceptImportance,
    ResearchRunStatus,
    SessionType,
    SourceType,
    TopicStatus,
)


class TopicCreateRequest(BaseModel):
    raw_query: str = Field(min_length=3, max_length=2000)


class TopicCreateResponse(BaseModel):
    topic_id: uuid.UUID
    status: TopicStatus


class ConceptOut(BaseModel):
    id: uuid.UUID
    name: str
    definition: str
    importance: ConceptImportance
    examples: list[str] = []
    counterexamples: list[str] = []
    misconceptions: list[str] = []
    applications: list[str] = []
    mastery: float = 0.0
    order_index: int | None = None

    model_config = {"from_attributes": True}


class TopicStatusResponse(BaseModel):
    id: uuid.UUID
    title: str
    raw_query: str
    status: TopicStatus
    research_run_status: ResearchRunStatus | None = None
    research_run_error: str | None = None
    concepts: list[ConceptOut] = []

    model_config = {"from_attributes": True}


class SourceOut(BaseModel):
    id: uuid.UUID
    url: str
    title: str | None
    author: str | None
    publisher: str | None
    published_at: datetime | None
    source_type: SourceType
    credibility_score: float | None
    credibility_rationale: str | None

    model_config = {"from_attributes": True}


class ClaimOut(BaseModel):
    id: uuid.UUID
    text: str
    confidence: ClaimConfidence

    model_config = {"from_attributes": True}


class SessionCreateRequest(BaseModel):
    topic_id: uuid.UUID
    type: SessionType = SessionType.learn


class SessionTurnOut(BaseModel):
    turn_type: str
    content_text: str
    concept_id: uuid.UUID | None = None
    session_complete: bool = False


class SessionCreateResponse(BaseModel):
    session_id: uuid.UUID
    type: SessionType
    turns: list[SessionTurnOut] = []


class SessionAnswerRequest(BaseModel):
    transcript: str


class SessionAnswerResponse(BaseModel):
    turns: list[SessionTurnOut] = []


class DeepgramTokenResponse(BaseModel):
    access_token: str
    expires_in: int


class ReviewDueOut(BaseModel):
    concept_id: uuid.UUID
    concept_name: str
    scheduled_for: datetime
    mastery: float

    model_config = {"from_attributes": True}


class DashboardTopicOut(BaseModel):
    id: uuid.UUID
    title: str
    status: TopicStatus
    concept_count: int
    mastered_count: int


class DashboardResponse(BaseModel):
    topics: list[DashboardTopicOut]
    due_review_count: int
    recent_sessions: list[uuid.UUID]
