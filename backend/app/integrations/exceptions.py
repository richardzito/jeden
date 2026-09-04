class ExternalServiceError(Exception):
    """Raised when a third-party API (Anthropic, search, Deepgram,
    ElevenLabs) fails after retries. Callers must handle this explicitly
    (see spec section 11: no silent fallbacks)."""

    def __init__(self, service: str, message: str):
        self.service = service
        super().__init__(f"{service}: {message}")
