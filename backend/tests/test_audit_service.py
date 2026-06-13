"""Unit tests for audit service."""

from __future__ import annotations

from typing import cast

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas import AuditEventType, AuditResult, Channel, Sensitivity
from app.services.audit_service import AuditService
from app.services.errors import ValidationError
from tests.conftest import FakeAsyncSession


@pytest.mark.asyncio
async def test_log_writes_audit_record(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeAsyncSession()
    service = AuditService(cast(AsyncSession, db))
    monkeypatch.setattr(
        "app.services.audit_service.rust_bridge.validate_audit_entry", lambda _e: "Valid"
    )

    record = await service.log(
        event_type=AuditEventType.turn_processed,
        result=AuditResult.success,
        user_id="test-user",
        channel=Channel.system,
        actor="service:test",
        target_id="turn-1",
        detail="done",
        payload={"k": "v"},
        source_ref="turn-1",
        sensitivity=Sensitivity.S1,
    )
    assert record.event_type == "turn_processed"
    assert db.commits == 1
    assert db.refreshes == 1


@pytest.mark.asyncio
async def test_log_raises_when_rust_validation_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeAsyncSession()
    service = AuditService(cast(AsyncSession, db))
    monkeypatch.setattr(
        "app.services.audit_service.rust_bridge.validate_audit_entry",
        lambda _e: {"Invalid": {"errors": ["x"], "warnings": []}},
    )

    with pytest.raises(ValidationError):
        await service.log(
            event_type=AuditEventType.turn_processed,
            result=AuditResult.failed,
            user_id="test-user",
            channel=Channel.system,
            actor="service:test",
            target_id="turn-1",
            detail="failed",
            payload={"x": 1},
            source_ref="turn-1",
            sensitivity=Sensitivity.S0,
        )


@pytest.mark.asyncio
async def test_log_without_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeAsyncSession()
    service = AuditService(cast(AsyncSession, db))
    monkeypatch.setattr(
        "app.services.audit_service.rust_bridge.validate_audit_entry", lambda _e: "Valid"
    )

    record = await service.log(
        event_type=AuditEventType.action_executed,
        result=AuditResult.success,
        user_id="abc",
        channel=Channel.web,
        actor="service:test",
        target_id="claim-1",
        detail="executed",
        payload=None,
        source_ref=None,
        sensitivity=Sensitivity.S0,
    )
    assert record.payload is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("event_type", "result"),
    [
        (AuditEventType.memory_confirmed, AuditResult.success),
        (AuditEventType.memory_rejected, AuditResult.failed),
        (AuditEventType.action_blocked, AuditResult.blocked),
    ],
)
async def test_log_supports_multiple_event_types(
    monkeypatch: pytest.MonkeyPatch,
    event_type: AuditEventType,
    result: AuditResult,
) -> None:
    db = FakeAsyncSession()
    service = AuditService(cast(AsyncSession, db))
    monkeypatch.setattr(
        "app.services.audit_service.rust_bridge.validate_audit_entry", lambda _e: "Valid"
    )

    record = await service.log(
        event_type=event_type,
        result=result,
        user_id="u",
        channel=Channel.system,
        actor="svc",
        target_id="t",
        detail="d",
        payload={"kind": "x"},
        source_ref="s",
        sensitivity=Sensitivity.S2,
    )
    assert record.event_type == event_type.value
    assert record.result == result.value
