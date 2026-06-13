"""Unit tests for claim service."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, datetime
from typing import cast
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.claim import Claim
from app.schemas import (
    ClaimData,
    HandlingPolicy,
    Lifecycle,
    Sensitivity,
    SourceType,
    TrustLevel,
    VerificationState,
)
from app.services.claim_service import ClaimService, _compute_version_hash
from app.services.errors import NotFoundError
from tests.conftest import FakeAsyncSession, FakeQueryResult


def _claim_data() -> ClaimData:
    return ClaimData(
        subject="user:42",
        attribute="city",
        value="Berlin",
        content="User lives in Berlin",
        memory_type="profile",
        sensitivity=Sensitivity.S1,
        trust_level=TrustLevel.T3,
        handling_policy=HandlingPolicy.local_preferred,
        verification_state=VerificationState.tentative,
        confidence=0.8,
        source_type=SourceType.user_explicit,
        source_ref="turn-1",
        user_locked=False,
        decay_eligible=True,
        lifecycle=Lifecycle.temporary,
        valid_from=None,
        valid_to=None,
    )


def _claim_model() -> Claim:
    now = datetime.now(tz=UTC)
    return Claim(
        claim_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        subject="user:42",
        attribute="city",
        value="Berlin",
        content="User lives in Berlin",
        memory_type="profile",
        verification_state="tentative",
        confidence=0.8,
        source_ref="turn-1",
        source_type="user_explicit",
        sensitivity="S1",
        trust_level="T3",
        handling_policy="local_preferred",
        user_locked=False,
        decay_eligible=True,
        lifecycle="temporary",
        valid_from=None,
        valid_to=None,
        ingested_at=now,
        superseded_at=None,
        review_due=False,
        last_reviewed=None,
        last_accessed=None,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_list_claims_empty_result() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[]))
    service = ClaimService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    claims = await service.list_claims(user_id="test-user")
    assert claims == []


@pytest.mark.asyncio
async def test_list_claims_with_subject_filter() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[_claim_model()]))
    service = ClaimService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    claims = await service.list_claims(user_id="test-user", subject="user:42")
    assert len(claims) == 1


@pytest.mark.asyncio
async def test_get_claim_found() -> None:
    claim = _claim_model()
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=claim))
    service = ClaimService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    loaded = await service.get_claim(claim_id=str(claim.claim_id), user_id="test-user")
    assert loaded.subject == "user:42"


@pytest.mark.asyncio
async def test_get_claim_not_found() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=None))
    service = ClaimService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    with pytest.raises(NotFoundError):
        await service.get_claim(
            claim_id="00000000-0000-0000-0000-000000000001",
            user_id="test-user",
        )


@pytest.mark.asyncio
async def test_create_claim_from_proposal_calls_version_and_audit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = FakeAsyncSession()
    service = ClaimService(cast(AsyncSession, db))
    record_version = AsyncMock()
    monkeypatch.setattr(service, "_record_version", record_version)
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    claim = await service.create_claim_from_proposal(
        user_id="test-user",
        claim_data=_claim_data(),
        source_ref="turn-1",
        source_type=SourceType.user_explicit,
    )
    assert claim.subject == "user:42"
    assert record_version.await_count == 1
    assert service.audit.log.await_count == 1


@pytest.mark.asyncio
async def test_retract_claim_updates_state(monkeypatch: pytest.MonkeyPatch) -> None:
    claim = _claim_model()
    db = FakeAsyncSession()
    service = ClaimService(cast(AsyncSession, db))
    monkeypatch.setattr(service, "get_claim", AsyncMock(return_value=claim))
    monkeypatch.setattr(service, "_record_version", AsyncMock())
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    retracted = await service.retract_claim(claim_id=str(claim.claim_id), user_id="test-user")
    assert retracted.verification_state == "retracted"
    assert db.commits >= 1


def test_compute_version_hash_is_deterministic() -> None:
    snapshot = {"b": 2, "a": 1}
    left = _compute_version_hash(snapshot)
    right = _compute_version_hash({"a": 1, "b": 2})
    assert left == right


def test_compute_version_hash_uses_sha256() -> None:
    snapshot = {"a": 1, "b": "x"}
    canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"))
    expected = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    assert _compute_version_hash(snapshot) == expected
