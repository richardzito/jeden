"""Deepgram integration: mints short-lived tokens for the browser so the
raw DEEPGRAM_API_KEY never reaches the client, per Deepgram's "grant token"
flow (POST /v1/auth/grant with the long-lived key in the Authorization
header, returns a token valid for a few seconds/minutes).
"""

import httpx
from pydantic import BaseModel
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.integrations.exceptions import ExternalServiceError

_GRANT_URL = "https://api.deepgram.com/v1/auth/grant"

# Only retry genuinely transient (network-level) failures. A definite HTTP
# error response (e.g. 401 invalid key) or a missing-config error should
# surface immediately rather than being retried 3x.
_retry_transient = retry(
    retry=retry_if_exception_type(httpx.TransportError),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
)


class DeepgramToken(BaseModel):
    access_token: str
    expires_in: int


async def create_temporary_token(ttl_seconds: int = 60) -> DeepgramToken:
    settings = get_settings()
    if not settings.deepgram_api_key:
        raise ExternalServiceError("deepgram", "DEEPGRAM_API_KEY is not configured")

    try:
        resp = await _request_grant(settings.deepgram_api_key, ttl_seconds)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise ExternalServiceError("deepgram_grant", str(exc)) from exc

    data = resp.json()
    return DeepgramToken(access_token=data["access_token"], expires_in=data.get("expires_in", ttl_seconds))


@_retry_transient
async def _request_grant(api_key: str, ttl_seconds: int) -> httpx.Response:
    async with httpx.AsyncClient(timeout=10) as client:
        return await client.post(
            _GRANT_URL,
            headers={"Authorization": f"Token {api_key}"},
            json={"ttl_seconds": ttl_seconds},
        )
