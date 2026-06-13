"""Unit tests for StatsService – exercise DB-facing methods directly."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import cast
from unittest.mock import AsyncMock

import pytest
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.api_models import CircuitBreakerStatusResponse
from app.services.audit_service import AuditService
from app.services.circuit_breaker_service import CircuitBreakerService, CircuitBreakerState
from app.services.stats_service import StatsService
from tests.conftest import FakeAsyncSession, FakeQueryResult


def _make_service(db: FakeAsyncSession) -> StatsService:
    fake_redis = AsyncMock(spec=Redis)
    return StatsService(cast(AsyncSession, db), cast(Redis, fake_redis))


# ---------------------------------------------------------------------------
# Individual sub-method tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_claims_total_returns_count() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=7))
    service = _make_service(db)
    result = await service._claims_total(normalized_user_id=uuid.uuid4())
    assert result == 7


@pytest.mark.asyncio
async def test_claims_total_returns_zero_when_none() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=None))
    service = _make_service(db)
    result = await service._claims_total(normalized_user_id=uuid.uuid4())
    assert result == 0


@pytest.mark.asyncio
async def test_claims_by_verification_returns_dict() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[("tentative", 3), ("confirmed", 5)]))
    service = _make_service(db)
    result = await service._claims_by_verification(normalized_user_id=uuid.uuid4())
    assert result == {"tentative": 3, "confirmed": 5}


@pytest.mark.asyncio
async def test_claims_by_verification_empty() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[]))
    service = _make_service(db)
    result = await service._claims_by_verification(normalized_user_id=uuid.uuid4())
    assert result == {}


@pytest.mark.asyncio
async def test_claims_by_sensitivity_returns_dict() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[("S0", 2), ("S1", 4)]))
    service = _make_service(db)
    result = await service._claims_by_sensitivity(normalized_user_id=uuid.uuid4())
    assert result == {"S0": 2, "S1": 4}


@pytest.mark.asyncio
async def test_proposal_counts_returns_pending_and_total() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=2))  # pending
    db.queue_execute_result(FakeQueryResult(single=5))  # total
    service = _make_service(db)
    pending, total = await service._proposal_counts(normalized_user_id=uuid.uuid4())
    assert pending == 2
    assert total == 5


@pytest.mark.asyncio
async def test_proposal_counts_returns_zeros_on_none() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=None))
    db.queue_execute_result(FakeQueryResult(single=None))
    service = _make_service(db)
    pending, total = await service._proposal_counts(normalized_user_id=uuid.uuid4())
    assert pending == 0
    assert total == 0


@pytest.mark.asyncio
async def test_provider_usage_aggregates_providers() -> None:
    db = FakeAsyncSession()
    payloads: list[object] = [
        {"provider": "deepseek"},
        {"provider": "openai"},
        {"provider": "deepseek"},
        None,
        {"other_key": "value"},
        {"provider": ""},
    ]
    db.queue_execute_result(FakeQueryResult(values=payloads))
    service = _make_service(db)
    result = await service._provider_usage(normalized_user_id=uuid.uuid4())
    assert result == {"deepseek": 2, "openai": 1}


@pytest.mark.asyncio
async def test_provider_usage_empty() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[]))
    service = _make_service(db)
    result = await service._provider_usage(normalized_user_id=uuid.uuid4())
    assert result == {}


@pytest.mark.asyncio
async def test_contacts_total_returns_count() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=9))
    service = _make_service(db)
    result = await service._contacts_total(user_id="user-1")
    assert result == 9


@pytest.mark.asyncio
async def test_contacts_total_returns_zero_when_none() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=None))
    service = _make_service(db)
    result = await service._contacts_total(user_id="user-1")
    assert result == 0


@pytest.mark.asyncio
async def test_project_metrics_without_milestone() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=3))  # active projects
    db.queue_execute_result(FakeQueryResult(single=8))  # open tasks
    db.queue_execute_result(FakeQueryResult(single=1))  # critical risks
    db.queue_execute_result(FakeQueryResult(single=None))  # no milestone
    service = _make_service(db)
    active, tasks, risks, milestone = await service._project_metrics(user_id="user-1")
    assert active == 3
    assert tasks == 8
    assert risks == 1
    assert milestone is None


@pytest.mark.asyncio
async def test_project_metrics_with_milestone() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=1))  # active projects
    db.queue_execute_result(FakeQueryResult(single=2))  # open tasks
    db.queue_execute_result(FakeQueryResult(single=0))  # critical risks
    due_date = date(2026, 6, 1)
    db.queue_execute_result(FakeQueryResult(single=("Release v1", due_date)))
    service = _make_service(db)
    active, tasks, risks, milestone = await service._project_metrics(user_id="user-1")
    assert milestone == "Release v1 (2026-06-01)"


@pytest.mark.asyncio
async def test_project_metrics_none_counts_return_zero() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=None))
    db.queue_execute_result(FakeQueryResult(single=None))
    db.queue_execute_result(FakeQueryResult(single=None))
    db.queue_execute_result(FakeQueryResult(single=None))
    service = _make_service(db)
    active, tasks, risks, _ = await service._project_metrics(user_id="user-1")
    assert active == 0
    assert tasks == 0
    assert risks == 0


@pytest.mark.asyncio
async def test_recent_actions_returns_audit_list(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeAsyncSession()
    service = _make_service(db)
    fake_entry = _make_audit_log()
    monkeypatch.setattr(
        AuditService,
        "list_entries",
        AsyncMock(return_value=([fake_entry], 1)),
    )
    result = await service._recent_actions(user_id="user-1")
    assert len(result) == 1
    assert result[0].event_type == "turn_processed"


@pytest.mark.asyncio
async def test_get_circuit_breaker_returns_status(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeAsyncSession()
    service = _make_service(db)
    fake_state = CircuitBreakerState(current_count=3, is_tripped=False)
    monkeypatch.setattr(CircuitBreakerService, "get_state", AsyncMock(return_value=fake_state))
    result = await service._get_circuit_breaker(user_id="user-1")
    assert isinstance(result, CircuitBreakerStatusResponse)
    assert result.current_count == 3
    assert result.is_tripped is False


# ---------------------------------------------------------------------------
# Integration-style test for get_dashboard_stats
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_dashboard_stats_returns_dashboard_stats(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = FakeAsyncSession()
    service = _make_service(db)

    fake_cb = CircuitBreakerStatusResponse(
        current_count=0,
        is_tripped=False,
        max_actions=20,
        window_seconds=60,
        cooldown_seconds=120,
    )

    monkeypatch.setattr(
        StatsService,
        "_collect_db_metrics",
        AsyncMock(
            return_value=_make_db_metrics(),
        ),
    )
    monkeypatch.setattr(
        StatsService,
        "_get_circuit_breaker",
        AsyncMock(return_value=fake_cb),
    )

    stats = await service.get_dashboard_stats(user_id="user-1")
    assert stats.claims_total == 10
    assert stats.proposals_pending == 2
    assert stats.contacts_total == 5


@pytest.mark.asyncio
async def test_collect_db_metrics_calls_all_submethods(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Directly test _collect_db_metrics to cover its body."""
    db = FakeAsyncSession()
    service = _make_service(db)

    monkeypatch.setattr(StatsService, "_claims_total", AsyncMock(return_value=5))
    monkeypatch.setattr(
        StatsService,
        "_claims_by_verification",
        AsyncMock(return_value={"tentative": 5}),
    )
    monkeypatch.setattr(StatsService, "_claims_by_sensitivity", AsyncMock(return_value={"S0": 5}))
    monkeypatch.setattr(StatsService, "_proposal_counts", AsyncMock(return_value=(1, 2)))
    monkeypatch.setattr(StatsService, "_recent_actions", AsyncMock(return_value=[]))
    monkeypatch.setattr(StatsService, "_provider_usage", AsyncMock(return_value={"deepseek": 2}))
    monkeypatch.setattr(StatsService, "_project_metrics", AsyncMock(return_value=(1, 2, 0, None)))
    monkeypatch.setattr(StatsService, "_contacts_total", AsyncMock(return_value=3))

    uid = uuid.uuid4()
    result = await service._collect_db_metrics(user_id="user-1", normalized_user_id=uid)
    assert result.claims_total == 5
    assert result.proposals_pending == 1
    assert result.contacts_total == 3


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_audit_log() -> object:
    """Create a minimal AuditLog-like object for mocking."""
    from types import SimpleNamespace

    return SimpleNamespace(
        audit_id=uuid.uuid4(),
        event_type="turn_processed",
        user_id=uuid.uuid4(),
        channel="web",
        payload={"provider": "deepseek"},
        source_ref="turn-1",
        result="success",
        sensitivity="S1",
        created_at=datetime.now(tz=UTC),
    )


def _make_db_metrics() -> object:
    """Return a _DbMetrics-like namespace for mocking."""
    from app.services.stats_service import _DbMetrics

    return _DbMetrics(
        claims_total=10,
        claims_by_verification={"tentative": 5, "confirmed": 5},
        claims_by_sensitivity={"S0": 8, "S1": 2},
        proposals_pending=2,
        proposals_total=4,
        recent_actions=[],
        provider_usage={"deepseek": 3},
        projects_active=1,
        projects_tasks_open=4,
        projects_risks_critical=0,
        projects_next_milestone=None,
        contacts_total=5,
    )
