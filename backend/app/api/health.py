"""Health endpoints."""

from importlib import import_module
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import text

from app.config import get_settings
from app.database import get_db, get_redis
from app.schemas.api_models import HealthResponse, LiveWebHealth, LLMProviderHealth
from app.services.llm.router import get_llm_router

router = APIRouter(tags=["health"])

KNOWN_LLM_PROVIDERS = ("ollama", "lmstudio", "deepseek", "openai", "gemini", "mistral")
LOCAL_LLM_PROVIDERS = {"ollama", "lmstudio"}


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
) -> HealthResponse:
    await db.execute(text("SELECT 1"))
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
    configured_providers = set(llm_router.available_providers)
    llm_provider_health: list[LLMProviderHealth] = []
    for provider_name in KNOWN_LLM_PROVIDERS:
        if provider_name not in configured_providers:
            llm_provider_health.append(
                LLMProviderHealth(
                    name=provider_name,
                    is_local=provider_name in LOCAL_LLM_PROVIDERS,
                    configured=False,
                    status="not_configured",
                )
            )
            continue

        status_value, detail = await _get_provider_runtime_status(provider_name)
        llm_provider_health.append(
            LLMProviderHealth(
                name=provider_name,
                is_local=provider_name in LOCAL_LLM_PROVIDERS,
                configured=True,
                status=status_value,
                model=llm_router.get_model_name(provider_name),
                detail=detail,
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

    return HealthResponse(
        status="ok",
        database="ok",
        redis=redis_status,
        rust_bindings=rust_bindings,
        llm_providers=llm_router.available_providers,
        llm_provider_health=llm_provider_health,
        live_web=live_web_health,
    )
