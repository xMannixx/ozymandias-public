"""API tests for claim lifecycle endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from app.models.claim import Claim, ClaimVersion
from app.schemas import (
    HandlingPolicy,
    Lifecycle,
    Sensitivity,
    SourceType,
    TrustLevel,
    VerificationState,
)
from app.services.claim_service import ClaimService
from app.services.errors import ConflictError, NotFoundError


def _claim_model(
    *,
    verification_state: str = VerificationState.tentative.value,
    user_locked: bool = False,
    decay_eligible: bool = True,
    sensitivity: str = Sensitivity.S1.value,
    handling_policy: str = HandlingPolicy.local_preferred.value,
    lifecycle: str = Lifecycle.temporary.value,
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
        source_type=SourceType.user_explicit.value,
        sensitivity=sensitivity,
        trust_level=TrustLevel.T3.value,
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
        updated_at=now,
    )


def _version_model(claim_id: uuid.UUID, version_number: int) -> ClaimVersion:
    return ClaimVersion(
        version_id=uuid.uuid4(),
        claim_id=claim_id,
        version_number=version_number,
        version_hash=f"hash-{version_number}",
        previous_hash=None if version_number == 1 else f"hash-{version_number - 1}",
        content_snapshot={"version": version_number},
        change_reason="manual_update",
        changed_by="user",
        created_at=datetime.now(tz=UTC),
    )


@pytest.mark.asyncio
async def test_patch_retract_returns_retracted(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_retract(self: ClaimService, *, claim_id: str, user_id: str) -> Claim:
        assert claim_id
        assert user_id == "test-user-id"
        return _claim_model()

    monkeypatch.setattr(ClaimService, "retract_claim", fake_retract)
    response = await client.patch("/claims/00000000-0000-0000-0000-000000000001/retract")
    assert response.status_code == 200
    assert response.json()["status"] == "retracted"


@pytest.mark.asyncio
async def test_patch_archive_returns_archived(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_archive(self: ClaimService, *, claim_id: str, user_id: str) -> Claim:
        assert claim_id
        assert user_id == "test-user-id"
        return _claim_model(lifecycle="archived", decay_eligible=False)

    monkeypatch.setattr(ClaimService, "archive_claim", fake_archive)
    response = await client.patch("/claims/00000000-0000-0000-0000-000000000001/archive")
    assert response.status_code == 200
    assert response.json()["status"] == "archived"


@pytest.mark.asyncio
async def test_get_versions_returns_list(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    claim_id = uuid.uuid4()
    versions = [_version_model(claim_id, 2), _version_model(claim_id, 1)]

    async def fake_list_versions(
        self: ClaimService, *, claim_id: str, user_id: str
    ) -> list[ClaimVersion]:
        assert claim_id
        assert user_id == "test-user-id"
        return versions

    monkeypatch.setattr(ClaimService, "list_versions", fake_list_versions)
    response = await client.get("/claims/00000000-0000-0000-0000-000000000001/versions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["version_number"] == 2


@pytest.mark.asyncio
async def test_get_versions_returns_404(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_list_versions(
        self: ClaimService, *, claim_id: str, user_id: str
    ) -> list[ClaimVersion]:
        raise NotFoundError(f"Claim not found: {claim_id}:{user_id}")

    monkeypatch.setattr(ClaimService, "list_versions", fake_list_versions)
    response = await client.get("/claims/00000000-0000-0000-0000-000000000001/versions")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_patch_confirm_returns_confirmed_claim(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_confirm(self: ClaimService, *, claim_id: str, user_id: str) -> Claim:
        assert claim_id
        assert user_id == "test-user-id"
        return _claim_model(verification_state=VerificationState.confirmed.value)

    monkeypatch.setattr(ClaimService, "confirm_claim", fake_confirm)
    response = await client.patch("/claims/00000000-0000-0000-0000-000000000001/confirm")
    assert response.status_code == 200
    assert response.json()["verification_state"] == "confirmed"


@pytest.mark.asyncio
async def test_patch_confirm_returns_409_for_retracted(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_confirm(self: ClaimService, *, claim_id: str, user_id: str) -> Claim:
        raise ConflictError(f"cannot confirm: {claim_id}:{user_id}")

    monkeypatch.setattr(ClaimService, "confirm_claim", fake_confirm)
    response = await client.patch("/claims/00000000-0000-0000-0000-000000000001/confirm")
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_patch_lock_returns_locked_claim(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_lock(self: ClaimService, *, claim_id: str, user_id: str) -> Claim:
        assert claim_id
        assert user_id == "test-user-id"
        return _claim_model(user_locked=True, decay_eligible=False)

    monkeypatch.setattr(ClaimService, "lock_claim", fake_lock)
    response = await client.patch("/claims/00000000-0000-0000-0000-000000000001/lock")
    assert response.status_code == 200
    assert response.json()["user_locked"] is True


@pytest.mark.asyncio
async def test_patch_lock_returns_409_when_already_locked(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_lock(self: ClaimService, *, claim_id: str, user_id: str) -> Claim:
        raise ConflictError(f"already locked: {claim_id}:{user_id}")

    monkeypatch.setattr(ClaimService, "lock_claim", fake_lock)
    response = await client.patch("/claims/00000000-0000-0000-0000-000000000001/lock")
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_patch_sensitivity_returns_updated_claim(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_update(
        self: ClaimService,
        *,
        claim_id: str,
        user_id: str,
        sensitivity: Sensitivity,
    ) -> Claim:
        assert claim_id
        assert user_id == "test-user-id"
        assert sensitivity == Sensitivity.S4
        return _claim_model(
            sensitivity=Sensitivity.S4.value,
            handling_policy=HandlingPolicy.s4_isolated.value,
        )

    monkeypatch.setattr(ClaimService, "update_sensitivity", fake_update)
    response = await client.patch(
        "/claims/00000000-0000-0000-0000-000000000001/sensitivity",
        json={"sensitivity": "S4"},
    )
    assert response.status_code == 200
    assert response.json()["sensitivity"] == "S4"
    assert response.json()["handling_policy"] == "s4_isolated"


@pytest.mark.asyncio
async def test_patch_sensitivity_returns_422_for_invalid_value(client: AsyncClient) -> None:
    response = await client.patch(
        "/claims/00000000-0000-0000-0000-000000000001/sensitivity",
        json={"sensitivity": "S9"},
    )
    assert response.status_code == 422
