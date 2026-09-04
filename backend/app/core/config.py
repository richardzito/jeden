from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application configuration, loaded from environment variables.

    See `.env.example` at the repo root for the full list of variables and
    where to obtain each secret.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"
    log_level: str = "INFO"
    default_locale: str = "pl"
    cors_origins: str = "http://localhost:3000"

    # Anthropic
    anthropic_api_key: str = ""
    anthropic_model_haiku: str = "claude-haiku-4-5"
    anthropic_model_sonnet: str = "claude-sonnet-4-5"
    anthropic_model_opus: str = "claude-opus-4-1"

    # Web research
    search_provider: str = "anthropic"  # "anthropic" | "tavily"
    tavily_api_key: str = ""

    # STT / TTS
    deepgram_api_key: str = ""
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = ""

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    # Database / cache
    database_url: str = "postgresql+asyncpg://audiotutor:audiotutor@localhost:5432/audiotutor"
    redis_url: str = "redis://localhost:6379/0"

    # Observability
    sentry_dsn: str = ""

    # Auth
    dev_auth_bypass: bool = True

    # Research cache TTL, in days
    research_cache_ttl_days: int = 30

    # Hard limit on a single tutor utterance, enforced in code (section 1/7
    # of the spec: never just "an instruction in the prompt").
    tutor_max_sentences: int = 4
    tutor_max_chars: int = 420

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
