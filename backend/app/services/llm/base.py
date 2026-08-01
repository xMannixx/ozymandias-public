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
class TokenDetail:
    """Token counts of one provider call, split the way usage is billed."""

    prompt_tokens: int = 0
    completion_tokens: int = 0
    #: Subset of prompt_tokens that the provider served from its prompt cache.
    cached_prompt_tokens: int = 0
    total_tokens: int = 0


def _int_field(source: Any, name: str) -> int:
    """Read one integer from an SDK object or a plain dict, defaulting to zero."""
    value = getattr(source, name, None)
    if value is None and isinstance(source, dict):
        value = source.get(name)
    try:
        return int(value or 0)
    except TypeError, ValueError:
        return 0


def token_detail_from_openai_usage(usage: Any) -> TokenDetail:
    """Read the token breakdown from an OpenAI-shaped usage object.

    Cached input tokens sit in different places per vendor: OpenAI nests them
    under `prompt_tokens_details`, DeepSeek reports `prompt_cache_hit_tokens`.
    """
    if usage is None:
        return TokenDetail()
    prompt = _int_field(usage, "prompt_tokens")
    completion = _int_field(usage, "completion_tokens")
    total = _int_field(usage, "total_tokens") or prompt + completion
    cached = _int_field(usage, "prompt_cache_hit_tokens")
    if not cached:
        details = getattr(usage, "prompt_tokens_details", None)
        if details is None and isinstance(usage, dict):
            details = usage.get("prompt_tokens_details")
        if details is not None:
            cached = _int_field(details, "cached_tokens")
    if prompt:
        cached = min(cached, prompt)
    return TokenDetail(
        prompt_tokens=prompt,
        completion_tokens=completion,
        cached_prompt_tokens=cached,
        total_tokens=total,
    )


@dataclass(frozen=True)
class LLMResponse:
    """Normalized provider response consumed by the service layer."""

    content: str
    model: str
    provider: str
    tokens_used: int
    raw_response: dict[str, Any] | None = None
    reasoning_content: str | None = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cached_prompt_tokens: int = 0

    @classmethod
    def from_tokens(
        cls,
        *,
        content: str,
        model: str,
        provider: str,
        tokens: TokenDetail,
        raw_response: dict[str, Any] | None = None,
        reasoning_content: str | None = None,
    ) -> LLMResponse:
        """Build a response from a token breakdown, keeping tokens_used the total."""
        return cls(
            content=content,
            model=model,
            provider=provider,
            tokens_used=tokens.total_tokens,
            raw_response=raw_response,
            reasoning_content=reasoning_content,
            prompt_tokens=tokens.prompt_tokens,
            completion_tokens=tokens.completion_tokens,
            cached_prompt_tokens=tokens.cached_prompt_tokens,
        )


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
    tokens = TokenDetail()
    async for chunk in stream:
        usage = getattr(chunk, "usage", None)
        if usage is not None and getattr(usage, "total_tokens", None):
            tokens = token_detail_from_openai_usage(usage)
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

    yield LLMResponse.from_tokens(
        content="".join(content_parts),
        model=model,
        provider=provider_name,
        tokens=tokens,
        reasoning_content="".join(reasoning_parts) or None,
    )
