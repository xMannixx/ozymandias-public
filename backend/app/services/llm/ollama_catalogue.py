"""The models the local Ollama runtime actually has on disk.

Both the model dropdown and the S3/S4 routing path need this: a configured
model name that was never pulled makes every local turn fail, and high
sensitivity content has no cloud provider to fall back to.

Embedding models are filtered out. Ollama serves them from the same tag list as
chat models, but they cannot answer a conversation — nomic-embed-text sitting
first in that list is enough to break local chat entirely.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

#: Short: pulling a model is a deliberate act and it should be selectable right
#: after, but the tag list is also read on every local turn.
CACHE_TTL_SECONDS = 60

REQUEST_TIMEOUT_SECONDS = 5.0

#: Families that only produce vectors. Ollama reports these in details.family.
_EMBEDDING_FAMILIES = frozenset({"bert", "nomic-bert"})

_cache: tuple[float, list[str]] | None = None


async def chat_models() -> list[str]:
    """Installed model tags that can hold a conversation, alphabetically.

    Raises whatever the HTTP call raised when Ollama cannot be reached, so
    callers can tell "runtime is down" apart from "runtime has no models".
    """
    global _cache
    now = time.monotonic()
    if _cache is not None and now - _cache[0] < CACHE_TTL_SECONDS:
        return list(_cache[1])

    models = _conversational_tags(await _fetch())
    _cache = (now, models)
    return list(models)


def reset_cache() -> None:
    """Drop the cached tag list. Used by tests and after pulling a model."""
    global _cache
    _cache = None


async def _fetch() -> Any:
    url = f"{get_settings().ollama_base_url.rstrip('/')}/api/tags"
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()


def _conversational_tags(payload: Any) -> list[str]:
    if not isinstance(payload, dict):
        return []
    entries = payload.get("models")
    if not isinstance(entries, list):
        return []
    tags = {
        tag
        for entry in entries
        if isinstance(entry, dict)
        and (tag := _tag(entry)) is not None
        and not _is_embedding_model(entry, tag)
    }
    return sorted(tags)


def _tag(entry: dict[str, Any]) -> str | None:
    name = entry.get("model") or entry.get("name")
    if isinstance(name, str) and name.strip():
        return name.strip()
    return None


def _is_embedding_model(entry: dict[str, Any], tag: str) -> bool:
    if "embed" in tag.lower():
        return True
    details = entry.get("details")
    if not isinstance(details, dict):
        return False
    declared = details.get("families")
    families = {details.get("family")}
    if isinstance(declared, list):
        families.update(declared)
    return bool(families & _EMBEDDING_FAMILIES)
