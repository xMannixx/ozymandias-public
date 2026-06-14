"""User settings business logic service."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import UserSettings
from app.services.utils import normalize_user_id


class SettingsService:
    """Load and mutate per-user runtime settings."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self._nullable_update_fields = {
            "cb_max_actions_override",
            "cb_window_seconds_override",
            "cb_cooldown_seconds_override",
            "preferred_provider",
            "preferred_model",
            "preferred_local_provider",
            "preferred_local_model",
            "openai_api_key",
            "deepseek_api_key",
            "gemini_api_key",
            "mistral_api_key",
            "anthropic_api_key",
        }

    async def get_or_create(self, user_id: str) -> UserSettings:
        """Return existing settings row or create defaults on first access."""
        normalized_user_id = str(normalize_user_id(user_id))
        stmt = select(UserSettings).where(UserSettings.user_id == normalized_user_id)
        result = await self.db.execute(stmt)
        settings = result.scalar_one_or_none()
        if settings is not None:
            return settings

        settings = UserSettings(user_id=normalized_user_id)
        self.db.add(settings)
        await self.db.commit()
        await self.db.refresh(settings)
        return settings

    async def update(self, user_id: str, **kwargs: Any) -> UserSettings:
        """Update only provided fields and bump updated timestamp."""
        settings = await self.get_or_create(user_id)
        for key, value in kwargs.items():
            if value is None and key not in self._nullable_update_fields:
                continue
            
            # API Key masking logic
            if key in {
                "openai_api_key",
                "deepseek_api_key",
                "gemini_api_key",
                "mistral_api_key",
                "anthropic_api_key",
            }:
                if value in {"••••••••", "********"}:
                    continue
                if value == "":
                    value = None

            if hasattr(settings, key):
                setattr(settings, key, value)
        settings.updated_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(settings)
        return settings
