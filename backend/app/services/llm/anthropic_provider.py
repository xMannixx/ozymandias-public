"""Anthropic (Claude) provider using the official anthropic SDK."""

from __future__ import annotations

from typing import Any

from anthropic import AsyncAnthropic

from app.config import get_settings
from app.services.errors import ServiceError
from app.services.llm.base import LLMMessage, LLMProvider, LLMResponse


class AnthropicProvider(LLMProvider):
    """Anthropic cloud provider (Claude models)."""

    def __init__(self) -> None:
        settings = get_settings()
        api_key = settings.anthropic_api_key
        self._client = AsyncAnthropic(api_key=api_key) if api_key else None
        self._model_name = settings.anthropic_model

    async def chat(
        self,
        messages: list[LLMMessage],
        *,
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
        api_key: str | None = None,
    ) -> LLMResponse:
        selected_model = model or self._model_name
        client = AsyncAnthropic(api_key=api_key) if api_key else self._client
        if client is None:
            raise ServiceError("Anthropic provider not configured — api_key is missing")

        # Anthropic separates the system prompt from conversation messages.
        system = next(
            (m["content"] for m in messages if m["role"] == "system"),
            "",
        )
        user_messages: list[dict[str, Any]] = [
            {"role": m["role"], "content": m["content"]}
            for m in messages
            if m["role"] != "system"
        ]

        create_kwargs: dict[str, Any] = {
            "model": selected_model,
            "max_tokens": 4096,
            "messages": user_messages,
        }
        if system:
            create_kwargs["system"] = system

        response = await client.messages.create(**create_kwargs)

        content = ""
        if response.content:
            first = response.content[0]
            if hasattr(first, "text"):
                content = first.text

        tokens_used = 0
        if response.usage is not None:
            tokens_used = response.usage.input_tokens + response.usage.output_tokens

        return LLMResponse(
            content=content,
            model=selected_model,
            provider="anthropic",
            tokens_used=tokens_used,
        )
