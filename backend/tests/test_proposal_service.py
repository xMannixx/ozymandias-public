"""Unit tests for proposal service."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import cast
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.proposal import MemoryProposal
from app.schemas import (
    ClaimData,
    HandlingPolicy,
    Lifecycle,
    ProposalData,
    Sensitivity,
    SourceType,
    TrustLevel,
    VerificationState,
)
from app.services.claim_service import ClaimService
from app.services.errors import ConflictError, NotFoundError
from app.services.proposal_service import ProposalService
from tests.conftest import FakeAsyncSession, FakeQueryResult


def _claim_payload() -> dict[str, object]:
    claim = ClaimData(
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
    return claim.model_dump(mode="json")


def _proposal_model(status: str = "pending") -> MemoryProposal:
    now = datetime.now(tz=UTC)
    return MemoryProposal(
        proposal_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        proposed_claim=_claim_payload(),
        source_ref="turn-1",
        source_type="user_explicit",
        status=status,
        conflict_group_id=None,
        rejection_reason=None,
        created_at=now,
        decided_at=None,
        decided_by=None,
    )


@pytest.mark.asyncio
async def test_list_proposals_empty() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[]))
    service = ProposalService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    proposals = await service.list_proposals(user_id="user")
    assert proposals == []


@pytest.mark.asyncio
async def test_list_proposals_with_status() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[_proposal_model()]))
    service = ProposalService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    proposals = await service.list_proposals(user_id="user", status="pending")
    assert len(proposals) == 1


@pytest.mark.asyncio
async def test_create_proposal_inserts_record() -> None:
    db = FakeAsyncSession()
    service = ProposalService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    proposal_data = ProposalData.model_validate(
        {"proposed_claim": _claim_payload(), "source_ref": "turn-1", "source_type": "user_explicit"}
    )
    created = await service.create_proposal(user_id="user-1", proposal=proposal_data)
    assert created.status == "pending"
    assert db.commits >= 1


@pytest.mark.asyncio
async def test_approve_proposal_marks_confirmed(monkeypatch: pytest.MonkeyPatch) -> None:
    proposal = _proposal_model(status="pending")
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=proposal))
    service = ProposalService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]
    monkeypatch.setattr(ClaimService, "create_claim_from_proposal", AsyncMock())

    approved = await service.approve_proposal(
        proposal_id=str(proposal.proposal_id),
        user_id="user-1",
        decided_by="owner",
    )
    assert approved.status == "confirmed"


@pytest.mark.asyncio
async def test_approve_proposal_requires_pending() -> None:
    proposal = _proposal_model(status="rejected")
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=proposal))
    service = ProposalService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    with pytest.raises(ConflictError):
        await service.approve_proposal(
            proposal_id=str(proposal.proposal_id),
            user_id="user-1",
            decided_by="owner",
        )


@pytest.mark.asyncio
async def test_reject_proposal_marks_rejected() -> None:
    proposal = _proposal_model(status="pending")
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=proposal))
    service = ProposalService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    rejected = await service.reject_proposal(
        proposal_id=str(proposal.proposal_id),
        user_id="user-1",
        decided_by="owner",
        reason="invalid source",
    )
    assert rejected.status == "rejected"
    assert rejected.rejection_reason == "invalid source"


@pytest.mark.asyncio
async def test_reject_proposal_requires_pending() -> None:
    proposal = _proposal_model(status="confirmed")
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=proposal))
    service = ProposalService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    with pytest.raises(ConflictError):
        await service.reject_proposal(
            proposal_id=str(proposal.proposal_id),
            user_id="user-1",
            decided_by="owner",
            reason="x",
        )


@pytest.mark.asyncio
async def test_get_proposal_not_found_raises() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=None))
    service = ProposalService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    with pytest.raises(NotFoundError):
        await service.approve_proposal(
            proposal_id="00000000-0000-0000-0000-000000000001",
            user_id="user-1",
            decided_by="owner",
        )
