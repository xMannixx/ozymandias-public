"""API tests for settings and kill-switch endpoints."""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.auth.jwt import get_current_user
from app.models.settings import UserSettings
from app.services.audit_service import AuditService
from app.services.circuit_breaker_service import CircuitBreakerService
from app.services.settings_service import SettingsService


def _settings(
    *,
    mode: str = "guardian",
    kill_switch: bool = False,
    preferred_provider: str | None = None,
    preferred_model: str | None = None,
    live_web_enabled: bool = False,
    live_web_mode: str = "provider_native_first",
    live_web_s3_confirmed_default: bool = False,
    voice_enabled: bool = False,
    voice_mode: str = "push_to_talk",
    tts_voice: str = "ash",
    tts_model: str = "tts-1",
    tts_autoplay: bool = True,
    briefing_enabled: bool = True,
    briefing_hour: int = 7,
) -> UserSettings:
    return UserSettings(
        user_id="user-1",
        mode=mode,
        kill_switch=kill_switch,
        decay_interval_hours=24,
        decay_confidence_threshold=0.1,
        cb_max_actions_override=None,
        cb_window_seconds_override=None,
        cb_cooldown_seconds_override=None,
        preferred_provider=preferred_provider,
        preferred_model=preferred_model,
        preferred_local_provider=None,
        preferred_local_model=None,
        live_web_enabled=live_web_enabled,
        live_web_mode=live_web_mode,
        live_web_s3_confirmed_default=live_web_s3_confirmed_default,
        voice_enabled=voice_enabled,
        voice_mode=voice_mode,
        tts_voice=tts_voice,
        tts_model=tts_model,
        tts_autoplay=tts_autoplay,
        briefing_enabled=briefing_enabled,
        briefing_hour=briefing_hour,
        updated_at=datetime.now(tz=UTC),
    )


@pytest.mark.asyncio
async def test_get_settings_returns_defaults(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        SettingsService,
        "get_or_create",
        AsyncMock(return_value=_settings()),
    )
    response = await client.get("/settings")
    assert response.status_code == 200
    assert response.json()["mode"] == "guardian"
    assert response.json()["preferred_provider"] is None
    assert response.json()["preferred_model"] is None
    assert response.json()["voice_enabled"] is False
    assert response.json()["voice_mode"] == "push_to_talk"
    assert response.json()["tts_model"] == "tts-1"


