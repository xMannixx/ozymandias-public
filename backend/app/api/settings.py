"""Runtime user settings endpoints."""

from __future__ import annotations

from typing import Literal, cast

from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import get_current_user
from app.database import get_db, get_redis
from app.models.settings import UserSettings
from app.schemas import AuditEventType, AuditResult, Channel, Sensitivity
from app.schemas.api_models import (
    KillSwitchRequest,
    ProviderLiteral,
    UpdateSettingsRequest,
    UserSettingsResponse,
)
from app.services.audit_service import AuditService
from app.services.circuit_breaker_service import CircuitBreakerService
from app.services.settings_service import SettingsService

router = APIRouter(tags=["settings"])
_PROVIDER_VALUES = {"deepseek", "openai", "ollama", "gemini", "lmstudio", "mistral", "anthropic"}
_LOCAL_PROVIDER_VALUES = {"ollama", "lmstudio"}
_LIVE_WEB_MODE_VALUES = {"provider_native_first", "connector_only", "off"}
_VOICE_MODE_VALUES = {"push_to_talk", "hands_free"}
_TTS_MODEL_VALUES = {"tts-1", "tts-1-hd"}


@router.get("", response_model=UserSettingsResponse)
async def get_user_settings(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettingsResponse:
    """Return user runtime settings, creating defaults on first access."""
    service = SettingsService(db)
    settings = await service.get_or_create(user_id)
    return _to_settings_response(settings)


@router.patch("", response_model=UserSettingsResponse)
async def update_settings(
    payload: UpdateSettingsRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettingsResponse:
    """Partially update runtime settings."""
    settings_service = SettingsService(db)
    audit_service = AuditService(db)
    existing = await settings_service.get_or_create(user_id)
    old_mode = existing.mode
    changes = payload.model_dump(exclude_unset=True)
    updated = await settings_service.update(user_id, **changes)

    mode = changes.get("mode")
    if isinstance(mode, str) and mode != old_mode:
        await audit_service.log(
            event_type=AuditEventType.manual_override,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.system,
            actor=f"user:{user_id}",
            target_id=updated.user_id,
            detail="Runtime mode changed",
            payload={"from": old_mode, "to": mode},
            source_ref=updated.user_id,
            sensitivity=Sensitivity.S1,
        )

    return _to_settings_response(updated)


@router.post("/kill-switch", response_model=UserSettingsResponse)
async def toggle_kill_switch(
    payload: KillSwitchRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> UserSettingsResponse:
    """Toggle kill-switch and force a circuit-breaker trip when enabled."""
    settings_service = SettingsService(db)
    audit_service = AuditService(db)
    updated = await settings_service.update(user_id, kill_switch=payload.active)

    breaker = CircuitBreakerService(db, redis_client=redis)
    if payload.active:
        await breaker.force_trip(user_id)

    await audit_service.log(
        event_type=AuditEventType.security_event,
        result=AuditResult.success,
        user_id=user_id,
        channel=Channel.system,
        actor=f"user:{user_id}",
        target_id=updated.user_id,
        detail="Kill switch toggled",
        payload={"active": payload.active},
        source_ref=updated.user_id,
        sensitivity=Sensitivity.S2,
    )
    return _to_settings_response(updated)


def _mask_key(key: str | None) -> str | None:
    if not key or not key.strip():
        return None
    return "••••••••"


def _to_settings_response(settings: UserSettings) -> UserSettingsResponse:
    preferred_provider = settings.preferred_provider
    if preferred_provider not in _PROVIDER_VALUES:
        preferred_provider = None
    preferred_local_provider = settings.preferred_local_provider
    if preferred_local_provider not in _LOCAL_PROVIDER_VALUES:
        preferred_local_provider = None
    typed_preferred_provider = cast(
        ProviderLiteral | None,
        preferred_provider,
    )
    typed_preferred_local_provider = cast(
        Literal["ollama", "lmstudio"] | None,
        preferred_local_provider,
    )
    voice_mode = (
        settings.voice_mode if settings.voice_mode in _VOICE_MODE_VALUES else "push_to_talk"
    )
    live_web_mode = (
        settings.live_web_mode
        if settings.live_web_mode in _LIVE_WEB_MODE_VALUES
        else "provider_native_first"
    )
    tts_model = settings.tts_model if settings.tts_model in _TTS_MODEL_VALUES else "tts-1"
    return UserSettingsResponse(
        mode=settings.mode,
        kill_switch=settings.kill_switch,
        decay_interval_hours=settings.decay_interval_hours,
        decay_confidence_threshold=settings.decay_confidence_threshold,
        cb_max_actions_override=settings.cb_max_actions_override,
        cb_window_seconds_override=settings.cb_window_seconds_override,
        cb_cooldown_seconds_override=settings.cb_cooldown_seconds_override,
        preferred_provider=typed_preferred_provider,
        preferred_model=settings.preferred_model,
        preferred_local_provider=typed_preferred_local_provider,
        preferred_local_model=settings.preferred_local_model,
        live_web_enabled=settings.live_web_enabled,
        live_web_mode=cast(
            Literal["provider_native_first", "connector_only", "off"],
            live_web_mode,
        ),
        live_web_s3_confirmed_default=settings.live_web_s3_confirmed_default,
        voice_enabled=settings.voice_enabled,
        voice_mode=cast(Literal["push_to_talk", "hands_free"], voice_mode),
        tts_voice=settings.tts_voice,
        tts_model=cast(Literal["tts-1", "tts-1-hd"], tts_model),
        tts_autoplay=settings.tts_autoplay,
        openai_api_key=_mask_key(settings.openai_api_key),
        deepseek_api_key=_mask_key(settings.deepseek_api_key),
        gemini_api_key=_mask_key(settings.gemini_api_key),
        mistral_api_key=_mask_key(settings.mistral_api_key),
        anthropic_api_key=_mask_key(settings.anthropic_api_key),
        updated_at=settings.updated_at,
    )
