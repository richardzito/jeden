"""ElevenLabs streaming TTS wrapper. Yields raw MP3 chunks as they arrive so
the WebSocket session handler can forward audio to the browser with minimal
added latency, instead of waiting for the full utterance to synthesize."""

from collections.abc import AsyncIterator

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger
from app.integrations.exceptions import ExternalServiceError

logger = get_logger(__name__)

_BASE_URL = "https://api.elevenlabs.io/v1"


async def stream_speech(
    text: str, *, voice_id: str | None = None, model_id: str = "eleven_multilingual_v2"
) -> AsyncIterator[bytes]:
    settings = get_settings()
    if not settings.elevenlabs_api_key:
        raise ExternalServiceError("elevenlabs", "ELEVENLABS_API_KEY is not configured")

    voice = voice_id or settings.elevenlabs_voice_id
    if not voice:
        raise ExternalServiceError("elevenlabs", "No ElevenLabs voice_id configured")

    url = f"{_BASE_URL}/text-to-speech/{voice}/stream"
    headers = {"xi-api-key": settings.elevenlabs_api_key, "Content-Type": "application/json"}
    payload = {
        "text": text,
        "model_id": model_id,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                if response.status_code >= 400:
                    body = await response.aread()
                    raise ExternalServiceError(
                        "elevenlabs", f"HTTP {response.status_code}: {body[:200]!r}"
                    )
                async for chunk in response.aiter_bytes():
                    if chunk:
                        yield chunk
    except httpx.HTTPError as exc:
        logger.error("elevenlabs_stream_failed", error=str(exc))
        raise ExternalServiceError("elevenlabs", str(exc)) from exc
