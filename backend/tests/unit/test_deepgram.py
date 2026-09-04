import httpx
import pytest
import respx

from app.integrations.deepgram import create_temporary_token
from app.integrations.exceptions import ExternalServiceError


@pytest.mark.asyncio
async def test_create_temporary_token_happy_path(monkeypatch):
    monkeypatch.setenv("DEEPGRAM_API_KEY", "fake-dg-key")
    from app.core.config import get_settings

    get_settings.cache_clear()

    with respx.mock(base_url="https://api.deepgram.com") as mock:
        mock.post("/v1/auth/grant").mock(
            return_value=httpx.Response(200, json={"access_token": "tok123", "expires_in": 60})
        )
        token = await create_temporary_token(ttl_seconds=60)

    assert token.access_token == "tok123"
    assert token.expires_in == 60
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_create_temporary_token_missing_key(monkeypatch):
    monkeypatch.setenv("DEEPGRAM_API_KEY", "")
    from app.core.config import get_settings

    get_settings.cache_clear()
    with pytest.raises(ExternalServiceError):
        await create_temporary_token()
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_create_temporary_token_http_error(monkeypatch):
    monkeypatch.setenv("DEEPGRAM_API_KEY", "fake-dg-key")
    from app.core.config import get_settings

    get_settings.cache_clear()
    with respx.mock(base_url="https://api.deepgram.com") as mock:
        mock.post("/v1/auth/grant").mock(return_value=httpx.Response(401))
        with pytest.raises(ExternalServiceError):
            await create_temporary_token()
    get_settings.cache_clear()
