"""Base abstractions for LLM providers."""

from __future__ import annotations

from abc import ABC, abstractmethod
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
