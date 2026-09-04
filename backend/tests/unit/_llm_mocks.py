"""Shared helpers for building fake Anthropic SDK responses in tests."""

from types import SimpleNamespace
from unittest.mock import AsyncMock


def fake_usage(input_tokens=10, output_tokens=5):
    return SimpleNamespace(input_tokens=input_tokens, output_tokens=output_tokens)


def fake_tool_response(tool_input: dict):
    block = SimpleNamespace(type="tool_use", input=tool_input)
    return SimpleNamespace(content=[block], usage=fake_usage())


def mock_structured_calls(client, responses: list[dict]):
    """Patches client._client.messages.create to return each dict in
    `responses` (as a tool_use response), in call order."""
    mock = AsyncMock(side_effect=[fake_tool_response(r) for r in responses])
    client._client.messages.create = mock
    return mock
