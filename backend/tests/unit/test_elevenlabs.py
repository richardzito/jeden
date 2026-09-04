import httpx
import pytest
import respx

from app.integrations.elevenlabs import stream_speech
from app.integrations.exceptions import ExternalServiceError


@pytest.mark.asyncio
async def test_stream_speech_yields_chunks(monkeypatch):
    monkeypatch.setenv("ELEVENLABS_API_KEY", "fake-key")
    monkeypatch.setenv("ELEVENLABS_VOICE_ID", "voice123")
    from app.core.config import get_settings

    get_settings.cache_clear()

    with respx.mock(base_url="https://api.elevenlabs.io") as mock:
        mock.post("/v1/text-to-speech/voice123/stream").mock(
            return_value=httpx.Response(200, content=b"\x00\x01\x02\x03")
        )
        chunks = [c async for c in stream_speech("Cześć, jak się masz?")]

    assert b"".join(chunks) == b"\x00\x01\x02\x03"
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_stream_speech_missing_key_raises(monkeypatch):
    monkeypatch.setenv("ELEVENLABS_API_KEY", "")
    from app.core.config import get_settings

    get_settings.cache_clear()
    with pytest.raises(ExternalServiceError):
        async for _ in stream_speech("hi"):
            pass
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_stream_speech_http_error_raises(monkeypatch):
    monkeypatch.setenv("ELEVENLABS_API_KEY", "fake-key")
    monkeypatch.setenv("ELEVENLABS_VOICE_ID", "voice123")
    from app.core.config import get_settings

    get_settings.cache_clear()
    with respx.mock(base_url="https://api.elevenlabs.io") as mock:
        mock.post("/v1/text-to-speech/voice123/stream").mock(return_value=httpx.Response(401))
        with pytest.raises(ExternalServiceError):
            async for _ in stream_speech("hi"):
                pass
    get_settings.cache_clear()
