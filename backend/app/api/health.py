"""Health endpoints."""

from importlib import import_module
from typing import Literal, cast

import httpx
from fastapi import APIRouter, Depends, Header, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import text

from app.config import get_settings
from app.database import get_db, get_redis
from app.schemas.api_models import (
    HealthResponse,
    LiveWebHealth,
    LLMProviderHealth,
    LLMProviderTokenUsage,
)
from app.services.llm.router import get_llm_router
from app.services.llm.token_usage_tracker import get_token_usage_tracker

router = APIRouter(tags=["health"])

KNOWN_LLM_PROVIDERS = (
    "ollama",
    "lmstudio",
    "deepseek",
    "openai",
    "gemini",
    "mistral",
    "anthropic",
    "openrouter",
)
LOCAL_LLM_PROVIDERS = {"ollama", "lmstudio"}


def _configured_providers(user_settings: object | None, active: set[str]) -> set[str]:
    """Providers this user can pick right now.

    A cloud provider counts as soon as a key exists, in the environment or in
    the user's settings. Asking the router instead would hide every key entered
    through the UI, because it only instantiates env-configured providers at
    startup — and it keeps the ones a single request registered long after that
    key was deleted.
    """
    settings = get_settings()
    configured = active & LOCAL_LLM_PROVIDERS
    for name in KNOWN_LLM_PROVIDERS:
        if name in LOCAL_LLM_PROVIDERS:
            continue
        field = f"{name}_api_key"
        keys = (getattr(settings, field, None), getattr(user_settings, field, None))
        if any(key and key.strip() for key in keys):
            configured.add(name)
    return configured


async def _get_provider_runtime_status(
    provider_name: str,
) -> tuple[Literal["ok", "unavailable", "configured"], str | None]:
    """Return live runtime health for providers that can be probed."""
    settings = get_settings()
    if provider_name == "ollama":
        probe_url = f"{settings.ollama_base_url.rstrip('/')}/api/tags"
    elif provider_name == "lmstudio":
        probe_url = f"{settings.lmstudio_base_url.rstrip('/')}/models"
    else:
        return "configured", None

    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            response = await client.get(probe_url)
            response.raise_for_status()
        return "ok", None
    except Exception:
        return "unavailable", f"{provider_name} API unreachable"


@router.get("/health", status_code=status.HTTP_200_OK, response_model=HealthResponse)
async def health(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    authorization: str | None = Header(default=None),
) -> HealthResponse:
    await db.execute(text("SELECT 1"))

    user_settings = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            from app.auth.jwt import decode_access_token

            payload = decode_access_token(token)
            user_id = payload.get("sub")
            if user_id:
                from app.services.settings_service import SettingsService

                user_settings = await SettingsService(db).get_or_create(user_id)
        except Exception:
            user_settings = None

    settings = get_settings()
    try:
        import_module("ozy_bindings")
        rust_bindings = "ok"
    except ModuleNotFoundError:
        if settings.auth_dev_bypass:
            rust_bindings = "dev-fallback"
        else:
            raise
    try:
        await redis.ping()
        redis_status = "ok"
    except Exception:
        redis_status = "unavailable"

    llm_router = get_llm_router()
    active_providers = set(llm_router.available_providers)
    configured_providers = _configured_providers(user_settings, active_providers)
    tracker = get_token_usage_tracker()
    all_token_usage = tracker.get_all_usage()

    llm_provider_health: list[LLMProviderHealth] = []
    for provider_name in KNOWN_LLM_PROVIDERS:
        is_configured = provider_name in configured_providers

        # Build token usage block for cloud providers.
        token_usage: LLMProviderTokenUsage | None = None
        if provider_name not in LOCAL_LLM_PROVIDERS and provider_name in all_token_usage:
            raw = all_token_usage[provider_name]
            budget_status = tracker.get_status(provider_name)
            token_usage = LLMProviderTokenUsage(
                used=raw["used"],
                limit=raw["limit"],
                pct=raw["pct"],
                budget_status=budget_status,  # type: ignore[arg-type]
            )

        if not is_configured:
            llm_provider_health.append(
                LLMProviderHealth(
                    name=provider_name,
                    is_local=provider_name in LOCAL_LLM_PROVIDERS,
                    configured=False,
                    status="not_configured",
                    token_usage=token_usage,
                )
            )
            continue

        status_value, detail = await _get_provider_runtime_status(provider_name)
        if provider_name in active_providers:
            model_name = llm_router.get_model_name(provider_name)
        else:
            model_name = getattr(settings, f"{provider_name}_model", "default")

        # Elevate status when token budget is exhausted or warning.
        if token_usage and token_usage.budget_status in {"warning", "limit_reached"}:
            effective_status = cast(
                Literal["ok", "unavailable", "configured", "warning", "limit_reached"],
                token_usage.budget_status,
            )
        else:
            effective_status = status_value

        llm_provider_health.append(
            LLMProviderHealth(
                name=provider_name,
                is_local=provider_name in LOCAL_LLM_PROVIDERS,
                configured=True,
                status=effective_status,
                model=model_name,
                detail=detail,
                token_usage=token_usage,
            )
        )

    connector_url = settings.live_web_connector_url.strip()
    connector_key = settings.live_web_connector_api_key.strip()
    connector_status: Literal["configured", "not_configured", "unavailable"]
    connector_detail: str | None
    if not connector_url or not connector_key:
        connector_status = "not_configured"
        connector_detail = "Set LIVE_WEB_CONNECTOR_URL and LIVE_WEB_CONNECTOR_API_KEY"
    else:
        connector_status = "configured"
        connector_detail = None
    live_web_health = LiveWebHealth(
        connector_status=connector_status,
        connector_detail=connector_detail,
        native_provider_candidates=[
            item for item in ("openai", "deepseek") if item in configured_providers
        ],
    )

    usable_providers = [item.name for item in llm_provider_health if item.configured]

    return HealthResponse(
        status="ok",
        database="ok",
        redis=redis_status,
        rust_bindings=rust_bindings,
        llm_providers=usable_providers,
        llm_provider_health=llm_provider_health,
        live_web=live_web_health,
    )
