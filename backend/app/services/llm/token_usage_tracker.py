"""In-memory token usage tracker with optional daily limits per provider.

Resets at service restart. Sufficient for a personal tool where daily cost
awareness matters more than cross-session persistence.
"""

from __future__ import annotations

import threading
from datetime import date
from functools import lru_cache
from typing import TypedDict

from app.config import get_settings


class ProviderUsage(TypedDict):
    """Token usage snapshot for one provider."""

    used: int
    limit: int
    pct: float | None


class TokenUsageTracker:
    """Thread-safe in-memory token counter with configurable daily limits."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._current_date: date = date.today()
        # {provider_name: tokens_used}
        self._usage: dict[str, int] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def record(self, provider: str, tokens: int) -> None:
        """Add *tokens* to *provider*'s daily counter."""
        with self._lock:
            self._maybe_reset()
            self._usage[provider] = self._usage.get(provider, 0) + tokens

    def is_limit_exceeded(self, provider: str) -> bool:
        """Return True when the provider's daily limit has been reached.

        Returns False when no limit is configured (limit == 0).
        """
        limit = self._get_limit(provider)
        if limit == 0:
            return False
        with self._lock:
            self._maybe_reset()
            return self._usage.get(provider, 0) >= limit

    def get_all_usage(self) -> dict[str, ProviderUsage]:
        """Return a snapshot of today's usage for all known providers."""
        settings = get_settings()
        known_providers = ("mistral", "deepseek", "openai", "anthropic", "gemini", "openrouter")
        result: dict[str, ProviderUsage] = {}

        with self._lock:
            self._maybe_reset()
            for provider in known_providers:
                used = self._usage.get(provider, 0)
                limit = _limit_from_settings(settings, provider)
                pct: float | None = None
                if limit > 0:
                    pct = round(min(used / limit * 100, 100.0), 1)
                result[provider] = ProviderUsage(used=used, limit=limit, pct=pct)

        return result

    def get_status(self, provider: str) -> str:
        """Return 'ok', 'warning' (>=80 %), or 'limit_reached' (>=100 %)."""
        limit = self._get_limit(provider)
        if limit == 0:
            return "ok"
        with self._lock:
            self._maybe_reset()
            used = self._usage.get(provider, 0)
        pct = used / limit * 100
        if pct >= 100:
            return "limit_reached"
        if pct >= 80:
            return "warning"
        return "ok"

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _maybe_reset(self) -> None:
        """Reset counters when the calendar date has advanced (midnight rollover)."""
        today = date.today()
        if today != self._current_date:
            self._current_date = today
            self._usage.clear()

    def _get_limit(self, provider: str) -> int:
        return _limit_from_settings(get_settings(), provider)


def _limit_from_settings(settings: object, provider: str) -> int:
    field = f"{provider}_daily_token_limit"
    return int(getattr(settings, field, 0) or 0)


@lru_cache(maxsize=1)
def get_token_usage_tracker() -> TokenUsageTracker:
    """Return the process-global usage tracker singleton."""
    return TokenUsageTracker()
