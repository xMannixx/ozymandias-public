"""Application configuration via pydantic-settings."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables."""

    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/ozymandias"
    )
    jwt_secret: str = Field(default="change-me")
    jwt_algorithm: str = Field(default="HS256")
    jwt_expire_minutes: int = Field(default=60, ge=1)
    google_client_id: str = Field(default="")
    google_client_secret: str = Field(default="")
    google_redirect_uri: str = Field(default="http://localhost:8000/auth/google/callback")
    owner_email: str = Field(default="")
    owner_name: str = Field(default="")
    owner_profile: str = Field(default="")
    owner_language: str = Field(default="Deutsch")
    minio_endpoint: str = Field(default="minio:9000")
    minio_access_key: str = Field(default="pic_minio")
    minio_secret_key: str = Field(default="pic_minio_secret_change_me")
    minio_bucket: str = Field(default="ozy-files")
    minio_secure: bool = Field(default=False)
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    debug: bool = Field(default=False)
    auth_dev_bypass: bool = Field(default=False)
    redis_url: str = Field(default="redis://localhost:6379/0")
    cb_max_actions: int = Field(default=20, ge=1)
    cb_window_seconds: int = Field(default=60, ge=1)
    cb_cooldown_seconds: int = Field(default=120, ge=1)
    openai_api_key: str = Field(default="")
    deepseek_api_key: str = Field(default="")
    deepseek_base_url: str = Field(default="https://api.deepseek.com/v1")
    gemini_api_key: str = Field(default="")
    ollama_base_url: str = Field(default="http://localhost:11434")
    lmstudio_base_url: str = Field(default="http://localhost:1234/v1")
    deepseek_model: str = Field(default="deepseek-chat")
    gemini_model: str = Field(default="gemini-2.0-flash")
    openai_model: str = Field(default="gpt-4o")
    ollama_model: str = Field(default="llama3.1:8b")
    lmstudio_model: str = Field(default="")
    live_web_connector_url: str = Field(default="https://api.tavily.com/search")
    live_web_connector_api_key: str = Field(default="")
    live_web_connector_timeout_seconds: float = Field(default=8.0, ge=1.0, le=30.0)
    whisper_model: str = Field(default="whisper-1")
    tts_model: str = Field(default="tts-1")
    tts_voice: str = Field(default="alloy")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached settings instance."""
    return Settings()
