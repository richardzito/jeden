"""SQLAlchemy models implementing the data model from the product spec
(section 5). Enums are declared as plain Python Enums and mapped to native
Postgres ENUM types by SQLAlchemy/Alembic.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    ARRAY,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

# All timestamps are stored timezone-aware (Postgres TIMESTAMPTZ). Agent
# code consistently works in UTC-aware datetimes (see app.workers.pipeline
# ._now()); a naive/aware mismatch raises at the driver level, so this is
# applied everywhere a datetime column appears, not just created_at/updated_at.
TZDateTime = DateTime(timezone=True)


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(TZDateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime, server_default=func.now(), onupdate=func.now()
    )


# --- Enums -------------------------------------------------------------


class TopicStatus(str, enum.Enum):
    researching = "researching"
    ready = "ready"
    archived = "archived"


class ResearchRunStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    done = "done"
    failed = "failed"


class SourceType(str, enum.Enum):
    paper = "paper"
    book = "book"
    docs = "docs"
    institutional = "institutional"
    report = "report"
    reputable_media = "reputable_media"
    expert_blog = "expert_blog"
    other = "other"


class ClaimConfidence(str, enum.Enum):
    established = "established"
    moderate = "moderate"
    contested = "contested"
    hypothesis = "hypothesis"
    opinion = "opinion"
    uncertain = "uncertain"


class ConceptImportance(str, enum.Enum):
    core = "core"
    secondary = "secondary"
    peripheral = "peripheral"


class RelationshipType(str, enum.Enum):
    prerequisite_of = "prerequisite_of"
    related_to = "related_to"
    part_of = "part_of"
    contrasts_with = "contrasts_with"


class BeatType(str, enum.Enum):
    explain = "explain"
    question = "question"
    expected_answer_rubric = "expected_answer_rubric"
    follow_up = "follow_up"
    transition = "transition"


class SessionType(str, enum.Enum):
    learn = "learn"
    review = "review"
    quiz = "quiz"
    # Out of MVP scope (section 2 / 9), modeled now so the schema doesn't
    # need to change when they're built.
    deep_dive = "deep_dive"
    connections = "connections"
    teach_back = "teach_back"
    exam = "exam"
    discovery = "discovery"


class TurnRole(str, enum.Enum):
    agent = "agent"
    user = "user"


class TurnType(str, enum.Enum):
    explain = "explain"
    question = "question"
    answer = "answer"
    feedback = "feedback"
    transition = "transition"
    checkin = "checkin"


class QuestionType(str, enum.Enum):
    recall = "recall"
    definition = "definition"
    why = "why"
    how = "how"
    compare = "compare"
    explain = "explain"
    predict = "predict"
    apply = "apply"
    transfer = "transfer"
    counterfactual = "counterfactual"
    diagnose = "diagnose"
    teach_back = "teach_back"


# --- Tables --------------------------------------------------------------


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = _uuid_pk()
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    locale: Mapped[str] = mapped_column(String(10), default="pl")
    tts_voice_pref: Mapped[str | None] = mapped_column(String(100), nullable=True)

    topics: Mapped[list["Topic"]] = relationship(back_populates="user")


class Topic(Base, TimestampMixin):
    __tablename__ = "topics"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(500))
    raw_query: Mapped[str] = mapped_column(Text)
    status: Mapped[TopicStatus] = mapped_column(
        Enum(TopicStatus, name="topic_status"), default=TopicStatus.researching
    )
    normalized_query_hash: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)

    user: Mapped[User] = relationship(back_populates="topics")
    research_runs: Mapped[list["ResearchRun"]] = relationship(back_populates="topic")
    concepts: Mapped[list["Concept"]] = relationship(back_populates="topic")
    claims: Mapped[list["Claim"]] = relationship(back_populates="topic")
    curriculum_items: Mapped[list["CurriculumItem"]] = relationship(back_populates="topic")


class ResearchRun(Base, TimestampMixin):
    __tablename__ = "research_runs"

    id: Mapped[uuid.UUID] = _uuid_pk()
    topic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"))
    status: Mapped[ResearchRunStatus] = mapped_column(
        Enum(ResearchRunStatus, name="research_run_status"), default=ResearchRunStatus.pending
    )
    started_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    cost_usd: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    model_versions: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    topic: Mapped[Topic] = relationship(back_populates="research_runs")
    subquestions: Mapped[list["Subquestion"]] = relationship(back_populates="research_run")


class Subquestion(Base, TimestampMixin):
    __tablename__ = "subquestions"

    id: Mapped[uuid.UUID] = _uuid_pk()
    research_run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("research_runs.id", ondelete="CASCADE")
    )
    text: Mapped[str] = mapped_column(Text)
    priority: Mapped[int] = mapped_column(Integer, default=0)

    research_run: Mapped[ResearchRun] = relationship(back_populates="subquestions")


class Source(Base, TimestampMixin):
    __tablename__ = "sources"

    id: Mapped[uuid.UUID] = _uuid_pk()
    url: Mapped[str] = mapped_column(Text, unique=True)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    author: Mapped[str | None] = mapped_column(String(300), nullable=True)
    publisher: Mapped[str | None] = mapped_column(String(300), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    source_type: Mapped[SourceType] = mapped_column(
        Enum(SourceType, name="source_type"), default=SourceType.other
    )
    credibility_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    credibility_rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    fetched_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    # Extracted summary/facts only -- never the full copyrighted body text
    # (see README "Copyright & data retention").
    extracted_summary: Mapped[str | None] = mapped_column(Text, nullable=True)


class Claim(Base, TimestampMixin):
    __tablename__ = "claims"

    id: Mapped[uuid.UUID] = _uuid_pk()
    topic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"))
    subquestion_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("subquestions.id", ondelete="SET NULL"), nullable=True
    )
    text: Mapped[str] = mapped_column(Text)
    confidence: Mapped[ClaimConfidence] = mapped_column(
        Enum(ClaimConfidence, name="claim_confidence"), default=ClaimConfidence.uncertain
    )
    supporting_source_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), default=list
    )
    contradicting_source_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), default=list
    )

    topic: Mapped[Topic] = relationship(back_populates="claims")


class Concept(Base, TimestampMixin):
    __tablename__ = "concepts"

    id: Mapped[uuid.UUID] = _uuid_pk()
    topic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(300))
    definition: Mapped[str] = mapped_column(Text)
    importance: Mapped[ConceptImportance] = mapped_column(
        Enum(ConceptImportance, name="concept_importance"), default=ConceptImportance.secondary
    )
    examples: Mapped[list | None] = mapped_column(JSONB, default=list)
    counterexamples: Mapped[list | None] = mapped_column(JSONB, default=list)
    misconceptions: Mapped[list | None] = mapped_column(JSONB, default=list)
    applications: Mapped[list | None] = mapped_column(JSONB, default=list)

    topic: Mapped[Topic] = relationship(back_populates="concepts")


class ConceptRelationship(Base, TimestampMixin):
    __tablename__ = "concept_relationships"
    __table_args__ = (
        UniqueConstraint("from_concept_id", "to_concept_id", "type", name="uq_concept_rel"),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    from_concept_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("concepts.id", ondelete="CASCADE")
    )
    to_concept_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("concepts.id", ondelete="CASCADE"))
    type: Mapped[RelationshipType] = mapped_column(Enum(RelationshipType, name="relationship_type"))


class ConceptSource(Base):
    __tablename__ = "concept_sources"

    concept_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("concepts.id", ondelete="CASCADE"), primary_key=True
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sources.id", ondelete="CASCADE"), primary_key=True
    )
    claim_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("claims.id", ondelete="SET NULL"), nullable=True
    )


class CurriculumItem(Base, TimestampMixin):
    __tablename__ = "curriculum_items"

    id: Mapped[uuid.UUID] = _uuid_pk()
    topic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"))
    concept_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("concepts.id", ondelete="CASCADE"))
    order_index: Mapped[int] = mapped_column(Integer)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)

    topic: Mapped[Topic] = relationship(back_populates="curriculum_items")
    concept: Mapped[Concept] = relationship()


class LessonPlanBeat(Base, TimestampMixin):
    __tablename__ = "lesson_plan_beats"

    id: Mapped[uuid.UUID] = _uuid_pk()
    concept_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("concepts.id", ondelete="CASCADE"))
    order_index: Mapped[int] = mapped_column(Integer)
    beat_type: Mapped[BeatType] = mapped_column(Enum(BeatType, name="beat_type"))
    content: Mapped[dict] = mapped_column(JSONB)

    concept: Mapped[Concept] = relationship()


class UserConceptMastery(Base, TimestampMixin):
    __tablename__ = "user_concept_mastery"
    __table_args__ = (UniqueConstraint("user_id", "concept_id", name="uq_user_concept"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    concept_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("concepts.id", ondelete="CASCADE"))
    exposure_count: Mapped[int] = mapped_column(Integer, default=0)
    comprehension: Mapped[float] = mapped_column(Float, default=0.0)
    recall: Mapped[float] = mapped_column(Float, default=0.0)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    mastery: Mapped[float] = mapped_column(Float, default=0.0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    last_reviewed_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    next_review_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True, index=True)
    fsrs_state: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    misconception_flags: Mapped[list | None] = mapped_column(JSONB, default=list)


class Session(Base, TimestampMixin):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    topic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"))
    type: Mapped[SessionType] = mapped_column(Enum(SessionType, name="session_type"))
    started_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    turns: Mapped[list["SessionTurn"]] = relationship(back_populates="session")


class SessionTurn(Base, TimestampMixin):
    __tablename__ = "session_turns"

    id: Mapped[uuid.UUID] = _uuid_pk()
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    role: Mapped[TurnRole] = mapped_column(Enum(TurnRole, name="turn_role"))
    turn_type: Mapped[TurnType] = mapped_column(Enum(TurnType, name="turn_type"))
    content_text: Mapped[str] = mapped_column(Text)
    audio_ref: Mapped[str | None] = mapped_column(Text, nullable=True)
    concept_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("concepts.id", ondelete="SET NULL"), nullable=True
    )

    session: Mapped[Session] = relationship(back_populates="turns")


class Question(Base, TimestampMixin):
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = _uuid_pk()
    concept_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("concepts.id", ondelete="CASCADE"))
    type: Mapped[QuestionType] = mapped_column(Enum(QuestionType, name="question_type"))
    text: Mapped[str] = mapped_column(Text)
    difficulty: Mapped[float] = mapped_column(Float, default=0.5)
    rubric: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    generated_by_session_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True
    )


class Answer(Base, TimestampMixin):
    __tablename__ = "answers"

    id: Mapped[uuid.UUID] = _uuid_pk()
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"))
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    transcript: Mapped[str] = mapped_column(Text)
    evaluation_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    correctness: Mapped[float | None] = mapped_column(Float, nullable=True)
    feedback_text: Mapped[str | None] = mapped_column(Text, nullable=True)


class Review(Base, TimestampMixin):
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    concept_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("concepts.id", ondelete="CASCADE"))
    scheduled_for: Mapped[datetime] = mapped_column(TZDateTime, index=True)
    type: Mapped[str] = mapped_column(String(50), default="review")
    completed_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class ResearchCache(Base, TimestampMixin):
    __tablename__ = "research_cache"

    id: Mapped[uuid.UUID] = _uuid_pk()
    query_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    provider: Mapped[str] = mapped_column(String(50))
    response_json: Mapped[dict] = mapped_column(JSONB)
    ttl_expires_at: Mapped[datetime] = mapped_column(TZDateTime, index=True)


class LlmCall(Base, TimestampMixin):
    __tablename__ = "llm_calls"

    id: Mapped[uuid.UUID] = _uuid_pk()
    agent_name: Mapped[str] = mapped_column(String(100), index=True)
    model: Mapped[str] = mapped_column(String(100))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Numeric(10, 6), default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    topic_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    session_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
