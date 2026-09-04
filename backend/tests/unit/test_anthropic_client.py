from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import BaseModel

from app.integrations.anthropic_client import AnthropicClient, ModelTier
from app.integrations.exceptions import ExternalServiceError


class Echo(BaseModel):
    message: str
    confidence: float


def _fake_usage(input_tokens=10, output_tokens=5):
    return SimpleNamespace(input_tokens=input_tokens, output_tokens=output_tokens)


def _fake_tool_response(tool_input: dict):
    block = SimpleNamespace(type="tool_use", input=tool_input)
    return SimpleNamespace(content=[block], usage=_fake_usage())


def _fake_text_response(text: str):
    block = SimpleNamespace(type="text", text=text)
    return SimpleNamespace(content=[block], usage=_fake_usage())


@pytest.mark.asyncio
async def test_structured_call_happy_path(db_session):
    client = AnthropicClient(db=db_session)
    client._client.messages.create = AsyncMock(
        return_value=_fake_tool_response({"message": "hello", "confidence": 0.9})
    )

    result = await client.structured_call(
        agent_name="test_agent",
        tier=ModelTier.haiku,
        system="sys",
        user_message="hi",
        response_model=Echo,
    )

    assert result.message == "hello"
    assert result.confidence == 0.9
    client._client.messages.create.assert_awaited_once()
    _, kwargs = client._client.messages.create.call_args
    assert kwargs["tool_choice"] == {"type": "tool", "name": "emit_echo"}


@pytest.mark.asyncio
async def test_structured_call_logs_llm_call_row(db_session):
    from sqlalchemy import select

    from app.models.models import LlmCall

    client = AnthropicClient(db=db_session)
    client._client.messages.create = AsyncMock(
        return_value=_fake_tool_response({"message": "hi", "confidence": 0.5})
    )
    await client.structured_call(
        agent_name="cost_test_agent",
        tier=ModelTier.sonnet,
        system="sys",
        user_message="hi",
        response_model=Echo,
    )

    rows = (
        (
            await db_session.execute(
                select(LlmCall).where(LlmCall.agent_name == "cost_test_agent")
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 1
    assert rows[0].input_tokens == 10
    assert rows[0].output_tokens == 5
    assert rows[0].cost_usd > 0


@pytest.mark.asyncio
async def test_structured_call_no_tool_use_raises(db_session):
    client = AnthropicClient(db=db_session)
    client._client.messages.create = AsyncMock(
        return_value=SimpleNamespace(content=[], usage=_fake_usage())
    )

    with pytest.raises(ExternalServiceError):
        await client.structured_call(
            agent_name="test_agent",
            tier=ModelTier.haiku,
            system="sys",
            user_message="hi",
            response_model=Echo,
        )


@pytest.mark.asyncio
async def test_text_call_returns_plain_text(db_session):
    client = AnthropicClient(db=db_session)
    client._client.messages.create = AsyncMock(return_value=_fake_text_response("Cześć!"))

    result = await client.text_call(
        agent_name="tutor",
        tier=ModelTier.sonnet,
        system="sys",
        user_message="hi",
    )
    assert result == "Cześć!"
