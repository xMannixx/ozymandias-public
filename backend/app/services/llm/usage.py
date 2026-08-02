"""Usage records for single LLM calls.

The router fills these while talking to providers; the service layer decides
whether and how to persist them. Nothing here touches the database, and no
prompt or response text is ever carried along.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

CALL_TYPE_CHAT = "chat"
CALL_TYPE_CLAIM_EXTRACTION = "claim_extraction"
CALL_TYPE_TOOL = "tool_call"

_INTENT_CALL_TYPES = {
    "general_turn": CALL_TYPE_CHAT,
    "claim_extraction": CALL_TYPE_CLAIM_EXTRACTION,
    "tool_call": CALL_TYPE_TOOL,
}

STATUS_OK = "ok"
STATUS_ERROR = "error"

#: Providers whose API tells us how much of the prompt came from their cache.
#: A cache hit rate over other providers would silently read as zero percent.
CACHE_REPORTING_PROVIDERS = frozenset({"openai", "deepseek", "anthropic", "gemini"})


@dataclass(frozen=True)
class LLMCallUsage:
    """What one provider call consumed, successful or not."""

    call_type: str
    provider: str
    model: str
    status: str
    latency_ms: int
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cached_prompt_tokens: int = 0
    total_tokens: int = 0
    tool_name: str | None = None
    #: Exception class name only — never a message, which could carry content.
    error_kind: str | None = None


def call_type_for_intent(intent: str) -> str:
    """Map a routing intent onto the coarse call type shown in usage reports."""
    return _INTENT_CALL_TYPES.get(intent, intent)


def tool_name_from_request(tools: list[dict[str, Any]] | None) -> str | None:
    """Name the first requested tool, so usage can be grouped by tool."""
    if not tools:
        return None
    first = tools[0]
    if not isinstance(first, dict):
        return None
    function = first.get("function")
    if isinstance(function, dict):
        name = function.get("name")
        if isinstance(name, str) and name:
            return name
    tool_type = first.get("type")
    return tool_type if isinstance(tool_type, str) and tool_type else None
