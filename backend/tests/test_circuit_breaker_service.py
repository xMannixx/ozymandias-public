"""Unit tests for Redis-backed circuit breaker service."""

from __future__ import annotations

from typing import cast

import fakeredis.aioredis
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.circuit_breaker_service import CircuitBreakerService
from app.services.errors import CircuitBreakerTrippedError
from tests.conftest import FakeAsyncSession


@pytest.mark.asyncio
async def test_check_allows_when_rust_returns_allow(monkeypatch: pytest.MonkeyPatch) -> None:
    redis_client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    service = CircuitBreakerService(
        cast(AsyncSession, FakeAsyncSession()), redis_client=redis_client
    )
    monkeypatch.setattr(
        "app.services.circuit_breaker_service.rust_bridge.check_circuit_breaker",
        lambda *_args, **_kwargs: "Allow",
    )

    await service.check(user_id="user-1", action_type="turn")


@pytest.mark.asyncio
async def test_check_trips_and_sets_trip_key(monkeypatch: pytest.MonkeyPatch) -> None:
    redis_client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    service = CircuitBreakerService(
        cast(AsyncSession, FakeAsyncSession()), redis_client=redis_client
    )
    monkeypatch.setattr(
        "app.services.circuit_breaker_service.rust_bridge.check_circuit_breaker",
        lambda *_args, **_kwargs: {"Trip": {"reason": "too_many"}},
    )

    with pytest.raises(CircuitBreakerTrippedError):
        await service.check(user_id="user-1", action_type="turn")

    assert await redis_client.get("cb_tripped:user-1") == "1"


@pytest.mark.asyncio
async def test_check_cooldown_active_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    redis_client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    service = CircuitBreakerService(
        cast(AsyncSession, FakeAsyncSession()), redis_client=redis_client
    )
    monkeypatch.setattr(
        "app.services.circuit_breaker_service.rust_bridge.check_circuit_breaker",
        lambda *_args, **_kwargs: {"CooldownActive": {"remaining_seconds": 10}},
    )

    with pytest.raises(CircuitBreakerTrippedError):
        await service.check(user_id="user-1", action_type="turn")


@pytest.mark.asyncio
async def test_existing_trip_key_blocks_without_rust_call(monkeypatch: pytest.MonkeyPatch) -> None:
    redis_client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    service = CircuitBreakerService(
        cast(AsyncSession, FakeAsyncSession()), redis_client=redis_client
    )
    await redis_client.set("cb_tripped:user-1", "1")
    called = {"value": False}

    def _should_not_call(*_args: object, **_kwargs: object) -> str:
        called["value"] = True
        return "Allow"

    monkeypatch.setattr(
        "app.services.circuit_breaker_service.rust_bridge.check_circuit_breaker",
        _should_not_call,
    )

    with pytest.raises(CircuitBreakerTrippedError):
        await service.check(user_id="user-1", action_type="turn")
    assert called["value"] is False


@pytest.mark.asyncio
async def test_increment_sets_ttl_on_first_increment() -> None:
    redis_client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    service = CircuitBreakerService(
        cast(AsyncSession, FakeAsyncSession()), redis_client=redis_client
    )
    count = await service.increment(user_id="user-1", action_type="turn")
    ttl = await redis_client.ttl("cb:user-1:turn")
    assert count == 1
    assert ttl > 0


@pytest.mark.asyncio
async def test_get_state_reflects_counter_and_trip_key() -> None:
    redis_client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    service = CircuitBreakerService(
        cast(AsyncSession, FakeAsyncSession()), redis_client=redis_client
    )
    await redis_client.set("cb:user-1:turn", "2")
    await redis_client.set("cb_tripped:user-1", "1")

    state = await service.get_state(user_id="user-1", action_type="turn")
    assert state.current_count == 2
    assert state.is_tripped is True
