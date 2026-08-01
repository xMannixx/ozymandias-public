"""Tests for recording LLM usage events."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import cast

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.usage import LLMUsageEvent
from app.schemas import Channel, Sensitivity
from app.services.llm.usage import LLMCallUsage
from app.services.usage_service import UsageService
from tests.conftest import FakeAsyncSession


def _call(**overrides: object) -> LLMCallUsage:
    defaults: dict[str, object] = {
        "call_type": "chat",
        "provider": "openai",
        "model": "gpt-4o",
        "status": "ok",
        "latency_ms": 1200,
        "prompt_tokens": 1_000_000,
        "completion_tokens": 100_000,
        "cached_prompt_tokens": 500_000,
        "total_tokens": 1_100_000,
    }
    defaults.update(overrides)
    return LLMCallUsage(**cast(dict, defaults))


@pytest.mark.asyncio
async def test_record_calls_stores_one_row_per_call_with_cost() -> None:
    session = FakeAsyncSession()
    conversation_id = str(uuid.uuid4())

    written = await UsageService(cast(AsyncSession, session)).record_calls(
        [_call(), _call(provider="ollama", model="llama3")],
        user_id="user-1",
        channel=Channel.web,
        sensitivity=Sensitivity.S1,
        turn_id="turn-1",
        conversation_id=conversation_id,
    )

    assert written == 2
    rows = [row for row in session.added if isinstance(row, LLMUsageEvent)]
    assert len(rows) == 2
    assert rows[0].cost_usd == Decimal("2.875000")
    assert rows[0].channel == "web"
    assert rows[0].sensitivity == "S1"
    assert rows[0].turn_id == "turn-1"
    assert str(rows[0].conversation_id) == conversation_id
    assert rows[1].cost_usd == Decimal(0)
    assert session.commits == 1


@pytest.mark.asyncio
async def test_record_calls_leaves_cost_open_for_unpriced_models() -> None:
    session = FakeAsyncSession()

    await UsageService(cast(AsyncSession, session)).record_calls(
        [_call(model="gpt-tomorrow")],
        user_id="user-1",
        channel=Channel.web,
        sensitivity=Sensitivity.S0,
    )

    row = cast(LLMUsageEvent, session.added[0])
    assert row.cost_usd is None


@pytest.mark.asyncio
async def test_record_calls_keeps_failed_attempts() -> None:
    session = FakeAsyncSession()

    await UsageService(cast(AsyncSession, session)).record_calls(
        [
            _call(
                status="error",
                error_kind="ConnectionError",
                prompt_tokens=0,
                completion_tokens=0,
                cached_prompt_tokens=0,
                total_tokens=0,
            )
        ],
        user_id="user-1",
        channel=Channel.telegram,
        sensitivity=Sensitivity.S0,
    )

    row = cast(LLMUsageEvent, session.added[0])
    assert row.status == "error"
    assert row.error_kind == "ConnectionError"
    assert row.total_tokens == 0


@pytest.mark.asyncio
async def test_record_calls_without_records_touches_nothing() -> None:
    session = FakeAsyncSession()

    written = await UsageService(cast(AsyncSession, session)).record_calls(
        [],
        user_id="user-1",
        channel=Channel.web,
        sensitivity=Sensitivity.S0,
    )

    assert written == 0
    assert session.added == []
    assert session.commits == 0


@pytest.mark.asyncio
async def test_record_calls_ignores_unusable_reference_ids() -> None:
    """A malformed id must not cost us the metric for the whole turn."""
    session = FakeAsyncSession()

    await UsageService(cast(AsyncSession, session)).record_calls(
        [_call()],
        user_id="user-1",
        channel=Channel.web,
        sensitivity=Sensitivity.S0,
        conversation_id="not-a-uuid",
        project_id="also-not-a-uuid",
    )

    row = cast(LLMUsageEvent, session.added[0])
    assert row.conversation_id is None
    assert row.project_id is None
