"""Ollama local provider."""

from __future__ import annotations

from contextlib import suppress
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
        api_key: str | None = None,
    ) -> LLMResponse:
        selected_model = model or self._model_name
        del api_key, tools  # Ollama tools are currently not used in this backend.
        exc_to_raise = None
        try:
            response = await self._client.chat(model=selected_model, messages=messages)
        except Exception as exc:
            exc_to_raise = exc
            error_text = str(exc).lower()
            should_retry_with_default = (
                model is not None
                and selected_model != self._model_name
                and "model" in error_text
                and "not found" in error_text
            )
            if should_retry_with_default:
                selected_model = self._model_name
                try:
                    response = await self._client.chat(model=selected_model, messages=messages)
                    exc_to_raise = None
                except Exception as inner_exc:
                    exc_to_raise = inner_exc
                    error_text = str(inner_exc).lower()

            if exc_to_raise is not None and (
                "not found" in error_text or "not_found" in error_text
            ):
                with suppress(Exception):
                    import httpx

                    settings = get_settings()
                    tags_url = f"{settings.ollama_base_url.rstrip('/')}/api/tags"
                    async with httpx.AsyncClient(timeout=3.0) as client:
                        resp = await client.get(tags_url)
                        if resp.status_code == 200:
                            payload = resp.json()
                            models = payload.get("models", [])
                            names = []
                            for m in models:
                                if isinstance(m, dict):
                                    name = m.get("model") or m.get("name")
                                    if isinstance(name, str) and name.strip():
                                        names.append(name.strip())
                            if names:
                                selected_model = names[0]
                                response = await self._client.chat(
                                    model=selected_model,
                                    messages=messages,
                                )
                                exc_to_raise = None

            if exc_to_raise is not None:
                if exc_to_raise is exc:
                    raise
                raise exc_to_raise from exc

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
