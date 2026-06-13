"""Unit tests for claim lifecycle service methods."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import cast
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.claim import Claim, ClaimVersion
from app.schemas import AuditEventType, Sensitivity
from app.services.claim_service import ClaimService
from app.services.errors import ConflictError, NotFoundError
from tests.conftest import FakeAsyncSession, FakeQueryResult


def _claim_model(
    *,
    verification_state: str = "tentative",
    user_locked: bool = False,
    decay_eligible: bool = True,
    sensitivity: str = "S1",
    handling_policy: str = "local_preferred",
    lifecycle: str = "temporary",
    updated_at: datetime | None = None,
) -> Claim:
    now = datetime.now(tz=UTC)
    return Claim(
        claim_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        subject="user:42",
        attribute="city",
        value="Berlin",
        content="User lives in Berlin",
        memory_type="profile",
        verification_state=verification_state,
        confidence=0.8,
        source_ref="turn-1",
        source_type="user_explicit",
        sensitivity=sensitivity,
        trust_level="T3",
        handling_policy=handling_policy,
        user_locked=user_locked,
        decay_eligible=decay_eligible,
        lifecycle=lifecycle,
        valid_from=None,
        valid_to=None,
        ingested_at=now,
        superseded_at=None,
        review_due=False,
        last_reviewed=None,
        last_accessed=None,
        created_at=now,
        updated_at=updated_at or now,
    )


def _version_model(claim_id: uuid.UUID, version_number: int) -> ClaimVersion:
    return ClaimVersion(
        version_id=uuid.uuid4(),
        claim_id=claim_id,
        version_number=version_number,
        version_hash=f"hash-{version_number}",
        previous_hash=None if version_number == 1 else f"hash-{version_number - 1}",
        content_snapshot={"version": version_number},
        change_reason="test",
        changed_by="user",
        created_at=datetime.now(tz=UTC),
    )


@pytest.mark.asyncio
async def test_archive_claim_sets_lifecycle_and_decay(monkeypatch: pytest.MonkeyPatch) -> None:
    claim = _claim_model()
    db = FakeAsyncSession()
    service = ClaimService(cast(AsyncSession, db))
    record_version = AsyncMock()
    monkeypatch.setattr(service, "get_claim", AsyncMock(return_value=claim))
    monkeypatch.setattr(service, "_record_version", record_version)
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    archived = await service.archive_claim(claim_id=str(claim.claim_id), user_id="test-user")

    assert archived.lifecycle == "archived"
    assert archived.decay_eligible is False
    assert record_version.await_count == 1


@pytest.mark.asyncio
async def test_archive_claim_sets_updated_at(monkeypatch: pytest.MonkeyPatch) -> None:
    old_updated_at = datetime(2020, 1, 1, tzinfo=UTC)
    claim = _claim_model(updated_at=old_updated_at)
    db = FakeAsyncSession()
    service = ClaimService(cast(AsyncSession, db))
    monkeypatch.setattr(service, "get_claim", AsyncMock(return_value=claim))
    monkeypatch.setattr(service, "_record_version", AsyncMock())
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    archived = await service.archive_claim(claim_id=str(claim.claim_id), user_id="test-user")

    assert archived.updated_at is not None
    assert archived.updated_at > old_updated_at


@pytest.mark.asyncio
async def test_list_versions_returns_desc_order(monkeypatch: pytest.MonkeyPatch) -> None:
    claim = _claim_model()
    versions = [_version_model(claim.claim_id, 2), _version_model(claim.claim_id, 1)]
    db = FakeAsyncSession()
    service = ClaimService(cast(AsyncSession, db))
    monkeypatch.setattr(service, "get_claim", AsyncMock(return_value=claim))

    captured: dict[str, str] = {"query": ""}

    async def fake_execute(query: object) -> FakeQueryResult:
        captured["query"] = str(query)
        return FakeQueryResult(values=cast(list[object], versions))

    monkeypatch.setattr(db, "execute", fake_execute)
    listed = await service.list_versions(claim_id=str(claim.claim_id), user_id="test-user")

    assert [item.version_number for item in listed] == [2, 1]
    assert "ORDER BY" in captured["query"]
    assert "DESC" in captured["query"]


@pytest.mark.asyncio
async def test_list_versions_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    claim = _claim_model()
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[]))
    service = ClaimService(cast(AsyncSession, db))
    monkeypatch.setattr(service, "get_claim", AsyncMock(return_value=claim))

    listed = await service.list_versions(claim_id=str(claim.claim_id), user_id="test-user")

    assert listed == []


@pytest.mark.asyncio
async def test_list_versions_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeAsyncSession()
    service = ClaimService(cast(AsyncSession, db))
    monkeypatch.setattr(service, "get_claim", AsyncMock(side_effect=NotFoundError("missing")))

    with pytest.raises(NotFoundError):
        await service.list_versions(claim_id="missing", user_id="test-user")


@pytest.mark.asyncio
async def test_confirm_claim_success_sets_state_version_and_updated_at(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    old_updated_at = datetime(2020, 1, 1, tzinfo=UTC)
    claim = _claim_model(verification_state="tentative", updated_at=old_updated_at)
    db = FakeAsyncSession()
    service = ClaimService(cast(AsyncSession, db))
    record_version = AsyncMock()
    monkeypatch.setattr(service, "get_claim", AsyncMock(return_value=claim))
    monkeypatch.setattr(service, "_record_version", record_version)
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    confirmed = await service.confirm_claim(claim_id=str(claim.claim_id), user_id="test-user")

    assert confirmed.verification_state == "confirmed"
    assert confirmed.updated_at is not None
    assert confirmed.updated_at > old_updated_at
    assert record_version.await_count == 1


@pytest.mark.asyncio
async def test_confirm_claim_conflict_when_retracted(monkeypatch: pytest.MonkeyPatch) -> None:
    claim = _claim_model(verification_state="retracted")
    db = FakeAsyncSession()
    service = ClaimService(cast(AsyncSession, db))
    monkeypatch.setattr(service, "get_claim", AsyncMock(return_value=claim))

    with pytest.raises(ConflictError):
        await service.confirm_claim(claim_id=str(claim.claim_id), user_id="test-user")


@pytest.mark.asyncio
async def test_confirm_claim_conflict_when_already_confirmed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    claim = _claim_model(verification_state="confirmed")
    db = FakeAsyncSession()
    service = ClaimService(cast(AsyncSession, db))
    monkeypatch.setattr(service, "get_claim", AsyncMock(return_value=claim))

    with pytest.raises(ConflictError):
        await service.confirm_claim(claim_id=str(claim.claim_id), user_id="test-user")


@pytest.mark.asyncio
async def test_confirm_claim_writes_memory_confirmed_audit(monkeypatch: pytest.MonkeyPatch) -> None:
    claim = _claim_model(verification_state="tentative")
    db = FakeAsyncSession()
    service = ClaimService(cast(AsyncSession, db))
    monkeypatch.setattr(service, "get_claim", AsyncMock(return_value=claim))
    monkeypatch.setattr(service, "_record_version", AsyncMock())
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    await service.confirm_claim(claim_id=str(claim.claim_id), user_id="test-user")

    assert service.audit.log.await_count == 1
    await_args = service.audit.log.await_args
    assert await_args is not None
    kwargs = await_args.kwargs
    assert kwargs["event_type"] == AuditEventType.memory_confirmed


@pytest.mark.asyncio
async def test_lock_claim_sets_locked_and_disables_decay(monkeypatch: pytest.MonkeyPatch) -> None:
    claim = _claim_model(user_locked=False, decay_eligible=True)
    db = FakeAsyncSession()
    service = ClaimService(cast(AsyncSession, db))
    record_version = AsyncMock()
    monkeypatch.setattr(service, "get_claim", AsyncMock(return_value=claim))
    monkeypatch.setattr(service, "_record_version", record_version)
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    locked = await service.lock_claim(claim_id=str(claim.claim_id), user_id="test-user")

    assert locked.user_locked is True
    assert locked.decay_eligible is False
    assert record_version.await_count == 1


@pytest.mark.asyncio
async def test_lock_claim_conflict_when_already_locked(monkeypatch: pytest.MonkeyPatch) -> None:
    claim = _claim_model(user_locked=True, decay_eligible=False)
    db = FakeAsyncSession()
    service = ClaimService(cast(AsyncSession, db))
    monkeypatch.setattr(service, "get_claim", AsyncMock(return_value=claim))

    with pytest.raises(ConflictError):
        await service.lock_claim(claim_id=str(claim.claim_id), user_id="test-user")


@pytest.mark.asyncio
async def test_unlock_claim_sets_unlocked_and_enables_decay(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    claim = _claim_model(user_locked=True, decay_eligible=False)
    db = FakeAsyncSession()
    service = ClaimService(cast(AsyncSession, db))
    monkeypatch.setattr(service, "get_claim", AsyncMock(return_value=claim))
    monkeypatch.setattr(service, "_record_version", AsyncMock())
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    unlocked = await service.unlock_claim(claim_id=str(claim.claim_id), user_id="test-user")

    assert unlocked.user_locked is False
    assert unlocked.decay_eligible is True


@pytest.mark.asyncio
async def test_unlock_claim_conflict_when_not_locked(monkeypatch: pytest.MonkeyPatch) -> None:
    claim = _claim_model(user_locked=False, decay_eligible=True)
    db = FakeAsyncSession()
    service = ClaimService(cast(AsyncSession, db))
    monkeypatch.setattr(service, "get_claim", AsyncMock(return_value=claim))

    with pytest.raises(ConflictError):
        await service.unlock_claim(claim_id=str(claim.claim_id), user_id="test-user")


@pytest.mark.asyncio
async def test_update_sensitivity_maps_policy_for_s4_s3_s0(monkeypatch: pytest.MonkeyPatch) -> None:
    claim = _claim_model()
    db = FakeAsyncSession()
    service = ClaimService(cast(AsyncSession, db))
    record_version = AsyncMock()
    monkeypatch.setattr(service, "get_claim", AsyncMock(return_value=claim))
    monkeypatch.setattr(service, "_record_version", record_version)
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    updated_s4 = await service.update_sensitivity(
        claim_id=str(claim.claim_id),
        user_id="test-user",
        sensitivity=Sensitivity.S4,
    )
    assert updated_s4.sensitivity == "S4"
    assert updated_s4.handling_policy == "s4_isolated"

    updated_s3 = await service.update_sensitivity(
        claim_id=str(claim.claim_id),
        user_id="test-user",
        sensitivity=Sensitivity.S3,
    )
    assert updated_s3.sensitivity == "S3"
    assert updated_s3.handling_policy == "local_only"

    updated_s0 = await service.update_sensitivity(
        claim_id=str(claim.claim_id),
        user_id="test-user",
        sensitivity=Sensitivity.S0,
    )
    assert updated_s0.sensitivity == "S0"
    assert updated_s0.handling_policy == "cloud_ok_encrypted"

    assert record_version.await_count == 3
