"""LM Studio provider using OpenAI-compatible local API."""

from __future__ import annotations

from typing import Any, cast

from openai import AsyncOpenAI

from app.config import get_settings
from app.services.llm.base import LLMMessage, LLMProvider, LLMResponse


class LMStudioProvider(LLMProvider):
    """Local LM Studio provider wrapper."""

    def __init__(self) -> None:
        settings = get_settings()
        self._client = AsyncOpenAI(
            api_key="lm-studio",
            base_url=settings.lmstudio_base_url,
        )
        self._model_name = settings.lmstudio_model

    async def chat(
        self,
        messages: list[LLMMessage],
        *,
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
    ) -> LLMResponse:
        selected_model = model or self._model_name
        request_payload: dict[str, Any] = {
            "model": selected_model,
            "messages": cast(Any, messages),
        }
        if tools is not None:
            request_payload["tools"] = cast(Any, tools)
        response = await self._client.chat.completions.create(**request_payload)
        content = ""
        if response.choices and response.choices[0].message.content is not None:
            content = str(response.choices[0].message.content)
        tokens_used = response.usage.total_tokens if response.usage is not None else 0
        raw_response = response.model_dump() if hasattr(response, "model_dump") else None
        return LLMResponse(
            content=content,
            model=selected_model,
            provider="lmstudio",
            tokens_used=tokens_used,
            raw_response=raw_response,
        )
