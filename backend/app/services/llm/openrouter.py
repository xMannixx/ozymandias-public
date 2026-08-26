"""OpenRouter provider using the OpenAI-compatible SDK.

OpenRouter is a broker rather than a lab: one key and one base URL reach several
hundred models from many vendors. That makes it the provider to pick when you
want a specific model this app has no dedicated client for.

Sensitivity routing is unaffected — this is a cloud provider like any other, so
S3 and S4 content never reaches it.
"""

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

#: Optional attribution headers; they only decide how the app is labelled on
#: OpenRouter's own activity pages and carry no request content.
_ATTRIBUTION_HEADERS = {
    "HTTP-Referer": "https://github.com/xMannixx/ozymandias-public",
    "X-OpenRouter-Title": "Ozymandias",
}


class OpenRouterProvider(LLMProvider):
    """Cloud provider that fronts many vendors behind one key."""

    def __init__(self) -> None:
        settings = get_settings()
        self._base_url = settings.openrouter_base_url
        self._model_name = settings.openrouter_model
        self._client = self._build_client(settings.openrouter_api_key)

    def _build_client(self, api_key: str | None) -> AsyncOpenAI | None:
        if not api_key:
            return None
        return AsyncOpenAI(
            api_key=api_key,
            base_url=self._base_url,
            default_headers=_ATTRIBUTION_HEADERS,
        )

    def _client_for(self, api_key: str | None) -> AsyncOpenAI:
        client = self._build_client(api_key) if api_key else self._client
        if client is None:
            raise ServiceError("OpenRouter provider not configured — api_key is missing")
        return client

    async def chat(
        self,
        messages: list[LLMMessage],
        *,
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
        api_key: str | None = None,
    ) -> LLMResponse:
        selected_model = model or self._model_name
        client = self._client_for(api_key)

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
        raw_response = response.model_dump() if hasattr(response, "model_dump") else None
        return LLMResponse.from_tokens(
            content=content,
            model=selected_model,
            provider="openrouter",
            tokens=token_detail_from_openai_usage(response.usage),
            raw_response=raw_response,
            reasoning_content=_reasoning_of(message),
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
        client = self._client_for(api_key)
        async for item in stream_openai_compatible(
            client,
            model=selected_model,
            messages=messages,
            provider_name="openrouter",
            tools=tools,
            include_usage=True,
        ):
            yield item


def _reasoning_of(message: Any) -> str | None:
    """Thinking text, which upstream vendors name differently."""
    for field in ("reasoning", "reasoning_content"):
        raw = getattr(message, field, None)
        if raw is not None and str(raw).strip():
            return str(raw)
    return None
