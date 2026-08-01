"""DeepSeek provider using OpenAI-compatible SDK."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any, cast

from openai import AsyncOpenAI

from app.config import get_settings
from app.services.errors import ServiceError
from app.services.llm.base import (
    LLMMessage,
    LLMProvider,
    LLMResponse,
    LLMStreamItem,
    stream_openai_compatible,
    token_detail_from_openai_usage,
)


class DeepSeekProvider(LLMProvider):
    """Default cloud provider for structured and work-heavy tasks."""

    def __init__(self) -> None:
        settings = get_settings()
        api_key = settings.deepseek_api_key
        self._client = (
            AsyncOpenAI(
                api_key=api_key,
                base_url=settings.deepseek_base_url,
            )
            if api_key
            else None
        )
        self._model_name = settings.deepseek_model
        self._base_url = settings.deepseek_base_url

    async def chat(
        self,
        messages: list[LLMMessage],
        *,
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
        api_key: str | None = None,
    ) -> LLMResponse:
        selected_model = model or self._model_name
        client = (
            AsyncOpenAI(
                api_key=api_key,
                base_url=self._base_url,
            )
            if api_key
            else self._client
        )
        if client is None:
            raise ServiceError("DeepSeek provider not configured — api_key is missing")

        request_payload: dict[str, Any] = {
            "model": selected_model,
            "messages": cast(Any, messages),
        }
        if tools is not None:
            request_payload["tools"] = cast(Any, tools)
        response = await client.chat.completions.create(**request_payload)
        message = response.choices[0].message if response.choices else None
        content = ""
        if message is not None and message.content is not None:
            content = str(message.content)
        reasoning: str | None = None
        if message is not None:
            raw_reasoning = getattr(message, "reasoning_content", None)
            if raw_reasoning is not None and str(raw_reasoning).strip():
                reasoning = str(raw_reasoning)
        raw_response = response.model_dump() if hasattr(response, "model_dump") else None
        return LLMResponse.from_tokens(
            content=content,
            model=selected_model,
            provider="deepseek",
            tokens=token_detail_from_openai_usage(response.usage),
            raw_response=raw_response,
            reasoning_content=reasoning,
        )

    async def chat_stream(
        self,
        messages: list[LLMMessage],
        *,
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
        api_key: str | None = None,
    ) -> AsyncIterator[LLMStreamItem]:
        selected_model = model or self._model_name
        client = AsyncOpenAI(api_key=api_key, base_url=self._base_url) if api_key else self._client
        if client is None:
            raise ServiceError("DeepSeek provider not configured — api_key is missing")
        async for item in stream_openai_compatible(
            client,
            model=selected_model,
            messages=messages,
            provider_name="deepseek",
            tools=tools,
            include_usage=True,
        ):
            yield item
