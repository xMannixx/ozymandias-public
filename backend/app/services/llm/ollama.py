"""Ollama local provider."""

from __future__ import annotations

from typing import Any, cast

from ollama import AsyncClient

from app.config import get_settings
from app.services.llm.base import LLMMessage, LLMProvider, LLMResponse


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
    ) -> LLMResponse:
        selected_model = model or self._model_name
        del tools  # Ollama tools are currently not used in this backend.
        try:
            response = await self._client.chat(model=selected_model, messages=messages)
        except Exception as exc:
            error_text = str(exc).lower()
            should_retry_with_default = (
                model is not None
                and selected_model != self._model_name
                and "model" in error_text
                and "not found" in error_text
            )
            if not should_retry_with_default:
                raise
            selected_model = self._model_name
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
        return LLMResponse(
            content=content,
            model=selected_model,
            provider="ollama",
            tokens_used=prompt_tokens + completion_tokens,
            raw_response=raw_response,
        )
