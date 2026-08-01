"""Gemini provider using the instance-based Google GenAI client."""

from __future__ import annotations

from typing import Any

from google import genai

from app.config import get_settings
from app.services.errors import ServiceError
from app.services.llm.base import LLMMessage, LLMProvider, LLMResponse, TokenDetail


def _messages_to_prompt(messages: list[LLMMessage]) -> str:
    chunks: list[str] = []
    for message in messages:
        chunks.append(f"{message['role'].upper()}: {message['content']}")
    return "\n\n".join(chunks)


def _count(source: Any, name: str) -> int:
    return int(getattr(source, name, 0) or 0)


def _token_detail(usage_metadata: Any) -> TokenDetail:
    """Map Gemini's usage metadata onto the shared token breakdown."""
    if usage_metadata is None:
        return TokenDetail()
    prompt = _count(usage_metadata, "prompt_token_count")
    completion = _count(usage_metadata, "candidates_token_count")
    cached = _count(usage_metadata, "cached_content_token_count")
    total = _count(usage_metadata, "total_token_count") or prompt + completion
    return TokenDetail(
        prompt_tokens=prompt,
        completion_tokens=completion,
        cached_prompt_tokens=min(cached, prompt) if prompt else cached,
        total_tokens=total,
    )


class GeminiProvider(LLMProvider):
    """Gemini provider wrapper."""

    def __init__(self) -> None:
        settings = get_settings()
        api_key = settings.gemini_api_key
        self._client = genai.Client(api_key=api_key) if api_key else None
        self._model_name = settings.gemini_model

    async def chat(
        self,
        messages: list[LLMMessage],
        *,
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
        api_key: str | None = None,
    ) -> LLMResponse:
        selected_model = model or self._model_name
        del tools  # Tools are routed to OpenAI provider.
        client = genai.Client(api_key=api_key) if api_key else self._client
        if client is None:
            raise ServiceError("Gemini provider not configured — api_key is missing")

        response = await client.aio.models.generate_content(
            model=selected_model,
            contents=_messages_to_prompt(messages),
        )
        content = response.text or ""
        raw_response = response.model_dump() if hasattr(response, "model_dump") else None
        return LLMResponse.from_tokens(
            content=content,
            model=selected_model,
            provider="gemini",
            tokens=_token_detail(getattr(response, "usage_metadata", None)),
            raw_response=raw_response,
        )
