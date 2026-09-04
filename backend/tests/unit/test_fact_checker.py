from datetime import datetime, timezone

import pytest

from app.agents.credibility import compute_rule_based_credibility
from app.agents.fact_checker import FactChecker, SourceMeta
from app.integrations.anthropic_client import AnthropicClient
from app.models.models import ClaimConfidence, SourceType
from tests.unit._llm_mocks import mock_structured_calls


def test_rule_based_credibility_rewards_gov_with_author_and_date():
    score = compute_rule_based_credibility(
        url="https://www.nbp.gov.pl/report",
        author="Jan Kowalski",
        publisher="NBP",
        published_at=datetime(2023, 1, 1, tzinfo=timezone.utc),
        source_type=SourceType.institutional,
    )
    assert score > 0.8


def test_rule_based_credibility_penalizes_anonymous_other_source():
    score = compute_rule_based_credibility(
        url="https://randomblog.example.com/post",
        author=None,
        publisher=None,
        published_at=None,
        source_type=SourceType.other,
    )
    assert score < 0.3


@pytest.mark.asyncio
async def test_score_source_blends_rule_and_llm_score(db_session):
    client = AnthropicClient(db=db_session)
    mock_structured_calls(
        client,
        [{"llm_score": 0.9, "rationale": "Well established institution", "suggested_source_type": "institutional"}],
    )
    checker = FactChecker(client)
    meta = SourceMeta(
        url="https://www.nbp.gov.pl/report",
        author="Jan Kowalski",
        publisher="NBP",
        published_at=datetime(2023, 1, 1, tzinfo=timezone.utc),
        source_type=SourceType.institutional,
    )
    scored = await checker.score_source(meta)
    assert 0 <= scored.credibility_score <= 1
    assert scored.credibility_rationale == "Well established institution"


@pytest.mark.asyncio
async def test_extract_claims_forces_contested_on_contradiction(db_session):
    client = AnthropicClient(db=db_session)
    mock_structured_calls(
        client,
        [
            {
                "claims": [
                    {
                        "text": "Inflacja w 2023 wyniosla dokladnie 5%",
                        "supporting_indices": [0],
                        "contradicting_indices": [1],
                        "suggested_confidence": "established",
                    }
                ]
            }
        ],
    )
    checker = FactChecker(client)

    src_a = _scored_source("https://a.gov", 0.9)
    src_b = _scored_source("https://b.com", 0.6)
    claims = await checker.extract_claims("Jaka byla inflacja?", [("tekst a", src_a), ("tekst b", src_b)])

    assert claims[0].suggested_confidence == ClaimConfidence.contested


@pytest.mark.asyncio
async def test_extract_claims_downgrades_established_without_two_sources(db_session):
    client = AnthropicClient(db=db_session)
    mock_structured_calls(
        client,
        [
            {
                "claims": [
                    {
                        "text": "Cos co ma tylko jedno zrodlo",
                        "supporting_indices": [0],
                        "contradicting_indices": [],
                        "suggested_confidence": "established",
                    }
                ]
            }
        ],
    )
    checker = FactChecker(client)
    src_a = _scored_source("https://a.gov", 0.9)
    claims = await checker.extract_claims("pytanie", [("tekst a", src_a)])

    assert claims[0].suggested_confidence == ClaimConfidence.moderate


def _scored_source(url: str, credibility: float):
    from app.agents.fact_checker import ScoredSource

    return ScoredSource(
        url=url,
        author="A",
        publisher="B",
        published_at=None,
        source_type=SourceType.report,
        credibility_score=credibility,
        credibility_rationale="",
    )
