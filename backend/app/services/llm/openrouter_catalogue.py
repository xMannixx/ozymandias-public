"""The list of models OpenRouter currently serves.

Kept out of the API layer because it needs a cache: the catalogue is several
hundred entries and roughly a quarter of a megabyte, while the model dropdown
is opened far more often than OpenRouter changes its offering.

No API key is involved — the catalogue is public.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

#: Long enough that browsing the settings page hits the cache, short enough that
#: a model released today is selectable today.
CACHE_TTL_SECONDS = 900

REQUEST_TIMEOUT_SECONDS = 10.0

#: Shown when OpenRouter cannot be reached, so the dropdown is never empty.
#: These are rolling aliases and therefore safe to hardcode.
FALLBACK_MODELS = (
    "~anthropic/claude-sonnet-latest",
    "~deepseek/deepseek-v4-flash-latest",
    "~google/gemini-flash-latest",
    "~openai/gpt-latest",
    "~openai/gpt-mini-latest",
)

_cache: tuple[float, list[str]] | None = None


async def list_models() -> list[str]:
    """Model slugs that can be used for chat, newest catalogue or cache."""
    global _cache
    now = time.monotonic()
    if _cache is not None and now - _cache[0] < CACHE_TTL_SECONDS:
        return list(_cache[1])

    try:
        payload = await _fetch()
    except Exception as exc:
        logger.info("openrouter: catalogue unavailable: %s", exc)
        # Serve a stale list rather than an empty dropdown.
        if _cache is not None:
            return list(_cache[1])
        return list(FALLBACK_MODELS)

    models = _usable_slugs(payload)
    if not models:
        return list(FALLBACK_MODELS)
    _cache = (now, models)
    return list(models)


def reset_cache() -> None:
    """Drop the cached catalogue. Used by tests and after a config change."""
    global _cache
    _cache = None


async def _fetch() -> Any:
    url = f"{get_settings().openrouter_base_url.rstrip('/')}/models"
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()


def _usable_slugs(payload: Any) -> list[str]:
    """Slugs of every model this app can actually send a chat turn to."""
    if not isinstance(payload, dict):
        return []
    entries = payload.get("data")
    if not isinstance(entries, list):
        return []
    slugs = {
        entry["id"]
        for entry in entries
        if isinstance(entry, dict) and isinstance(entry.get("id"), str) and _answers_in_text(entry)
    }
    # Alphabetical, so a dropdown groups by vendor without extra work.
    return sorted(slugs)


def _answers_in_text(entry: dict[str, Any]) -> bool:
    """Skip image, video and audio generators — the chat pipeline needs text back."""
    architecture = entry.get("architecture")
    if not isinstance(architecture, dict):
        # Undeclared shape: assume text rather than hide the model.
        return True
    modalities = architecture.get("output_modalities")
    if not isinstance(modalities, list) or not modalities:
        return True
    return "text" in modalities
