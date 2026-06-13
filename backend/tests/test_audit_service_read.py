"""Unit tests for AuditService list_entries reader."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import cast

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.services.audit_service import AuditService
from tests.conftest import FakeAsyncSession, FakeQueryResult


class RecordingSession(FakeAsyncSession):
    """Capture executed SQL statements and return queued results."""

    def __init__(self, responses: list[FakeQueryResult]) -> None:
        super().__init__()
        self.responses = responses
        self.queries: list[str] = []

    async def execute(self, query: object) -> FakeQueryResult:
        self.queries.append(str(query))
        if self.responses:
            return self.responses.pop(0)
        return FakeQueryResult(values=[])


def _audit_entry() -> AuditLog:
    return AuditLog(
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


@pytest.mark.asyncio
async def test_list_entries_orders_by_created_at_desc() -> None:
    db = RecordingSession([FakeQueryResult(values=[_audit_entry()]), FakeQueryResult(single=1)])
    service = AuditService(cast(AsyncSession, db))

    await service.list_entries(
        user_id="user-1",
        event_type=None,
        sensitivity=None,
        result=None,
        after=None,
        before=None,
        limit=50,
        offset=0,
    )
    assert "ORDER BY audit_log.created_at DESC" in db.queries[0]


@pytest.mark.asyncio
async def test_list_entries_applies_event_type_filter() -> None:
    db = RecordingSession([FakeQueryResult(values=[]), FakeQueryResult(single=0)])
    service = AuditService(cast(AsyncSession, db))

    await service.list_entries(
        user_id="user-1",
        event_type="memory_confirmed",
        sensitivity=None,
        result=None,
        after=None,
        before=None,
        limit=50,
        offset=0,
    )
    assert "audit_log.event_type =" in db.queries[0]


@pytest.mark.asyncio
async def test_list_entries_excludes_s4_when_enabled() -> None:
    db = RecordingSession([FakeQueryResult(values=[]), FakeQueryResult(single=0)])
    service = AuditService(cast(AsyncSession, db))

    await service.list_entries(
        user_id="user-1",
        event_type=None,
        sensitivity=None,
        result=None,
        after=None,
        before=None,
        limit=50,
        offset=0,
        exclude_s4=True,
    )
    assert "audit_log.sensitivity !=" in db.queries[0]


@pytest.mark.asyncio
async def test_list_entries_can_include_s4_when_disabled() -> None:
    db = RecordingSession([FakeQueryResult(values=[]), FakeQueryResult(single=0)])
    service = AuditService(cast(AsyncSession, db))

    await service.list_entries(
        user_id="user-1",
        event_type=None,
        sensitivity=None,
        result=None,
        after=None,
        before=None,
        limit=50,
        offset=0,
        exclude_s4=False,
    )
    assert "audit_log.sensitivity !=" not in db.queries[0]


@pytest.mark.asyncio
async def test_list_entries_returns_total_count_with_pagination() -> None:
    db = RecordingSession([FakeQueryResult(values=[_audit_entry()]), FakeQueryResult(single=7)])
    service = AuditService(cast(AsyncSession, db))

    entries, total = await service.list_entries(
        user_id="user-1",
        event_type=None,
        sensitivity=None,
        result=None,
        after=None,
        before=None,
        limit=5,
        offset=0,
    )
    assert len(entries) == 1
    assert total == 7
