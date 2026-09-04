"""Pydantic models used as structured LLM outputs (forced tool-use, see
app/integrations/anthropic_client.py) and as internal agent I/O for the
research pipeline. Keeping these separate from the SQLAlchemy models lets
each research agent have a narrow, explicit input/output contract instead
of one large improvised prompt.
"""

from pydantic import BaseModel, Field

from app.models.models import ClaimConfidence, ConceptImportance, RelationshipType, SourceType

LOCALE_NAMES = {"pl": "polski (Polish)", "en": "English"}


def locale_name(locale: str) -> str:
    return LOCALE_NAMES.get(locale, locale)


# --- Researcher ------------------------------------------------------------


class SubquestionList(BaseModel):
    subquestions: list[str] = Field(
        description="5-10 concrete, non-overlapping sub-questions that together cover the topic",
        min_length=3,
        max_length=10,
    )


class SourceSelection(BaseModel):
    selected_indices: list[int] = Field(
        description="Indices (0-based) of the 3-6 most promising, credible-looking search "
        "results to fetch full content for"
    )


# --- FactChecker -------------------------------------------------------------


class CredibilityAssessment(BaseModel):
    llm_score: float = Field(ge=0, le=1, description="Model's own credibility estimate, 0-1")
    rationale: str = Field(description="One sentence explaining the score")
    suggested_source_type: SourceType


class ExtractedClaim(BaseModel):
    text: str
    supporting_indices: list[int] = Field(
        default_factory=list, description="Indices into the provided source list that support this claim"
    )
    contradicting_indices: list[int] = Field(
        default_factory=list, description="Indices into the provided source list that contradict this claim"
    )
    suggested_confidence: ClaimConfidence


class ExtractedClaimList(BaseModel):
    claims: list[ExtractedClaim]


# --- Synthesizer -------------------------------------------------------------


class ConceptDraft(BaseModel):
    name: str
    definition: str = Field(
        description="Clear, accessible definition a curious beginner could understand"
    )
    examples: list[str] = Field(default_factory=list)
    counterexamples: list[str] = Field(default_factory=list)
    misconceptions: list[str] = Field(default_factory=list)
    applications: list[str] = Field(default_factory=list)
    source_claim_texts: list[str] = Field(
        default_factory=list,
        description="Verbatim text of the claims this concept was built from, for provenance linking",
    )


class ConceptDraftList(BaseModel):
    concepts: list[ConceptDraft]


# --- KnowledgeArchitect --------------------------------------------------------


class ConceptImportanceAssignment(BaseModel):
    concept_name: str
    importance: ConceptImportance


class RelationshipDraft(BaseModel):
    from_concept_name: str
    to_concept_name: str
    type: RelationshipType


class KnowledgeArchitectOutput(BaseModel):
    importance_assignments: list[ConceptImportanceAssignment]
    relationships: list[RelationshipDraft]


# --- CurriculumDesigner --------------------------------------------------------


class CurriculumRationale(BaseModel):
    concept_name: str
    rationale: str = Field(description="One short sentence on why this concept is placed here")


class CurriculumRationaleList(BaseModel):
    items: list[CurriculumRationale]


class BeatQuestionContent(BaseModel):
    question_type: str
    text: str


class BeatRubricContent(BaseModel):
    key_points: list[str]
    min_points_for_pass: int
    sample_good_answer: str


class LessonPlanBeatDraft(BaseModel):
    beat_type: str  # explain | question | expected_answer_rubric | follow_up | transition
    text: str | None = None
    question: BeatQuestionContent | None = None
    rubric: BeatRubricContent | None = None
    follow_up_if_correct: str | None = None
    follow_up_if_partial: str | None = None
    follow_up_if_incorrect: str | None = None


class LessonPlanDraft(BaseModel):
    beats: list[LessonPlanBeatDraft]
