"""API tests for proposal endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import AsyncClient

from app.models.proposal import MemoryProposal
from app.services.proposal_service import ProposalService


def _proposal_model(status: str = "pending") -> MemoryProposal:
    now = datetime.now(tz=UTC)
    return MemoryProposal(
        proposal_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        proposed_claim={"subject": "user:42", "value": "Berlin"},
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
async def test_list_proposals_returns_list(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_list(
        self: ProposalService, *, user_id: str, status: str | None
    ) -> list[MemoryProposal]:
        assert user_id == "test-user-id"
        assert status is None
        return [_proposal_model()]

    monkeypatch.setattr(ProposalService, "list_proposals", fake_list)
    response = await client.get("/proposals")
    assert response.status_code == 200
    assert len(response.json()) == 1


@pytest.mark.asyncio
async def test_create_proposal_returns_201(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_create(
        self: ProposalService,
        *,
        user_id: str,
        proposal: Any,
        conflict_group_id: str | None,
    ) -> MemoryProposal:
        assert user_id == "test-user-id"
        assert proposal is not None
        assert conflict_group_id is None
        return _proposal_model()

    monkeypatch.setattr(ProposalService, "create_proposal", fake_create)
    response = await client.post(
        "/proposals",
        json={
            "proposal": {
                "proposed_claim": {
                    "subject": "user:42",
                    "attribute": "city",
                    "value": "Berlin",
                    "content": "User lives in Berlin",
                    "memory_type": "profile",
                    "sensitivity": "S1",
                    "trust_level": "T3",
                    "handling_policy": "local_preferred",
                    "verification_state": "tentative",
                    "confidence": 0.8,
                    "source_type": "user_explicit",
                    "source_ref": "turn-1",
                    "user_locked": False,
                    "decay_eligible": True,
                    "lifecycle": "temporary",
                    "valid_from": None,
                    "valid_to": None,
                },
                "source_ref": "turn-1",
                "source_type": "user_explicit",
            },
            "conflict_group_id": None,
        },
    )
    assert response.status_code == 201
    assert response.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_approve_proposal_returns_200(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_approve(
        self: ProposalService, *, proposal_id: str, user_id: str, decided_by: str
    ) -> MemoryProposal:
        assert proposal_id
        assert user_id == "test-user-id"
        assert decided_by == "test-user-id"
        return _proposal_model(status="confirmed")

    monkeypatch.setattr(ProposalService, "approve_proposal", fake_approve)
    response = await client.post("/proposals/00000000-0000-0000-0000-000000000001/approve")
    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"


@pytest.mark.asyncio
async def test_reject_proposal_returns_200(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_reject(
        self: ProposalService,
        *,
        proposal_id: str,
        user_id: str,
        decided_by: str,
        reason: str | None,
    ) -> MemoryProposal:
        assert proposal_id
        assert user_id == "test-user-id"
        assert decided_by == "test-user-id"
        assert reason == "not trusted"
        model = _proposal_model(status="rejected")
        model.rejection_reason = reason
        return model

    monkeypatch.setattr(ProposalService, "reject_proposal", fake_reject)
    response = await client.post(
        "/proposals/00000000-0000-0000-0000-000000000001/reject",
        json={"reason": "not trusted"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"