@pytest.mark.asyncio
async def test_patch_settings_partial_update_only_mode(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_update(self: SettingsService, user_id: str, **kwargs: object) -> UserSettings:
        del self
        assert user_id == "test-user-id"
        assert kwargs == {"mode": "autopilot"}
        return _settings(mode="autopilot")

    monkeypatch.setattr(SettingsService, "get_or_create", AsyncMock(return_value=_settings()))
    monkeypatch.setattr(SettingsService, "update", fake_update)
    monkeypatch.setattr(AuditService, "log", AsyncMock())
    response = await client.patch("/settings", json={"mode": "autopilot"})
    assert response.status_code == 200
    assert response.json()["mode"] == "autopilot"


@pytest.mark.asyncio
async def test_patch_settings_mode_transition_guardian_to_autopilot(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(SettingsService, "get_or_create", AsyncMock(return_value=_settings()))
    monkeypatch.setattr(
        SettingsService,
        "update",
        AsyncMock(return_value=_settings(mode="autopilot")),
    )
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.patch("/settings", json={"mode": "autopilot"})
    assert response.status_code == 200
    assert response.json()["mode"] == "autopilot"


@pytest.mark.asyncio
async def test_patch_settings_updates_preferred_provider_and_model(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_update(self: SettingsService, user_id: str, **kwargs: object) -> UserSettings:
        del self
        assert user_id == "test-user-id"
        assert kwargs == {"preferred_provider": "openai", "preferred_model": "gpt-4o"}
        return _settings(preferred_provider="openai", preferred_model="gpt-4o")

    monkeypatch.setattr(SettingsService, "get_or_create", AsyncMock(return_value=_settings()))
    monkeypatch.setattr(SettingsService, "update", fake_update)
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.patch(
        "/settings",
        json={"preferred_provider": "openai", "preferred_model": "gpt-4o"},
    )
    assert response.status_code == 200
    assert response.json()["preferred_provider"] == "openai"
    assert response.json()["preferred_model"] == "gpt-4o"


@pytest.mark.asyncio
async def test_patch_settings_updates_live_web_flags(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_update(self: SettingsService, user_id: str, **kwargs: object) -> UserSettings:
        del self
        assert user_id == "test-user-id"
        assert kwargs == {
            "live_web_enabled": True,
            "live_web_mode": "provider_native_first",
            "live_web_s3_confirmed_default": False,
        }
        return _settings(
            live_web_enabled=True,
            live_web_mode="provider_native_first",
            live_web_s3_confirmed_default=False,
        )

    monkeypatch.setattr(SettingsService, "get_or_create", AsyncMock(return_value=_settings()))
    monkeypatch.setattr(SettingsService, "update", fake_update)
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.patch(
        "/settings",
        json={
            "live_web_enabled": True,
            "live_web_mode": "provider_native_first",
            "live_web_s3_confirmed_default": False,
        },
    )
    assert response.status_code == 200
    assert response.json()["live_web_enabled"] is True
    assert response.json()["live_web_mode"] == "provider_native_first"
    assert response.json()["live_web_s3_confirmed_default"] is False


@pytest.mark.asyncio
async def test_patch_settings_updates_the_briefing_schedule(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_update(self: SettingsService, user_id: str, **kwargs: object) -> UserSettings:
        del self, user_id
        assert kwargs == {"briefing_enabled": True, "briefing_hour": 6}
        return _settings(briefing_enabled=True, briefing_hour=6)

    monkeypatch.setattr(SettingsService, "get_or_create", AsyncMock(return_value=_settings()))
    monkeypatch.setattr(SettingsService, "update", fake_update)
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.patch(
        "/settings",
        json={"briefing_enabled": True, "briefing_hour": 6},
    )

    assert response.status_code == 200
    assert response.json()["briefing_hour"] == 6


@pytest.mark.asyncio
async def test_patch_settings_rejects_a_briefing_hour_outside_the_day(
    client: AsyncClient,
) -> None:
    response = await client.patch("/settings", json={"briefing_hour": 24})

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_patch_settings_rejects_invalid_mode(client: AsyncClient) -> None:
    response = await client.patch("/settings", json={"mode": "invalid"})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_post_kill_switch_activates_flag(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        SettingsService,
        "update",
        AsyncMock(return_value=_settings(kill_switch=True)),
    )
    monkeypatch.setattr(CircuitBreakerService, "force_trip", AsyncMock())
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.post("/settings/kill-switch", json={"active": True})
    assert response.status_code == 200
    assert response.json()["kill_switch"] is True


@pytest.mark.asyncio
async def test_post_kill_switch_writes_audit_security_event(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    audit_log = AsyncMock()
    monkeypatch.setattr(
        SettingsService,
        "update",
        AsyncMock(return_value=_settings(kill_switch=True)),
    )
    monkeypatch.setattr(CircuitBreakerService, "force_trip", AsyncMock())
    monkeypatch.setattr(AuditService, "log", audit_log)

    response = await client.post("/settings/kill-switch", json={"active": True})
    assert response.status_code == 200
    assert audit_log.await_count == 1
    await_args = audit_log.await_args
    assert await_args is not None
    assert await_args.kwargs["event_type"].value == "security_event"


@pytest.mark.asyncio
async def test_kill_switch_active_blocks_turn_endpoint(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        SettingsService,
        "get_or_create",
        AsyncMock(return_value=_settings(kill_switch=True)),
    )
    monkeypatch.setattr(AuditService, "log", AsyncMock(return_value=SimpleNamespace()))

    response = await client.post("/turns", json={"text": "hello", "claims": []})
    assert response.status_code == 423


@pytest.mark.asyncio
async def test_get_settings_without_auth_returns_401(app: FastAPI) -> None:
    app.dependency_overrides.pop(get_current_user, None)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/settings")
    assert response.status_code == 401
