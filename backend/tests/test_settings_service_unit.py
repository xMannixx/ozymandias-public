"""Unit tests for SettingsService – covers DB-interaction paths."""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.settings_service import SettingsService
from tests.conftest import FakeAsyncSession, FakeQueryResult


def _user_settings(user_id: str = "user-1") -> SimpleNamespace:
    return SimpleNamespace(
        user_id=user_id,
        mode="guardian",
        kill_switch=False,
        decay_interval_hours=24,
        decay_confidence_threshold=0.1,
        cb_max_actions_override=None,
        cb_window_seconds_override=None,
        cb_cooldown_seconds_override=None,
        preferred_provider=None,
        preferred_model=None,
        preferred_local_provider=None,
        preferred_local_model=None,
        voice_enabled=False,
        voice_mode="push_to_talk",
        tts_voice="ash",
        tts_model="tts-1",
        tts_autoplay=True,
        updated_at=datetime.now(tz=UTC),
    )


@pytest.mark.asyncio
async def test_get_or_create_returns_existing_settings() -> None:
    """When DB returns an existing settings row, it is returned as-is."""
    db = FakeAsyncSession()
    existing = _user_settings()
    db.queue_execute_result(FakeQueryResult(single=existing))
    service = SettingsService(cast(AsyncSession, db))
    result = await service.get_or_create("user-1")
    assert result.user_id == existing.user_id
    assert db.commits == 0


@pytest.mark.asyncio
async def test_get_or_create_creates_new_settings_when_none() -> None:
    """When DB returns None, a new row is inserted and committed."""
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=None))
    service = SettingsService(cast(AsyncSession, db))
    result = await service.get_or_create("user-1")
    assert isinstance(result.user_id, str)
    assert db.commits == 1


@pytest.mark.asyncio
async def test_update_modifies_allowed_fields() -> None:
    """update() sets provided fields and bumps updated_at."""
    db = FakeAsyncSession()
    existing = _user_settings()
    # get_or_create calls execute once
    db.queue_execute_result(FakeQueryResult(single=existing))
    service = SettingsService(cast(AsyncSession, db))
    result = await service.update("user-1", mode="autopilot")
    assert result.mode == "autopilot"
    assert db.commits == 1


@pytest.mark.asyncio
async def test_update_skips_none_for_non_nullable_fields() -> None:
    """update() ignores None values for fields not in the nullable set."""
    db = FakeAsyncSession()
    existing = _user_settings()
    db.queue_execute_result(FakeQueryResult(single=existing))
    service = SettingsService(cast(AsyncSession, db))
    result = await service.update("user-1", mode=None, preferred_provider=None)
    # mode should not be changed (not in nullable set), preferred_provider CAN be None
    assert result.mode == "guardian"
    assert result.preferred_provider is None


@pytest.mark.asyncio
async def test_update_allows_null_for_nullable_fields() -> None:
    """update() sets nullable fields to None when explicitly provided."""
    db = FakeAsyncSession()
    existing = _user_settings()
    existing.preferred_provider = "openai"
    db.queue_execute_result(FakeQueryResult(single=existing))
    service = SettingsService(cast(AsyncSession, db))
    result = await service.update("user-1", preferred_provider=None)
    assert result.preferred_provider is None
