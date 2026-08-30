"""Redis-backed circuit breaker service."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.schemas import CircuitBreakerConfig
from app.services import rust_bridge
from app.services.errors import CircuitBreakerTrippedError


@dataclass(frozen=True)
class CircuitBreakerState:
    """Lightweight state snapshot used for tests and diagnostics."""

    current_count: int
    is_tripped: bool


class CircuitBreakerService:
    """Enforce request velocity limits using Redis counters."""

    def __init__(self, db: AsyncSession, redis_client: Redis | None = None) -> None:
        self.db = db
        settings = get_settings()
        self.config = CircuitBreakerConfig(
            max_actions_per_window=settings.cb_max_actions,
            window_seconds=settings.cb_window_seconds,
            cooldown_seconds=settings.cb_cooldown_seconds,
        )
        self.redis: Redis = redis_client or Redis.from_url(
            settings.redis_url, encoding="utf-8", decode_responses=True
        )

    def _count_key(self, user_id: str, action_type: str) -> str:
        return f"cb:{user_id}:{action_type}"

    def _trip_key(self, user_id: str) -> str:
        return f"cb_tripped:{user_id}"

    async def get_state(self, user_id: str, action_type: str) -> CircuitBreakerState:
        """Return current counter/trip status for diagnostics and tests."""
        count_raw = await self.redis.get(self._count_key(user_id, action_type))
        trip_raw = await self.redis.get(self._trip_key(user_id))
        current_count = int(count_raw) if isinstance(count_raw, str) else 0
        return CircuitBreakerState(current_count=current_count, is_tripped=trip_raw is not None)

    async def check(self, user_id: str, action_type: str) -> None:
        """Check whether the action is allowed in the current time window."""
        trip_key = self._trip_key(user_id)
        if await self.redis.get(trip_key):
            raise CircuitBreakerTrippedError("Circuit breaker cooldown active")

        count_key = self._count_key(user_id, action_type)
        count_raw = await self.redis.get(count_key)
        current_count = int(count_raw) if isinstance(count_raw, str) else 0

        # "Open" is the conducting state in the engine, not the blocking one.
        # An active cooldown never reaches this call: it lives in Redis under
        # trip_key and was checked above, so the engine only has to judge the
        # current velocity.
        decision_raw = rust_bridge.check_circuit_breaker(
            self.config,
            current_count,
            "Open",
            None,
        )
        decision: str | dict[str, Any]
        if isinstance(decision_raw, str):
            decision = decision_raw
        elif isinstance(decision_raw, dict):
            decision = decision_raw
        else:
            decision = decision_raw.model_dump()

        if isinstance(decision, str) and decision == "Allow":
            return
        if isinstance(decision, dict) and "CooldownActive" in decision:
            remaining = decision["CooldownActive"]["remaining_seconds"]
            await self.redis.setex(trip_key, int(remaining), "1")
            raise CircuitBreakerTrippedError("Circuit breaker cooldown active")
        if isinstance(decision, dict) and "Trip" in decision:
            await self.redis.setex(trip_key, int(self.config.cooldown_seconds), "1")
            reason = decision["Trip"]["reason"]
            raise CircuitBreakerTrippedError(f"Circuit breaker tripped: {reason}")

        raise CircuitBreakerTrippedError(f"Unexpected circuit breaker decision: {decision!r}")

    async def increment(self, user_id: str, action_type: str) -> int:
        """Record one successful action in the current window."""
        count_key = self._count_key(user_id, action_type)
        new_count = await self.redis.incr(count_key)
        if new_count == 1:
            await self.redis.expire(count_key, int(self.config.window_seconds))
        return int(new_count)

    async def force_trip(self, user_id: str) -> None:
        """Force cooldown state regardless of current request velocity."""
        await self.redis.setex(self._trip_key(user_id), int(self.config.cooldown_seconds), "1")
