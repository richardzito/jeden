"""CurriculumDesigner agent: orders concepts into a learnable sequence and
drafts the initial Lesson Plan (a fixed script of beats) for the first few
concepts.

The ordering itself (section 6, step 7 of the spec: "prerequisites first")
is deterministic topological sort over `prerequisite_of` edges -- that is
exactly the kind of task an LLM is unreliable at (silently dropping or
reordering items) and code does perfectly and testably. The LLM is used
only for the parts that need judgement: short human-readable rationale
text, and the actual lesson content (explanations/questions/rubrics).
"""

import uuid
from dataclasses import dataclass, field

from app.integrations.anthropic_client import AnthropicClient, ModelTier
from app.models.models import ConceptImportance, RelationshipType
from app.schemas.research import (
    CurriculumRationaleList,
    LessonPlanBeatDraft,
    LessonPlanDraft,
    locale_name,
)

MASTERY_SKIP_THRESHOLD = 0.8

_IMPORTANCE_RANK = {
    ConceptImportance.core: 0,
    ConceptImportance.secondary: 1,
    ConceptImportance.peripheral: 2,
}

_FALLBACK_RATIONALE = {
    ConceptImportance.core: "Kluczowe pojęcie bazowe dla tego tematu.",
    ConceptImportance.secondary: "Pogłębia i uzupełnia podstawy.",
    ConceptImportance.peripheral: "Dodatkowy szczegół, przydatny dla pełniejszego obrazu.",
}


@dataclass
class ConceptNode:
    id: uuid.UUID
    name: str
    definition: str
    importance: ConceptImportance = ConceptImportance.secondary


@dataclass
class RelationshipEdge:
    from_id: uuid.UUID
    to_id: uuid.UUID
    type: RelationshipType


@dataclass
class CurriculumEntry:
    concept: ConceptNode
    order_index: int
    rationale: str
    already_mastered: bool = False


def topological_order(
    concepts: list[ConceptNode], relationships: list[RelationshipEdge]
) -> list[ConceptNode]:
    """Kahn's algorithm over `prerequisite_of` edges (from_id must come
    before to_id). Ties broken by importance (core first), then input
    order. Any residual cycle is broken by falling back to input order for
    the leftover nodes, rather than raising -- a malformed graph from the
    LLM step should degrade gracefully, not crash the whole pipeline."""
    by_id = {c.id: c for c in concepts}
    input_order = {c.id: i for i, c in enumerate(concepts)}
    prereq_edges = [r for r in relationships if r.type == RelationshipType.prerequisite_of]

    in_degree = dict.fromkeys(by_id, 0)
    adjacency: dict[uuid.UUID, list[uuid.UUID]] = {cid: [] for cid in by_id}
    for edge in prereq_edges:
        if edge.from_id not in by_id or edge.to_id not in by_id:
            continue
        adjacency[edge.from_id].append(edge.to_id)
        in_degree[edge.to_id] += 1

    def sort_key(cid: uuid.UUID) -> tuple:
        c = by_id[cid]
        return (_IMPORTANCE_RANK.get(c.importance, 1), input_order[cid])

    available = sorted([cid for cid, d in in_degree.items() if d == 0], key=sort_key)
    ordered: list[uuid.UUID] = []
    remaining_in_degree = dict(in_degree)

    while available:
        available.sort(key=sort_key)
        current = available.pop(0)
        ordered.append(current)
        for neighbor in adjacency[current]:
            remaining_in_degree[neighbor] -= 1
            if remaining_in_degree[neighbor] == 0:
                available.append(neighbor)

    if len(ordered) < len(concepts):
        leftover = sorted((cid for cid in by_id if cid not in ordered), key=sort_key)
        ordered.extend(leftover)

    return [by_id[cid] for cid in ordered]


_RATIONALE_SYSTEM = """For each concept in this learning sequence, write one short sentence \
(max ~12 words) explaining why it's placed at this point in the sequence -- e.g. what it builds \
on, or why it's foundational. Write in {locale}."""

