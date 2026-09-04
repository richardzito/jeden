"""HTTP-level test of the topic endpoints, using the dev auth bypass. Only
exercises the intake side (topic creation + status/sources reads) -- the
actual research pipeline runs out-of-process via arq and is covered by
tests/integration/test_research_pipeline.py directly."""

import httpx
import pytest

from app.main import app


@pytest.mark.asyncio
async def test_create_and_fetch_topic(db_session):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        create_resp = await client.post(
            "/api/topics",
            json={"raw_query": "Jak dziala silnik spalinowy?"},
            headers={"X-Dev-User-Id": "00000000-0000-0000-0000-0000000000aa"},
        )
        assert create_resp.status_code == 201
        body = create_resp.json()
        assert body["status"] == "researching"
        topic_id = body["topic_id"]

        get_resp = await client.get(
            f"/api/topics/{topic_id}",
            headers={"X-Dev-User-Id": "00000000-0000-0000-0000-0000000000aa"},
        )
        assert get_resp.status_code == 200
        topic_body = get_resp.json()
        assert topic_body["raw_query"] == "Jak dziala silnik spalinowy?"
        assert topic_body["concepts"] == []

        sources_resp = await client.get(
            f"/api/topics/{topic_id}/sources",
            headers={"X-Dev-User-Id": "00000000-0000-0000-0000-0000000000aa"},
        )
        assert sources_resp.status_code == 200
        assert sources_resp.json() == []


@pytest.mark.asyncio
async def test_get_topic_wrong_user_returns_404(db_session):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        create_resp = await client.post(
            "/api/topics",
            json={"raw_query": "Temat prywatny"},
            headers={"X-Dev-User-Id": "00000000-0000-0000-0000-0000000000bb"},
        )
        topic_id = create_resp.json()["topic_id"]

        get_resp = await client.get(
            f"/api/topics/{topic_id}",
            headers={"X-Dev-User-Id": "00000000-0000-0000-0000-0000000000cc"},
        )
        assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_create_topic_requires_auth_when_bypass_disabled(db_session, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setenv("DEV_AUTH_BYPASS", "false")
    get_settings.cache_clear()
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/topics", json={"raw_query": "Cokolwiek"})
        assert resp.status_code == 401
    finally:
        monkeypatch.setenv("DEV_AUTH_BYPASS", "true")
        get_settings.cache_clear()
