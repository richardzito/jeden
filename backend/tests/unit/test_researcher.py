from unittest.mock import AsyncMock

import pytest

from app.agents.researcher import Researcher
from app.integrations.anthropic_client import AnthropicClient
from app.integrations.search import SearchResult
from tests.unit._llm_mocks import mock_structured_calls


@pytest.mark.asyncio
async def test_decompose_returns_subquestions(db_session):
    client = AnthropicClient(db=db_session)
    mock_structured_calls(
        client,
        [{"subquestions": ["Co to jest X?", "Jak działa X?", "Dlaczego X jest ważne?"]}],
    )
    search_provider = AsyncMock()
    researcher = Researcher(client, search_provider)

    result = await researcher.decompose("Jak działa gospodarka?")
    assert len(result) == 3
    assert "Co to jest X?" in result


@pytest.mark.asyncio
async def test_search_and_select_skips_llm_when_few_candidates(db_session):
    client = AnthropicClient(db=db_session)
    client._client.messages.create = AsyncMock()  # should never be called
    search_provider = AsyncMock()
    search_provider.search.return_value = [
        SearchResult(url="https://a.com", title="A"),
        SearchResult(url="https://b.com", title="B"),
    ]
    researcher = Researcher(client, search_provider)

    results = await researcher.search_and_select("pytanie")
    assert len(results) == 2
    client._client.messages.create.assert_not_called()


@pytest.mark.asyncio
async def test_search_and_select_uses_llm_selection(db_session):
    client = AnthropicClient(db=db_session)
    mock_structured_calls(client, [{"selected_indices": [0, 2]}])
    search_provider = AsyncMock()
    search_provider.search.return_value = [
        SearchResult(url=f"https://x{i}.com", title=f"X{i}") for i in range(6)
    ]
    researcher = Researcher(client, search_provider)

    results = await researcher.search_and_select("pytanie", max_candidates=6)
    assert [r.url for r in results] == ["https://x0.com", "https://x2.com"]


@pytest.mark.asyncio
async def test_search_and_select_no_results(db_session):
    client = AnthropicClient(db=db_session)
    search_provider = AsyncMock()
    search_provider.search.return_value = []
    researcher = Researcher(client, search_provider)

    results = await researcher.search_and_select("pytanie bez wynikow")
    assert results == []
