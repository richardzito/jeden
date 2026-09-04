from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
import respx

from app.integrations.exceptions import ExternalServiceError
from app.integrations.search import AnthropicSearchProvider, TavilySearchProvider


@pytest.mark.asyncio
async def test_anthropic_search_provider_parses_results():
    provider = AnthropicSearchProvider()
    result_item = SimpleNamespace(url="https://example.com/a", title="A", page_age="2024")
    block = SimpleNamespace(type="web_search_tool_result", content=[result_item])
    provider._client.messages.create = AsyncMock(
        return_value=SimpleNamespace(content=[block])
    )

    results = await provider.search("inflacja", max_results=3)
    assert len(results) == 1
    assert results[0].url == "https://example.com/a"
    assert results[0].title == "A"


@pytest.mark.asyncio
async def test_anthropic_fetch_raises_on_empty_content():
    provider = AnthropicSearchProvider()
    provider._client.messages.create = AsyncMock(return_value=SimpleNamespace(content=[]))

    with pytest.raises(ExternalServiceError):
        await provider.fetch("https://example.com/a")


@pytest.mark.asyncio
async def test_tavily_search_provider_happy_path(monkeypatch):
    monkeypatch.setenv("TAVILY_API_KEY", "fake-key")
    from app.core.config import get_settings

    get_settings.cache_clear()
    provider = TavilySearchProvider()

    with respx.mock(base_url="https://api.tavily.com") as mock:
        mock.post("/search").mock(
            return_value=httpx.Response(
                200,
                json={
                    "results": [
                        {"url": "https://x.com", "title": "X", "content": "snippet"},
                    ]
                },
            )
        )
        results = await provider.search("jak dziala gospodarka")

    assert len(results) == 1
    assert results[0].url == "https://x.com"
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_tavily_extract_raises_on_http_error(monkeypatch):
    monkeypatch.setenv("TAVILY_API_KEY", "fake-key")
    from app.core.config import get_settings

    get_settings.cache_clear()
    provider = TavilySearchProvider()

    with respx.mock(base_url="https://api.tavily.com") as mock:
        mock.post("/extract").mock(return_value=httpx.Response(500))
        with pytest.raises(ExternalServiceError):
            await provider.fetch("https://x.com")
    get_settings.cache_clear()


def test_tavily_provider_requires_api_key(monkeypatch):
    monkeypatch.setenv("TAVILY_API_KEY", "")
    from app.core.config import get_settings

    get_settings.cache_clear()
    with pytest.raises(ExternalServiceError):
        TavilySearchProvider()
    get_settings.cache_clear()
