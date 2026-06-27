"""LLM management and provider capability endpoints."""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends

from app.auth.jwt import get_current_user
from app.config import get_settings
from app.schemas.api_models import LLMProviderInfo
from app.services.llm.router import get_llm_router

router = APIRouter(tags=["llm"])


@router.get("/providers", response_model=list[LLMProviderInfo])
async def list_providers(_user_id: str = Depends(get_current_user)) -> list[LLMProviderInfo]:
    """Return all configured providers with current default model metadata."""
    llm_router = get_llm_router()
    providers: list[LLMProviderInfo] = []
    for name in llm_router.available_providers:
        providers.append(
            LLMProviderInfo(
                name=name,
                is_local=name in {"ollama", "lmstudio"},
                current_model=llm_router.get_model_name(name),
            )
        )
    return providers


@router.get("/ollama/models", response_model=list[str])
async def list_ollama_models(_user_id: str = Depends(get_current_user)) -> list[str]:
    """Return installed local Ollama models, or empty list if unreachable."""
    settings = get_settings()
    tags_url = f"{settings.ollama_base_url.rstrip('/')}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(tags_url)
            response.raise_for_status()
            payload = response.json()
    except Exception:
        return []
    if not isinstance(payload, dict):
        return []
    models = payload.get("models")
    if not isinstance(models, list):
        return []
    names: list[str] = []
    for item in models:
        if not isinstance(item, dict):
            continue
        name = item.get("model") or item.get("name")
        if isinstance(name, str) and name.strip():
            names.append(name)
    return names


@router.get("/lmstudio/models", response_model=list[str])
async def list_lmstudio_models(_user_id: str = Depends(get_current_user)) -> list[str]:
    """Return loaded LM Studio models, or empty list if API is unavailable."""
    settings = get_settings()
    models_url = f"{settings.lmstudio_base_url.rstrip('/')}/models"
    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            response = await client.get(models_url)
            response.raise_for_status()
            payload = response.json()
    except Exception:
        return []
    if not isinstance(payload, dict):
        return []
    data_entries = payload.get("data")
    if not isinstance(data_entries, list):
        return []
    model_names: list[str] = []
    for item in data_entries:
        if not isinstance(item, dict):
            continue
        model_id = item.get("id")
        if isinstance(model_id, str) and model_id.strip():
            model_names.append(model_id)
    return model_names


@router.get("/deepseek/models", response_model=list[str])
async def list_deepseek_models(_user_id: str = Depends(get_current_user)) -> list[str]:
    """Return selectable DeepSeek API model ids (static list)."""
    return ["deepseek-chat", "deepseek-reasoner"]


@router.get("/mistral/models", response_model=list[str])
async def list_mistral_models(_user_id: str = Depends(get_current_user)) -> list[str]:
    """Return selectable Mistral API model ids (static list)."""
    return [
        "mistral-large-latest",
        "mistral-medium-latest",
        "mistral-small-latest",
        "codestral-latest",
    ]
