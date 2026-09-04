"""Thin wrapper around the Anthropic SDK that:

- routes each call to the right model tier (haiku/sonnet/opus) per spec
  section 3/10 ("dobieraj model do zadania"),
- forces structured (JSON) output via a synthetic forced tool call and
  validates it against a Pydantic model,
- logs every call (tokens, latency, approximate cost) to `llm_calls` so
  cost can be analyzed per agent/session later,
- wraps transient failures in retries and raises `ExternalServiceError`
  on exhaustion instead of failing silently.
"""

import time
from enum import Enum
from typing import TypeVar

import anthropic
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import get_settings
from app.core.logging import get_logger
from app.integrations.exceptions import ExternalServiceError
from app.models.models import LlmCall

logger = get_logger(__name__)

T = TypeVar("T", bound=BaseModel)

# Approximate list pricing, USD per million tokens. Used only for the
# llm_calls cost estimate shown in the dashboard -- not billing-accurate.
_PRICING_PER_MTOK = {
    "haiku": {"input": 0.80, "output": 4.00},
    "sonnet": {"input": 3.00, "output": 15.00},
    "opus": {"input": 15.00, "output": 75.00},
}

_RETRYABLE = (
    anthropic.APIConnectionError,
    anthropic.RateLimitError,
    anthropic.InternalServerError,
)


class ModelTier(str, Enum):
    haiku = "haiku"
    sonnet = "sonnet"
    opus = "opus"


class AnthropicClient:
    def __init__(self, db: AsyncSession | None = None):
        settings = get_settings()
        self._settings = settings
        self._db = db
        self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    def _model_for_tier(self, tier: ModelTier) -> str:
        return {
            ModelTier.haiku: self._settings.anthropic_model_haiku,
            ModelTier.sonnet: self._settings.anthropic_model_sonnet,
            ModelTier.opus: self._settings.anthropic_model_opus,
        }[tier]

    async def _log_call(
        self,
        *,
        agent_name: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        latency_ms: int,
        topic_id=None,
        session_id=None,
    ) -> None:
        tier = "sonnet"
        for t, name in (
            ("haiku", self._settings.anthropic_model_haiku),
            ("sonnet", self._settings.anthropic_model_sonnet),
            ("opus", self._settings.anthropic_model_opus),
        ):
            if name == model:
                tier = t
        pricing = _PRICING_PER_MTOK.get(tier, _PRICING_PER_MTOK["sonnet"])
        cost = (input_tokens / 1_000_000) * pricing["input"] + (
            output_tokens / 1_000_000
        ) * pricing["output"]

        logger.info(
            "llm_call",
            agent_name=agent_name,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=round(cost, 6),
            latency_ms=latency_ms,
        )

        if self._db is not None:
            self._db.add(
                LlmCall(
                    agent_name=agent_name,
                    model=model,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost_usd=round(cost, 6),
                    latency_ms=latency_ms,
                    topic_id=topic_id,
                    session_id=session_id,
                )
            )
            await self._db.commit()

    @retry(
        retry=retry_if_exception_type(_RETRYABLE),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        reraise=True,
    )
    async def _create(self, **kwargs):
        return await self._client.messages.create(**kwargs)

    async def structured_call(
        self,
        *,
        agent_name: str,
        tier: ModelTier,
        system: str,
        user_message: str,
        response_model: type[T],
        max_tokens: int = 4096,
        topic_id=None,
        session_id=None,
    ) -> T:
        """Call Claude and force a single tool call whose input matches
        `response_model`, returning the validated model instance."""
        model = self._model_for_tier(tier)
        schema = response_model.model_json_schema()
        tool_name = f"emit_{response_model.__name__.lower()}"

        started = time.monotonic()
        try:
            response = await self._create(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user_message}],
                tools=[
                    {
                        "name": tool_name,
                        "description": f"Emit a {response_model.__name__} object.",
                        "input_schema": schema,
                    }
                ],
                tool_choice={"type": "tool", "name": tool_name},
            )
        except anthropic.APIError as exc:
            logger.error("anthropic_call_failed", agent_name=agent_name, error=str(exc))
            raise ExternalServiceError("anthropic", str(exc)) from exc

        latency_ms = int((time.monotonic() - started) * 1000)
        await self._log_call(
            agent_name=agent_name,
            model=model,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            latency_ms=latency_ms,
            topic_id=topic_id,
            session_id=session_id,
        )

        tool_use_blocks = [b for b in response.content if b.type == "tool_use"]
        if not tool_use_blocks:
            raise ExternalServiceError("anthropic", "No tool_use block in response")
        return response_model.model_validate(tool_use_blocks[0].input)

    async def text_call(
        self,
        *,
        agent_name: str,
        tier: ModelTier,
        system: str,
        user_message: str,
        max_tokens: int = 1024,
        topic_id=None,
        session_id=None,
    ) -> str:
        """Plain text completion, used for the live Tutor dialogue where we
        want free-form (but length-limited, enforced in app/agents/tutor.py)
        natural language rather than structured JSON."""
        model = self._model_for_tier(tier)
        started = time.monotonic()
        try:
            response = await self._create(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user_message}],
            )
        except anthropic.APIError as exc:
            logger.error("anthropic_call_failed", agent_name=agent_name, error=str(exc))
            raise ExternalServiceError("anthropic", str(exc)) from exc

        latency_ms = int((time.monotonic() - started) * 1000)
        await self._log_call(
            agent_name=agent_name,
            model=model,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            latency_ms=latency_ms,
            topic_id=topic_id,
            session_id=session_id,
        )

        text_blocks = [b.text for b in response.content if b.type == "text"]
        return "".join(text_blocks).strip()
