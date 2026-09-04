import pytest

from app.agents.synthesizer import Synthesizer
from app.integrations.anthropic_client import AnthropicClient
from tests.unit._llm_mocks import mock_structured_calls


@pytest.mark.asyncio
async def test_build_concepts_happy_path(db_session):
    client = AnthropicClient(db=db_session)
    mock_structured_calls(
        client,
        [
            {
                "concepts": [
                    {
                        "name": "Inflacja",
                        "definition": "Ogólny wzrost cen w gospodarce w czasie.",
                        "examples": ["Ceny chleba rosną z roku na rok"],
                        "counterexamples": [],
                        "misconceptions": ["Inflacja zawsze jest zła"],
                        "applications": ["Wpływa na siłę nabywczą oszczędności"],
                        "source_claim_texts": ["Inflacja w Polsce w 2023 była podwyższona"],
                    }
                ]
            }
        ],
    )
    synthesizer = Synthesizer(client)

    result = await synthesizer.build_concepts("Jak działa gospodarka?", ["Inflacja w Polsce w 2023 była podwyższona"])

    assert len(result.concepts) == 1
    assert result.concepts[0].name == "Inflacja"
    assert result.concepts[0].misconceptions


@pytest.mark.asyncio
async def test_build_concepts_empty_claims_still_calls_model(db_session):
    client = AnthropicClient(db=db_session)
    mock_structured_calls(client, [{"concepts": []}])
    synthesizer = Synthesizer(client)

    result = await synthesizer.build_concepts("Temat bez twierdzen", [])
    assert result.concepts == []
