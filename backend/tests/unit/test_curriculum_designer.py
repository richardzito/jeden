import uuid

import pytest

from app.agents.curriculum_designer import (
    ConceptNode,
    CurriculumDesigner,
    RelationshipEdge,
    topological_order,
)
from app.integrations.anthropic_client import AnthropicClient
from app.models.models import ConceptImportance, RelationshipType
from tests.unit._llm_mocks import mock_structured_calls


def _node(name, importance=ConceptImportance.secondary):
    return ConceptNode(id=uuid.uuid4(), name=name, definition=f"def of {name}", importance=importance)


def test_topological_order_respects_prerequisite_chain():
    a, b, c = _node("A"), _node("B"), _node("C")
    edges = [
        RelationshipEdge(a.id, b.id, RelationshipType.prerequisite_of),
        RelationshipEdge(b.id, c.id, RelationshipType.prerequisite_of),
    ]
    ordered = topological_order([c, b, a], edges)
    assert [n.name for n in ordered] == ["A", "B", "C"]


def test_topological_order_diamond_dependency():
    a, b, c, d = _node("A"), _node("B"), _node("C"), _node("D")
    edges = [
        RelationshipEdge(a.id, b.id, RelationshipType.prerequisite_of),
        RelationshipEdge(a.id, c.id, RelationshipType.prerequisite_of),
        RelationshipEdge(b.id, d.id, RelationshipType.prerequisite_of),
        RelationshipEdge(c.id, d.id, RelationshipType.prerequisite_of),
    ]
    ordered = topological_order([d, c, b, a], edges)
    assert ordered[0].name == "A"
    assert ordered[-1].name == "D"
    assert set(n.name for n in ordered[1:3]) == {"B", "C"}


def test_topological_order_breaks_cycles_without_crashing():
    a, b = _node("A"), _node("B")
    edges = [
        RelationshipEdge(a.id, b.id, RelationshipType.prerequisite_of),
        RelationshipEdge(b.id, a.id, RelationshipType.prerequisite_of),
    ]
    ordered = topological_order([a, b], edges)
    assert {n.name for n in ordered} == {"A", "B"}
    assert len(ordered) == 2


def test_topological_order_prioritizes_core_importance_when_no_deps():
    core = _node("Core thing", ConceptImportance.core)
    peripheral = _node("Peripheral thing", ConceptImportance.peripheral)
    ordered = topological_order([peripheral, core], [])
    assert ordered[0].name == "Core thing"


def test_build_curriculum_marks_already_mastered_concepts():
    designer = CurriculumDesigner(client=None)
    concept = _node("Znany temat")
    entries = designer.build_curriculum([concept], [], user_mastery={concept.id: 0.95})
    assert entries[0].already_mastered is True
    assert "przypomnienie" in entries[0].rationale.lower()


def test_build_curriculum_default_rationale_for_unmastered_core_concept():
    designer = CurriculumDesigner(client=None)
    concept = _node("Nowy temat", ConceptImportance.core)
    entries = designer.build_curriculum([concept], [])
    assert entries[0].already_mastered is False
    assert entries[0].rationale == "Kluczowe pojęcie bazowe dla tego tematu."


@pytest.mark.asyncio
async def test_generate_lesson_plan_beats_happy_path(db_session):
    client = AnthropicClient(db=db_session)
    mock_structured_calls(
        client,
        [
            {
                "beats": [
                    {"beat_type": "explain", "text": "Popyt to ilość dobra, jaką kupujący chcą nabyć."},
                    {
                        "beat_type": "question",
                        "question": {"question_type": "predict", "text": "Co stanie się z popytem, gdy cena wzrośnie?"},
                    },
                    {
                        "beat_type": "expected_answer_rubric",
                        "rubric": {
                            "key_points": ["Popyt zwykle spada"],
                            "min_points_for_pass": 1,
                            "sample_good_answer": "Popyt zwykle spada, gdy cena rośnie.",
                        },
                    },
                    {
                        "beat_type": "follow_up",
                        "follow_up_if_correct": "Świetnie!",
                        "follow_up_if_partial": "Blisko, dopowiedzmy...",
                        "follow_up_if_incorrect": "Spróbujmy inaczej...",
                    },
                    {"beat_type": "transition", "text": "Przejdźmy do podaży."},
                ]
            }
        ],
    )
    designer = CurriculumDesigner(client)
    concept = _node("Popyt", ConceptImportance.core)

    beats = await designer.generate_lesson_plan_beats(concept)
    assert [b.beat_type for b in beats] == [
        "explain",
        "question",
        "expected_answer_rubric",
        "follow_up",
        "transition",
    ]
