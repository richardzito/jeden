"""Synthesizer agent: turns accepted claims into a structured set of
concepts (definitions, examples, counterexamples, misconceptions,
applications). This is the one deliberately expensive (Opus) call in the
whole pipeline -- spec section 3/10: run once per topic and cache the
result (caching itself is handled by the pipeline orchestrator, task 6,
via `research_cache`), never per-user.
"""

from app.integrations.anthropic_client import AnthropicClient, ModelTier
from app.schemas.research import ConceptDraftList, locale_name

_SYSTEM = """You are synthesizing verified research claims into a set of learnable concepts for \
an audio tutoring app. Given a list of claims (each tagged with a confidence level), produce a \
concise set of distinct concepts that together teach the topic well to a beginner.

For each concept:
- name: short, specific concept name
- definition: a clear, accessible definition a curious beginner could understand (avoid jargon, \
or explain it inline if unavoidable)
- examples: 1-3 concrete examples
- counterexamples: 0-2 things that look similar but are NOT this concept, or edge cases where the \
concept does not apply
- misconceptions: 0-2 common misconceptions people have about this concept
- applications: 0-2 real-world applications or reasons this matters
- source_claim_texts: the verbatim claim texts (from the input) this concept is built from

Do not invent facts not present in the claims. If claims conflict (contested confidence), reflect \
that honestly in the definition or misconceptions rather than picking a side. Keep concepts \
focused -- prefer several precise concepts over one sprawling one. Write everything in {locale}."""


class Synthesizer:
    def __init__(self, client: AnthropicClient):
        self._client = client

    async def build_concepts(
        self, topic_title: str, claims: list[str], locale: str = "pl", *, topic_id=None
    ) -> ConceptDraftList:
        claims_listing = "\n".join(f"- {c}" for c in claims)
        return await self._client.structured_call(
            agent_name="synthesizer.build_concepts",
            tier=ModelTier.opus,
            system=_SYSTEM.format(locale=locale_name(locale)),
            user_message=f"Topic: {topic_title}\n\nClaims:\n{claims_listing}",
            response_model=ConceptDraftList,
            max_tokens=8192,
            topic_id=topic_id,
        )
