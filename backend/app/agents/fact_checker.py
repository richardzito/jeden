"""FactChecker agent: scores source credibility and extracts claims with an
explicit confidence label.

Two deliberate guardrails against LLM overconfidence (spec risk A.2):
1. credibility_score is mostly the deterministic rule-based score
   (app/agents/credibility.py); the LLM only supplies a smaller modifier.
2. A claim can only end up labeled "established" if it is corroborated by
   >=2 sources whose credibility_score clears a minimum bar, and a claim
   with any contradicting source is always forced to "contested" --
   regardless of what the model itself suggested. The model's label is a
   *suggestion*, not the final word.
"""

from dataclasses import dataclass
from datetime import datetime

from app.agents.credibility import compute_rule_based_credibility
from app.integrations.anthropic_client import AnthropicClient, ModelTier
from app.models.models import ClaimConfidence, SourceType
from app.schemas.research import (
    CredibilityAssessment,
    ExtractedClaim,
    ExtractedClaimList,
    locale_name,
)

MIN_CREDIBILITY_FOR_CORROBORATION = 0.45
RULE_WEIGHT = 0.65
LLM_WEIGHT = 0.35

_CREDIBILITY_SYSTEM = """You assess the credibility of a web source for research purposes. \
Consider: does the author/publisher have relevant expertise, is the content fact-checked or \
editorially reviewed, is it a primary or secondary source, does it show signs of being pure \
marketing/SEO content or AI-generated without review. Give a score 0-1 (1 = highly credible) \
and a one-sentence rationale."""

_CLAIMS_SYSTEM = """You extract distinct, checkable factual claims from source excerpts that \
answer a research sub-question. For each claim, list which source excerpts (by index) support \
it and which contradict it. If sources disagree, still extract the claim and mark both sides -- \
do not silently pick a winner. Suggest a confidence label per claim: established (very well \
supported, no real controversy), moderate (reasonably supported but not exhaustively verified), \
contested (credible sources disagree), hypothesis (a proposed but unproven explanation), \
opinion (a value judgement, not a factual claim), uncertain (insufficient evidence either way). \
Write claim text in {locale}."""


@dataclass
class SourceMeta:
    url: str
    author: str | None
    publisher: str | None
    published_at: datetime | None
    source_type: SourceType
    title: str = ""
    snippet: str = ""


@dataclass
class ScoredSource(SourceMeta):
    credibility_score: float = 0.0
    credibility_rationale: str = ""


class FactChecker:
    def __init__(self, client: AnthropicClient):
        self._client = client

    async def score_source(self, meta: SourceMeta, *, topic_id=None) -> ScoredSource:
        rule_score = compute_rule_based_credibility(
            url=meta.url,
            author=meta.author,
            publisher=meta.publisher,
            published_at=meta.published_at,
            source_type=meta.source_type,
        )
        assessment = await self._client.structured_call(
            agent_name="fact_checker.score_source",
            tier=ModelTier.sonnet,
            system=_CREDIBILITY_SYSTEM,
            user_message=(
                f"URL: {meta.url}\nTitle: {meta.title}\nAuthor: {meta.author or 'unknown'}\n"
                f"Publisher: {meta.publisher or 'unknown'}\nPublished: {meta.published_at or 'unknown'}\n"
                f"Snippet: {meta.snippet[:500]}"
            ),
            response_model=CredibilityAssessment,
            topic_id=topic_id,
        )
        final_score = round(RULE_WEIGHT * rule_score + LLM_WEIGHT * assessment.llm_score, 3)
        source_type = meta.source_type if meta.source_type != SourceType.other else (
            assessment.suggested_source_type
        )
        return ScoredSource(
            **{**meta.__dict__, "source_type": source_type},
            credibility_score=final_score,
            credibility_rationale=assessment.rationale,
        )

    async def extract_claims(
        self, subquestion: str, sources: list[tuple[str, ScoredSource]], locale: str = "pl", *, topic_id=None
    ) -> list[ExtractedClaim]:
        """`sources` is a list of (excerpt_text, ScoredSource) pairs, in the
        order referenced by the model's supporting/contradicting indices."""
        if not sources:
            return []

        listing = "\n\n".join(
            f"[{i}] ({src.credibility_score:.2f} credibility) {src.url}\n{text[:1500]}"
            for i, (text, src) in enumerate(sources)
        )
        result = await self._client.structured_call(
            agent_name="fact_checker.extract_claims",
            tier=ModelTier.sonnet,
            system=_CLAIMS_SYSTEM.format(locale=locale_name(locale)),
            user_message=f"Sub-question: {subquestion}\n\nSource excerpts:\n{listing}",
            response_model=ExtractedClaimList,
            max_tokens=4096,
            topic_id=topic_id,
        )
        return [self._apply_confidence_guardrail(c, sources) for c in result.claims]

    @staticmethod
    def _apply_confidence_guardrail(
        claim: ExtractedClaim, sources: list[tuple[str, "ScoredSource"]]
    ) -> ExtractedClaim:
        if claim.contradicting_indices:
            claim.suggested_confidence = ClaimConfidence.contested
            return claim

        corroborating = [
            i
            for i in claim.supporting_indices
            if 0 <= i < len(sources) and sources[i][1].credibility_score >= MIN_CREDIBILITY_FOR_CORROBORATION
        ]
        if claim.suggested_confidence == ClaimConfidence.established and len(corroborating) < 2:
            claim.suggested_confidence = ClaimConfidence.moderate
        return claim
