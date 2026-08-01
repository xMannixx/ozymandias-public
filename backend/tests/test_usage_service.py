"""Tests for recording LLM usage events."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import cast

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.usage import LLMUsageEvent
from app.schemas import Channel, Sensitivity
from app.services.llm.usage import LLMCallUsage
from app.services.usage_service import (
    UsageService,
    _CallAggregate,
    _MessageAggregate,
    build_totals,
)
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


def test_totals_report_rates_per_assistant_message() -> None:
    totals = build_totals(
        calls=_CallAggregate(
            calls=10,
            failed=2,
            tool_calls=3,
            tokens_total=6000,
            tokens_input=4000,
            tokens_output=2000,
            tokens_cached=1000,
            cost_usd=1.5,
            avg_latency_ms=812.4,
            first_call_at=datetime(2026, 6, 1, 12, 0, tzinfo=UTC),
            last_call_at=datetime(2026, 6, 1, 12, 30, tzinfo=UTC),
        ),
        messages=_MessageAggregate(user=4, assistant=4, sessions=2, assistant_measured=4),
        cache_hit_rate=0.25,
    )

    assert totals.messages_total == 8
    assert totals.error_rate == 0.2
    assert totals.avg_tokens_per_message == 1500
    assert totals.avg_cost_per_message == 0.375
    assert totals.tokens_per_minute == 200
    assert totals.avg_latency_ms == 812
    assert totals.cache_hit_rate == 0.25


def test_totals_stay_silent_instead_of_showing_zero_rates() -> None:
    """Nothing recorded yet must not read as a perfect zero-cost, zero-error day."""
    totals = build_totals(
        calls=_CallAggregate(),
        messages=_MessageAggregate(),
        cache_hit_rate=None,
    )

    assert totals.avg_tokens_per_message is None
    assert totals.avg_cost_per_message is None
    assert totals.tokens_per_minute is None
    assert totals.avg_latency_ms is None
    assert totals.cache_hit_rate is None
    assert totals.error_rate == 0.0


def test_throughput_needs_two_moments_in_time() -> None:
    """A single call spans no time, so tokens per minute would be infinite."""
    moment = datetime(2026, 6, 1, 12, 0, tzinfo=UTC)
    totals = build_totals(
        calls=_CallAggregate(
            calls=1,
            tokens_total=5000,
            first_call_at=moment,
            last_call_at=moment,
        ),
        messages=_MessageAggregate(assistant=1, assistant_measured=1),
        cache_hit_rate=None,
    )

    assert totals.tokens_per_minute is None


def test_averages_ignore_answers_from_before_recording_began() -> None:
    """Older chats still count as messages, but must not drag the averages down."""
    totals = build_totals(
        calls=_CallAggregate(calls=2, tokens_total=4000, cost_usd=0.5),
        messages=_MessageAggregate(user=10, assistant=10, sessions=3, assistant_measured=2),
        cache_hit_rate=None,
    )

    assert totals.messages_assistant == 10
    assert totals.avg_tokens_per_message == 2000
    assert totals.avg_cost_per_message == 0.25


def test_unpriced_calls_are_reported_next_to_the_cost() -> None:
    """Cost is understated when a model has no price, so say how often that happened."""
    totals = build_totals(
        calls=_CallAggregate(calls=5, unpriced=2, cost_usd=0.42),
        messages=_MessageAggregate(assistant=5, assistant_measured=5),
        cache_hit_rate=None,
    )

    assert totals.cost_usd == 0.42
    assert totals.unpriced_calls == 2


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
