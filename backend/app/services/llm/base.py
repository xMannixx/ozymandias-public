"""Base abstractions for LLM providers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Literal, TypedDict


class LLMMessage(TypedDict):
    """Normalized chat message passed to providers."""

    role: Literal["system", "user", "assistant", "tool"]
    content: str


@dataclass(frozen=True)
class LLMResponse:
    """Normalized provider response consumed by the service layer."""

    content: str
    model: str
    provider: str
    tokens_used: int
    raw_response: dict[str, Any] | None = None
    reasoning_content: str | None = None


# Streaming convention: providers yield text deltas (str) and finish with
# exactly one LLMResponse carrying the full normalized result.
LLMStreamItem = str | LLMResponse


class LLMProvider(ABC):
    """Abstract base class for all LLM providers."""

    @abstractmethod
    async def chat(
        self,
        messages: list[LLMMessage],
        *,
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
        api_key: str | None = None,
    ) -> LLMResponse:
        """Run one chat completion and return normalized output."""

    async def chat_stream(
        self,
        messages: list[LLMMessage],
        *,
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
        api_key: str | None = None,
    ) -> AsyncIterator[LLMStreamItem]:
        """Stream text deltas, ending with the final LLMResponse.

        Providers without native streaming fall back to one full-content delta.
        """
        response = await self.chat(messages, tools=tools, model=model, api_key=api_key)
        if response.content:
            yield response.content
        yield response


async def stream_openai_compatible(
    client: Any,
    *,
    model: str,
    messages: list[LLMMessage],
    provider_name: str,
    tools: list[dict[str, Any]] | None = None,
    include_usage: bool = False,
) -> AsyncIterator[LLMStreamItem]:
    """Shared token streaming for providers speaking the OpenAI chat API."""
    request_payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": True,
    }
    if tools is not None:
        request_payload["tools"] = tools
    if include_usage:
        request_payload["stream_options"] = {"include_usage": True}

    stream = await client.chat.completions.create(**request_payload)
    content_parts: list[str] = []
    reasoning_parts: list[str] = []
    tokens_used = 0
    async for chunk in stream:
        usage = getattr(chunk, "usage", None)
        if usage is not None and getattr(usage, "total_tokens", None):
            tokens_used = int(usage.total_tokens)
        choices = getattr(chunk, "choices", None)
        if not choices:
            continue
        delta = choices[0].delta
        if delta is None:
            continue
        raw_reasoning = getattr(delta, "reasoning_content", None)
        if raw_reasoning is not None and str(raw_reasoning):
            reasoning_parts.append(str(raw_reasoning))
        if delta.content:
            text = str(delta.content)
            content_parts.append(text)
            yield text

    yield LLMResponse(
        content="".join(content_parts),
        model=model,
        provider=provider_name,
        tokens_used=tokens_used,
        reasoning_content="".join(reasoning_parts) or None,
    )
