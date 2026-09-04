import pytest

from app.agents.knowledge_architect import KnowledgeArchitect
from app.integrations.anthropic_client import AnthropicClient
from app.models.models import ConceptImportance, RelationshipType
from tests.unit._llm_mocks import mock_structured_calls


@pytest.mark.asyncio
async def test_build_relationships_happy_path(db_session):
    client = AnthropicClient(db=db_session)
    mock_structured_calls(
        client,
        [
            {
                "importance_assignments": [
                    {"concept_name": "Popyt", "importance": "core"},
                    {"concept_name": "Elastyczność popytu", "importance": "secondary"},
                ],
                "relationships": [
                    {
                        "from_concept_name": "Popyt",
                        "to_concept_name": "Elastyczność popytu",
                        "type": "prerequisite_of",
                    }
                ],
            }
        ],
    )
    architect = KnowledgeArchitect(client)

    result = await architect.build_relationships(
        [("Popyt", "Ilość dobra, jaką kupujący chcą nabyć"), ("Elastyczność popytu", "Wrażliwość popytu na cenę")]
    )

    assert result.importance_assignments[0].importance == ConceptImportance.core
    assert result.relationships[0].type == RelationshipType.prerequisite_of


@pytest.mark.asyncio
async def test_build_relationships_no_relationships_found(db_session):
    client = AnthropicClient(db=db_session)
    mock_structured_calls(
        client,
        [
            {
                "importance_assignments": [{"concept_name": "Solo", "importance": "peripheral"}],
                "relationships": [],
            }
        ],
    )
    architect = KnowledgeArchitect(client)
    result = await architect.build_relationships([("Solo", "Pojedyncze pojęcie")])
    assert result.relationships == []
