"""User runtime settings SQLAlchemy model."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class UserSettings(Base):
    """Per-user runtime settings for mode and operational safeguards."""

    __tablename__ = "user_settings"

    user_id: Mapped[str] = mapped_column(Text, primary_key=True)
    mode: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'guardian'"))
    kill_switch: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    decay_interval_hours: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("24")
    )
    decay_confidence_threshold: Mapped[float] = mapped_column(
        Float, nullable=False, server_default=text("0.1")
    )
    cb_max_actions_override: Mapped[int | None] = mapped_column(Integer)
    cb_window_seconds_override: Mapped[int | None] = mapped_column(Integer)
    cb_cooldown_seconds_override: Mapped[int | None] = mapped_column(Integer)
    preferred_provider: Mapped[str | None] = mapped_column(Text)
    preferred_model: Mapped[str | None] = mapped_column(Text)
    preferred_local_provider: Mapped[str | None] = mapped_column(Text)
    preferred_local_model: Mapped[str | None] = mapped_column(Text)
    live_web_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
    )
    live_web_mode: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default=text("'provider_native_first'"),
    )
    live_web_s3_confirmed_default: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
    )
    voice_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
    )
    voice_mode: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default=text("'push_to_talk'"),
    )
    tts_voice: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'ash'"))
    tts_model: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'tts-1'"))
    tts_autoplay: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    briefing_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
    )
    #: Hour of day in UTC, because Celery beat runs in UTC.
    briefing_hour: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("7"))
    openai_api_key: Mapped[str | None] = mapped_column(Text)
    deepseek_api_key: Mapped[str | None] = mapped_column(Text)
    gemini_api_key: Mapped[str | None] = mapped_column(Text)
    mistral_api_key: Mapped[str | None] = mapped_column(Text)
    anthropic_api_key: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