_LESSON_PLAN_SYSTEM = """You are drafting the script for a short spoken micro-lesson on ONE \
concept, to be delivered by a voice tutor in a live conversation.

Hard rules (the app enforces these programmatically too, but write it correctly the first time):
- The "explain" beat's text must be at most 4 short sentences (~20-30 seconds spoken).
- After explaining, ALWAYS include a "question" beat that actively engages the learner (not just \
"do you understand?" -- ask them to apply, recall, predict, or explain something).
- Every "question" beat must be followed by an "expected_answer_rubric" beat: 2-4 key points a \
good answer should hit, a minimum number of points to count as a pass, and one sample good answer.
- Include a "follow_up" beat with three short branches: what the tutor says if the answer is \
correct, if it's partially correct, and if it's incorrect (this maps to a "don't understand" \
escalation ladder handled by the app: simpler explanation -> analogy -> example -> counterexample \
-> diagnostic question).
- End with a short "transition" beat (1 sentence) bridging to the next concept.
- question_type must be one of: recall, definition, why, how, compare, explain, predict, apply, \
transfer, counterfactual, diagnose, teach_back.

Produce beats in this order: explain, question, expected_answer_rubric, follow_up, transition. \
Write all learner-facing text in {locale}."""


class CurriculumDesigner:
    def __init__(self, client: AnthropicClient):
        self._client = client

    def build_curriculum(
        self,
        concepts: list[ConceptNode],
        relationships: list[RelationshipEdge],
        user_mastery: dict[uuid.UUID, float] | None = None,
    ) -> list[CurriculumEntry]:
        user_mastery = user_mastery or {}
        ordered = topological_order(concepts, relationships)
        entries = []
        for idx, concept in enumerate(ordered):
            mastered = user_mastery.get(concept.id, 0.0) >= MASTERY_SKIP_THRESHOLD
            rationale = _FALLBACK_RATIONALE.get(concept.importance, _FALLBACK_RATIONALE[ConceptImportance.secondary])
            if mastered:
                rationale = "Już opanowane — krótkie przypomnienie."
            entries.append(
                CurriculumEntry(
                    concept=concept, order_index=idx, rationale=rationale, already_mastered=mastered
                )
            )
        return entries

    async def refine_rationales(
        self, entries: list[CurriculumEntry], locale: str = "pl", *, topic_id=None
    ) -> list[CurriculumEntry]:
        """Best-effort: replace the deterministic fallback rationale with a
        short LLM-written one. Never blocks curriculum creation on failure
        -- callers should catch ExternalServiceError around this and keep
        the fallback rationale."""
        non_mastered = [e for e in entries if not e.already_mastered]
        if not non_mastered:
            return entries
        listing = "\n".join(f"{i+1}. {e.concept.name}" for i, e in enumerate(non_mastered))
        result: CurriculumRationaleList = await self._client.structured_call(
            agent_name="curriculum_designer.rationales",
            tier=ModelTier.sonnet,
            system=_RATIONALE_SYSTEM.format(locale=locale_name(locale)),
            user_message=f"Sequence:\n{listing}",
            response_model=CurriculumRationaleList,
            topic_id=topic_id,
        )
        by_name = {r.concept_name: r.rationale for r in result.items}
        for entry in non_mastered:
            if entry.concept.name in by_name:
                entry.rationale = by_name[entry.concept.name]
        return entries

    async def generate_lesson_plan_beats(
        self, concept: ConceptNode, locale: str = "pl", *, topic_id=None
    ) -> list[LessonPlanBeatDraft]:
        draft: LessonPlanDraft = await self._client.structured_call(
            agent_name="curriculum_designer.lesson_plan",
            tier=ModelTier.sonnet,
            system=_LESSON_PLAN_SYSTEM.format(locale=locale_name(locale)),
            user_message=f"Concept: {concept.name}\nDefinition: {concept.definition}",
            response_model=LessonPlanDraft,
            max_tokens=4096,
            topic_id=topic_id,
        )
        return draft.beats
