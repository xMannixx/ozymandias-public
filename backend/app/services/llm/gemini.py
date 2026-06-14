"""Gemini provider using the instance-based Google GenAI client."""

from __future__ import annotations

from typing import Any

from google import genai

from app.config import get_settings
from app.services.errors import ServiceError
from app.services.llm.base import LLMMessage, LLMProvider, LLMResponse


def _messages_to_prompt(messages: list[LLMMessage]) -> str:
    chunks: list[str] = []
    for message in messages:
        chunks.append(f"{message['role'].upper()}: {message['content']}")
    return "\n\n".join(chunks)


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
        usage_metadata = getattr(response, "usage_metadata", None)
        tokens_used = 0
        if usage_metadata is not None:
            tokens_used = int(getattr(usage_metadata, "total_token_count", 0) or 0)
        raw_response = response.model_dump() if hasattr(response, "model_dump") else None
        return LLMResponse(
            content=content,
            model=selected_model,
            provider="gemini",
            tokens_used=tokens_used,
            raw_response=raw_response,
        )

