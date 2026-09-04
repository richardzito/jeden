"""Researcher agent: decomposes a topic into sub-questions (Haiku), then
searches and selects the most promising sources per sub-question (Sonnet
for selection judgement, since picking *which* results are worth fetching
benefits from more reasoning than plain decomposition).

Runs only inside the async research pipeline (arq worker) -- never during a
live voice session (see spec section 4 / A.1: research and live tutoring
are different latency regimes).
"""

from app.integrations.anthropic_client import AnthropicClient, ModelTier
from app.integrations.search import FetchedContent, SearchProvider, SearchResult
from app.schemas.research import SourceSelection, SubquestionList, locale_name

_DECOMPOSE_SYSTEM = """You are a research planner. Given a learning topic, break it down into \
concrete, answerable sub-questions that together give a thorough, well-rounded understanding of \
the topic for someone learning it from scratch. Cover definitions, mechanisms/how it works, \
causes/effects, common misconceptions, and real-world relevance. Avoid overlap between \
sub-questions. Write the sub-questions in {locale}."""

_SELECT_SYSTEM = """You are a research assistant selecting which web search results are worth \
reading in full for a given sub-question. Prefer primary sources, official documentation, \
academic or institutional sources, and reputable, well-established publications. Deprioritize \
content-farm-looking pages, SEO spam, and pages with no clear author/publisher. Select 3 to 6 \
results."""


class Researcher:
    def __init__(self, client: AnthropicClient, search_provider: SearchProvider):
        self._client = client
        self._search = search_provider

    async def decompose(self, topic_query: str, locale: str = "pl", *, topic_id=None) -> list[str]:
        result = await self._client.structured_call(
            agent_name="researcher.decompose",
            tier=ModelTier.haiku,
            system=_DECOMPOSE_SYSTEM.format(locale=locale_name(locale)),
            user_message=f"Topic: {topic_query}",
            response_model=SubquestionList,
            topic_id=topic_id,
        )
        return result.subquestions

    async def search_and_select(
        self, subquestion: str, *, max_candidates: int = 8, topic_id=None
    ) -> list[SearchResult]:
        candidates = await self._search.search(subquestion, max_results=max_candidates)
        if not candidates:
            return []
        if len(candidates) <= 3:
            return candidates

        listing = "\n".join(
            f"[{i}] {c.title or c.url} — {c.url}\n    {c.snippet[:200]}"
            for i, c in enumerate(candidates)
        )
        selection = await self._client.structured_call(
            agent_name="researcher.select_sources",
            tier=ModelTier.sonnet,
            system=_SELECT_SYSTEM,
            user_message=f"Sub-question: {subquestion}\n\nCandidate results:\n{listing}",
            response_model=SourceSelection,
            topic_id=topic_id,
        )
        valid = [i for i in selection.selected_indices if 0 <= i < len(candidates)]
        return [candidates[i] for i in valid] or candidates[:4]

    async def fetch(self, url: str) -> FetchedContent:
        return await self._search.fetch(url)
