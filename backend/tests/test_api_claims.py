"""API tests for claim endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from app.models.claim import Claim
from app.schemas import (
    HandlingPolicy,
    Lifecycle,
    Sensitivity,
    SourceType,
    TrustLevel,
    VerificationState,
)
from app.services.claim_service import ClaimService


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
        verification_state=VerificationState.tentative.value,
        confidence=0.8,
        source_ref="turn-1",
        source_type=SourceType.user_explicit.value,
        sensitivity=Sensitivity.S1.value,
        trust_level=TrustLevel.T3.value,
        handling_policy=HandlingPolicy.local_preferred.value,
        user_locked=False,
        decay_eligible=True,
        lifecycle=Lifecycle.temporary.value,
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
async def test_get_claims_returns_list(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_list_claims(
        self: ClaimService,
        *,
        user_id: str,
        subject: str | None,
        sensitivity: Sensitivity | None,
    ) -> list[Claim]:
        assert user_id == "test-user-id"
        assert subject is None
        assert sensitivity is None
        return [_claim_model()]

    monkeypatch.setattr(ClaimService, "list_claims", fake_list_claims)

    response = await client.get("/claims")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["subject"] == "user:42"


@pytest.mark.asyncio
async def test_get_claim_by_id_returns_404(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.services.errors import NotFoundError

    async def fake_get_claim(self: ClaimService, *, claim_id: str, user_id: str) -> Claim:
        raise NotFoundError(f"Claim not found: {claim_id}:{user_id}")

    monkeypatch.setattr(ClaimService, "get_claim", fake_get_claim)

    response = await client.get("/claims/00000000-0000-0000-0000-000000000001")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_claim_returns_created_claim(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_create_claim(self: ClaimService, *, user_id: str, payload: object) -> Claim:
        assert user_id == "test-user-id"
        assert payload is not None
        return _claim_model()

    monkeypatch.setattr(ClaimService, "create_claim", fake_create_claim)
    response = await client.post(
        "/claims",
        json={
            "claim": {
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
            }
        },
    )
    assert response.status_code == 201
    assert response.json()["value"] == "Berlin"


@pytest.mark.asyncio
async def test_retract_claim_returns_retracted(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_retract_claim(self: ClaimService, *, claim_id: str, user_id: str) -> Claim:
        assert claim_id
        assert user_id == "test-user-id"
        return _claim_model()

    monkeypatch.setattr(ClaimService, "retract_claim", fake_retract_claim)
    response = await client.patch("/claims/00000000-0000-0000-0000-000000000001/retract")
    assert response.status_code == 200
    assert response.json()["status"] == "retracted"
