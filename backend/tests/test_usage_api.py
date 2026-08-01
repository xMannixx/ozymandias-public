"""API tests for the usage report endpoint."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from app.schemas.api_models import (
    UsageBreakdownItem,
    UsageBucket,
    UsageCount,
    UsageRangeLiteral,
    UsageReport,
    UsageTotals,
)
from app.services.usage_service import UsageService


def _report(range_key: UsageRangeLiteral) -> UsageReport:
    return UsageReport(
        range=range_key,
        since=datetime(2026, 6, 1, tzinfo=UTC),
        generated_at=datetime(2026, 6, 2, tzinfo=UTC),
        bucket_unit="hour" if range_key == "24h" else "day",
        totals=UsageTotals(
            messages_total=8,
            messages_user=4,
            messages_assistant=4,
            sessions=2,
            calls=10,
            calls_failed=1,
            error_rate=0.1,
            tool_calls=2,
            tokens_total=6000,
            tokens_input=4000,
            tokens_output=2000,
            tokens_cached=1000,
            tokens_per_minute=200.0,
            avg_tokens_per_message=1500.0,
            cache_hit_rate=0.25,
            avg_latency_ms=812,
            cost_usd=1.5,
            avg_cost_per_message=0.375,
            unpriced_calls=0,
        ),
        top_models=[
            UsageBreakdownItem(key="gpt-4o", calls=6, tokens=4000, cost_usd=1.2, cost_share=0.8)
        ],
        top_providers=[
            UsageBreakdownItem(key="openai", calls=6, tokens=4000, cost_usd=1.2, cost_share=0.8)
        ],
        top_tools=[],
        top_channels=[
            UsageBreakdownItem(key="web", calls=10, tokens=6000, cost_usd=1.5, cost_share=1.0)
        ],
        top_call_types=[
            UsageBreakdownItem(key="chat", calls=8, tokens=5800, cost_usd=1.45, cost_share=0.97)
        ],
        errors_by_kind=[UsageCount(label="ConnectionError", count=1)],
        errors_by_day=[UsageCount(label="2026-06-01", count=1)],
        errors_by_hour=[UsageCount(label="14:00", count=1)],
        series=[
            UsageBucket(
                bucket=datetime(2026, 6, 1, 14, tzinfo=UTC),
                calls=10,
                tokens=6000,
                cost_usd=1.5,
                errors=1,
            )
        ],
    )


@pytest.mark.asyncio
async def test_get_usage_defaults_to_the_last_day(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: dict[str, str] = {}

    async def fake_report(
        self: UsageService, *, user_id: str, range_key: UsageRangeLiteral
    ) -> UsageReport:
        del self
        seen["user_id"] = user_id
        seen["range"] = range_key
        return _report(range_key)

    monkeypatch.setattr(UsageService, "get_report", fake_report)
    response = await client.get("/usage")

    assert response.status_code == 200
    assert seen == {"user_id": "test-user-id", "range": "24h"}
    body = response.json()
    assert body["range"] == "24h"
    assert body["bucket_unit"] == "hour"
    assert body["totals"]["cost_usd"] == 1.5
    assert body["top_models"][0]["key"] == "gpt-4o"


@pytest.mark.asyncio
async def test_get_usage_accepts_longer_ranges(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_report(
        self: UsageService, *, user_id: str, range_key: UsageRangeLiteral
    ) -> UsageReport:
        del self, user_id
        return _report(range_key)

    monkeypatch.setattr(UsageService, "get_report", fake_report)
    response = await client.get("/usage", params={"range": "30d"})

    assert response.status_code == 200
    assert response.json()["range"] == "30d"
    assert response.json()["bucket_unit"] == "day"


@pytest.mark.asyncio
async def test_get_usage_rejects_an_unknown_range(client: AsyncClient) -> None:
    response = await client.get("/usage", params={"range": "since-forever"})
    assert response.status_code == 422
