"""SearchProvider abstraction used by the Researcher agent.

Two implementations share the same interface so the pipeline never depends
on a specific provider:

- AnthropicSearchProvider (default, SEARCH_PROVIDER=anthropic): uses
  Claude's server-side `web_search` / `web_fetch` tools, so results come
  pre-attributed with citations from the same model call.
- TavilySearchProvider (fallback, SEARCH_PROVIDER=tavily): a plain REST
  search/extract API, used when the Anthropic server tools are not
  available/enabled for the account or environment.

Both are best-effort against third-party APIs: the raw network call is
retried a few times for genuinely transient (connection-level) failures;
a definite error response is converted to `ExternalServiceError` and
raised immediately rather than silently swallowed or endlessly retried.
"""

import hashlib
from abc import ABC, abstractmethod

import anthropic
import httpx
from pydantic import BaseModel
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.core.logging import get_logger
from app.integrations.exceptions import ExternalServiceError

logger = get_logger(__name__)

_retry_transient_http = retry(
    retry=retry_if_exception_type(httpx.TransportError),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
)

_retry_transient_anthropic = retry(
    retry=retry_if_exception_type(
        (anthropic.APIConnectionError, anthropic.RateLimitError, anthropic.InternalServerError)
    ),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
)


class SearchResult(BaseModel):
    url: str
    title: str = ""
    snippet: str = ""


class FetchedContent(BaseModel):
    url: str
    title: str | None = None
    text: str
    content_hash: str


def _hash_content(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class SearchProvider(ABC):
    name: str

    @abstractmethod
    async def search(self, query: str, max_results: int = 5) -> list[SearchResult]: ...

    @abstractmethod
    async def fetch(self, url: str) -> FetchedContent: ...


class AnthropicSearchProvider(SearchProvider):
    name = "anthropic"

    # Anthropic server-tool identifiers. Pinned to the versions current at
    # implementation time; if Anthropic ships a newer tool version these
    # may need bumping (see README "Known limitations").
    _WEB_SEARCH_TOOL = {"type": "web_search_20250305", "name": "web_search"}
    _WEB_FETCH_TOOL = {"type": "web_fetch_20250910", "name": "web_fetch"}

    def __init__(self):
        settings = get_settings()
        self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._model = settings.anthropic_model_haiku

    @_retry_transient_anthropic
    async def _create(self, **kwargs):
        return await self._client.messages.create(**kwargs)

    async def search(self, query: str, max_results: int = 5) -> list[SearchResult]:
        try:
            response = await self._create(
                model=self._model,
                max_tokens=1024,
                tools=[{**self._WEB_SEARCH_TOOL, "max_uses": max_results}],
                messages=[{"role": "user", "content": f"Search the web for: {query}"}],
            )
        except anthropic.APIError as exc:
            raise ExternalServiceError("anthropic_web_search", str(exc)) from exc

        results: list[SearchResult] = []
        for block in response.content:
            if getattr(block, "type", None) == "web_search_tool_result":
                for item in getattr(block, "content", []) or []:
                    results.append(
                        SearchResult(
                            url=getattr(item, "url", ""),
                            title=getattr(item, "title", "") or "",
                            snippet=getattr(item, "page_age", "") or "",
                        )
                    )
        return results[:max_results]

    async def fetch(self, url: str) -> FetchedContent:
        try:
            response = await self._create(
                model=self._model,
                max_tokens=2048,
                tools=[self._WEB_FETCH_TOOL],
                messages=[{"role": "user", "content": f"Fetch and summarize: {url}"}],
            )
        except anthropic.APIError as exc:
            raise ExternalServiceError("anthropic_web_fetch", str(exc)) from exc

        text_parts = [b.text for b in response.content if getattr(b, "type", None) == "text"]
        text = "\n".join(text_parts).strip()
        if not text:
            raise ExternalServiceError("anthropic_web_fetch", f"Empty content for {url}")
        return FetchedContent(url=url, text=text, content_hash=_hash_content(text))


class TavilySearchProvider(SearchProvider):
    name = "tavily"
    _BASE_URL = "https://api.tavily.com"

    def __init__(self):
        settings = get_settings()
        if not settings.tavily_api_key:
            raise ExternalServiceError(
                "tavily", "TAVILY_API_KEY is not set (required for SEARCH_PROVIDER=tavily)"
            )
        self._api_key = settings.tavily_api_key

    @_retry_transient_http
    async def _post(self, path: str, json: dict, timeout: float) -> httpx.Response:
        async with httpx.AsyncClient(timeout=timeout) as client:
            return await client.post(f"{self._BASE_URL}{path}", json=json)

    async def search(self, query: str, max_results: int = 5) -> list[SearchResult]:
        try:
            resp = await self._post(
                "/search",
                {
                    "api_key": self._api_key,
                    "query": query,
                    "max_results": max_results,
                    "search_depth": "advanced",
                },
                timeout=20,
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise ExternalServiceError("tavily_search", str(exc)) from exc

        data = resp.json()
        return [
            SearchResult(url=r["url"], title=r.get("title", ""), snippet=r.get("content", ""))
            for r in data.get("results", [])
        ]

    async def fetch(self, url: str) -> FetchedContent:
        try:
            resp = await self._post(
                "/extract", {"api_key": self._api_key, "urls": [url]}, timeout=30
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise ExternalServiceError("tavily_extract", str(exc)) from exc

        data = resp.json()
        results = data.get("results", [])
        if not results:
            raise ExternalServiceError("tavily_extract", f"No content extracted for {url}")
        text = results[0].get("raw_content", "") or ""
        return FetchedContent(
            url=url,
            title=results[0].get("title"),
            text=text,
            content_hash=_hash_content(text),
        )


def get_search_provider() -> SearchProvider:
    settings = get_settings()
    if settings.search_provider == "tavily":
        return TavilySearchProvider()
    return AnthropicSearchProvider()
