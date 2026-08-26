"""Ollama local provider."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from typing import Any, cast

from ollama import AsyncClient

from app.config import get_settings
from app.services.errors import ServiceError
from app.services.llm import ollama_catalogue
from app.services.llm.base import (
    LLMMessage,
    LLMProvider,
    LLMResponse,
    LLMStreamItem,
    TokenDetail,
)

logger = logging.getLogger(__name__)


class OllamaProvider(LLMProvider):
    """Local provider used for high-sensitivity content."""

    def __init__(self) -> None:
        settings = get_settings()
        self._client = AsyncClient(host=settings.ollama_base_url)
        self._model_name = settings.ollama_model

    async def chat(
        self,
        messages: list[LLMMessage],
        *,
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
        api_key: str | None = None,
    ) -> LLMResponse:
        del api_key, tools  # Ollama tools are currently not used in this backend.
        selected_model = await self._resolve_model(model)
        response = await self._client.chat(model=selected_model, messages=messages)

        raw_response: dict[str, Any]
        if hasattr(response, "model_dump"):
            raw_response = response.model_dump()
        else:
            raw_response = cast(dict[str, Any], response)
        message = cast(dict[str, Any], raw_response.get("message", {}))
        content = str(message.get("content", ""))
        prompt_tokens = int(raw_response.get("prompt_eval_count", 0))
        completion_tokens = int(raw_response.get("eval_count", 0))
        return LLMResponse.from_tokens(
            content=content,
            model=selected_model,
            provider="ollama",
            tokens=TokenDetail(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
            ),
            raw_response=raw_response,
        )

    async def chat_stream(
        self,
        messages: list[LLMMessage],
        *,
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
        api_key: str | None = None,
    ) -> AsyncIterator[LLMStreamItem]:
        del api_key, tools
        selected_model = await self._resolve_model(model)
        stream = await self._client.chat(model=selected_model, messages=messages, stream=True)
        content_parts: list[str] = []
        prompt_tokens = 0
        completion_tokens = 0
        async for part in stream:
            part_dict: dict[str, Any]
            if hasattr(part, "model_dump"):
                part_dict = part.model_dump()
            else:
                part_dict = cast(dict[str, Any], part)
            message = cast(dict[str, Any], part_dict.get("message", {}))
            text = str(message.get("content", ""))
            if text:
                content_parts.append(text)
                yield text
            if part_dict.get("done"):
                prompt_tokens = int(part_dict.get("prompt_eval_count", 0))
                completion_tokens = int(part_dict.get("eval_count", 0))

        yield LLMResponse.from_tokens(
            content="".join(content_parts),
            model=selected_model,
            provider="ollama",
            tokens=TokenDetail(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
            ),
        )

    async def _resolve_model(self, requested: str | None) -> str:
        """Return a model this Ollama instance can actually run.

        A model name that was never pulled fails every turn, and S3/S4 content
        has no cloud provider to fall back to, so an installed model beats the
        configured one. Cloud model names arrive here as `requested` whenever a
        user keeps one cloud and one local preference, hence the same treatment.
        """
        installed = await ollama_catalogue.chat_models()
        if not installed:
            raise ServiceError(
                "Ollama has no chat model installed. Pull one, for example "
                "'ollama pull llama3.2', to use local-only processing."
            )

        for candidate in (requested, self._model_name):
            match = _match_tag(candidate, installed)
            if match is not None:
                return match

        substitute = installed[0]
        logger.warning(
            "ollama: model %r is not installed, using %r instead",
            requested or self._model_name,
            substitute,
        )
        return substitute


def _match_tag(candidate: str | None, installed: list[str]) -> str | None:
    """Find `candidate` among installed tags, tolerating an implicit `:latest`."""
    if not candidate:
        return None
    wanted = candidate.strip().lower()
    if not wanted:
        return None
    for tag in installed:
        known = tag.lower()
        if known == wanted or known == f"{wanted}:latest":
            return tag
    return None
