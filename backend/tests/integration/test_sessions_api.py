"""HTTP-level test of the session endpoints, reusing the seeded
concept+beats helper from test_session_service.py."""

import httpx
import pytest

from app.main import app
from tests.integration.test_session_service import _seed_topic_with_one_concept


@pytest.mark.asyncio
async def test_session_rest_lifecycle(db_session, monkeypatch):
    user, topic, concept = await _seed_topic_with_one_concept(db_session)
    dev_header = {"X-Dev-User-Id": str(user.id)}

    from tests.unit._llm_mocks import fake_tool_response
    from unittest.mock import AsyncMock

    import app.api.sessions as sessions_module

    original_init = sessions_module.AnthropicClient

    def _patched_client(*args, **kwargs):
        client = original_init(*args, **kwargs)
        client._client.messages.create = AsyncMock(
            return_value=fake_tool_response(
                {
                    "key_points_hit": ["Popyt spada"],
                    "key_points_missed": [],
                    "correctness": 1.0,
                    "llm_confidence": 1.0,
                    "misconception": None,
                    "feedback_text": "Świetnie!",
                }
            )
        )
        return client

    monkeypatch.setattr(sessions_module, "AnthropicClient", _patched_client)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        create_resp = await client.post(
            "/api/sessions", json={"topic_id": str(topic.id), "type": "learn"}, headers=dev_header
        )
        assert create_resp.status_code == 201
        body = create_resp.json()
        session_id = body["session_id"]
        assert [t["turn_type"] for t in body["turns"]] == ["explain", "question"]

        answer_resp = await client.post(
            f"/api/sessions/{session_id}/answer",
            json={"transcript": "Popyt spada, gdy cena rośnie."},
            headers=dev_header,
        )
        assert answer_resp.status_code == 200
        answer_body = answer_resp.json()
        assert answer_body["turns"][-1]["session_complete"] is True

        # Session already auto-completed; end_session should be a no-op, not an error.
        end_resp = await client.post(f"/api/sessions/{session_id}/end", headers=dev_header)
        assert end_resp.status_code == 200


@pytest.mark.asyncio
async def test_create_session_for_topic_owned_by_other_user_404s(db_session):
    user, topic, concept = await _seed_topic_with_one_concept(db_session)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/sessions",
            json={"topic_id": str(topic.id), "type": "learn"},
            headers={"X-Dev-User-Id": "00000000-0000-0000-0000-0000000000ff"},
        )
        assert resp.status_code == 404
