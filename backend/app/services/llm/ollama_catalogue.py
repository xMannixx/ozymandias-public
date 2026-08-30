"""The models the local Ollama runtime actually has on disk.

Every local caller needs this: a configured model name that was never pulled
makes each attempt fail, and for S3/S4 content there is no cloud provider to
fall back to. The pre-classifier is worse off still — it fails quietly and
downgrades the message to S1, which is how sensitive content ends up in the
cloud without anyone noticing.

Embedding models are filtered out. Ollama serves them from the same tag list as
chat models, but they cannot answer a conversation — nomic-embed-text sitting
first in that list is enough to break local chat entirely.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any, Literal

import httpx

from app.config import get_settings
from app.services.errors import ServiceError

logger = logging.getLogger(__name__)

#: Short: pulling a model is a deliberate act and it should be selectable right
#: after, but the tag list is also read on every local turn.
CACHE_TTL_SECONDS = 60

REQUEST_TIMEOUT_SECONDS = 5.0

#: Families that only produce vectors. Ollama reports these in details.family.
_EMBEDDING_FAMILIES = frozenset({"bert", "nomic-bert"})


@dataclass(frozen=True)
class LocalModel:
    """One installed model tag with the disk size Ollama reports for it."""

    tag: str
    size_bytes: int


_cache: tuple[float, list[LocalModel]] | None = None

#: Substitutions already reported, so the warning stays readable.
_warned: set[tuple[tuple[str, ...], str]] = set()


async def installed_models() -> list[LocalModel]:
    """Installed models that can hold a conversation, alphabetically by tag.

    Raises whatever the HTTP call raised when Ollama cannot be reached, so
    callers can tell "runtime is down" apart from "runtime has no models".
    """
    global _cache
    now = time.monotonic()
    if _cache is not None and now - _cache[0] < CACHE_TTL_SECONDS:
        return list(_cache[1])

    models = _conversational_models(await _fetch())
    _cache = (now, models)
    return list(models)


async def chat_models() -> list[str]:
    """Tags of the installed chat models, in dropdown order."""
    return [model.tag for model in await installed_models()]


async def resolve_model(
    *preferences: str | None,
    fallback: Literal["largest", "smallest"],
) -> str:
    """Return the first preference Ollama has, else a substitute by size.

    `fallback` says what to do when none of the preferences is installed:
    answers want the most capable model available, while a one-token
    classification wants the one that responds fastest.
    """
    installed = await installed_models()
    if not installed:
        raise ServiceError(
            "Ollama has no chat model installed. Pull one, for example "
            "'ollama pull llama3.2', to use local-only processing."
        )

    for candidate in preferences:
        match = _match_tag(candidate, installed)
        if match is not None:
            return match

    by_size = sorted(installed, key=lambda model: model.size_bytes)
    substitute = by_size[-1] if fallback == "largest" else by_size[0]
    wanted = tuple(candidate for candidate in preferences if candidate)
    # Once per substitution: this runs on every message, and a line per turn
    # would bury everything else.
    if (wanted, substitute.tag) not in _warned:
        _warned.add((wanted, substitute.tag))
        logger.warning(
            "ollama: none of %s is installed, using %r instead",
            list(wanted),
            substitute.tag,
        )
    return substitute.tag


def reset_cache() -> None:
    """Drop the cached tag list. Used by tests and after pulling a model."""
    global _cache
    _cache = None
    _warned.clear()


async def _fetch() -> Any:
    url = f"{get_settings().ollama_base_url.rstrip('/')}/api/tags"
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()


def _conversational_models(payload: Any) -> list[LocalModel]:
    if not isinstance(payload, dict):
        return []
    entries = payload.get("models")
    if not isinstance(entries, list):
        return []
    models = {
        LocalModel(tag=tag, size_bytes=_size(entry))
        for entry in entries
        if isinstance(entry, dict)
        and (tag := _tag(entry)) is not None
        and not _is_embedding_model(entry, tag)
    }
    # Alphabetical, so a dropdown needs no extra sorting.
    return sorted(models, key=lambda model: model.tag)


def _tag(entry: dict[str, Any]) -> str | None:
    name = entry.get("model") or entry.get("name")
    if isinstance(name, str) and name.strip():
        return name.strip()
    return None


def _size(entry: dict[str, Any]) -> int:
    raw = entry.get("size")
    return raw if isinstance(raw, int) else 0


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


def _match_tag(candidate: str | None, installed: list[LocalModel]) -> str | None:
    """Find `candidate` among installed tags, tolerating an implicit `:latest`."""
    if not candidate:
        return None
    wanted = candidate.strip().lower()
    if not wanted:
        return None
    for model in installed:
        known = model.tag.lower()
        if known == wanted or known == f"{wanted}:latest":
            return model.tag
    return None
