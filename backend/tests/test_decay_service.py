"""Unit tests for decay service."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import cast
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.claim import Claim
from app.schemas import DecayAction
from app.schemas.contracts import (
    DecayActionTypeReduceConfidencePayload,
    DecayActionTypeReduceConfidenceVariant,
)
from app.services.decay_service import DecayService
from tests.conftest import FakeAsyncSession, FakeQueryResult


def _claim_model() -> Claim:
    now = datetime.now(tz=UTC)
    return Claim(
        claim_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        subject="u",
        attribute="a",
        value="v",
        content="c",
        memory_type="profile",
        verification_state="tentative",
        confidence=0.9,
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
async def test_run_decay_no_claims() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[]))
    service = DecayService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    result = await service.run_decay(user_id="user-1")
    assert result == {"keep": 0, "reduce_confidence": 0, "expire": 0, "archive": 0}


@pytest.mark.asyncio
async def test_run_decay_keep(monkeypatch: pytest.MonkeyPatch) -> None:
    claim = _claim_model()
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[claim]))
    service = DecayService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]
    monkeypatch.setattr(
        "app.services.decay_service.rust_bridge.evaluate_decay",
        lambda _claims, _now: [DecayAction(claim_ref=str(claim.claim_id), action="Keep")],
    )

    result = await service.run_decay(user_id="user-1")
    assert result["keep"] == 1
    assert claim.verification_state == "tentative"


@pytest.mark.asyncio
async def test_run_decay_reduce_confidence(monkeypatch: pytest.MonkeyPatch) -> None:
    claim = _claim_model()
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[claim]))
    service = DecayService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]
    monkeypatch.setattr(
        "app.services.decay_service.rust_bridge.evaluate_decay",
        lambda _claims, _now: [
            DecayAction(
                claim_ref=str(claim.claim_id),
                action=DecayActionTypeReduceConfidenceVariant(
                    ReduceConfidence=DecayActionTypeReduceConfidencePayload(new_confidence=0.4)
                ),
            )
        ],
    )

    result = await service.run_decay(user_id="user-1")
    assert result["reduce_confidence"] == 1
    assert claim.confidence == 0.4


@pytest.mark.asyncio
async def test_run_decay_expire(monkeypatch: pytest.MonkeyPatch) -> None:
    claim = _claim_model()
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[claim]))
    service = DecayService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]
    monkeypatch.setattr(
        "app.services.decay_service.rust_bridge.evaluate_decay",
        lambda _claims, _now: [DecayAction(claim_ref=str(claim.claim_id), action="Expire")],
    )

    result = await service.run_decay(user_id="user-1")
    assert result["expire"] == 1
    assert claim.verification_state == "retracted"


@pytest.mark.asyncio
async def test_run_decay_archive(monkeypatch: pytest.MonkeyPatch) -> None:
    claim = _claim_model()
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[claim]))
    service = DecayService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]
    monkeypatch.setattr(
        "app.services.decay_service.rust_bridge.evaluate_decay",
        lambda _claims, _now: [DecayAction(claim_ref=str(claim.claim_id), action="Archive")],
    )

    result = await service.run_decay(user_id="user-1")
    assert result["archive"] == 1
    assert claim.verification_state == "retracted"
    assert claim.superseded_at is not None


@pytest.mark.asyncio
async def test_run_decay_applies_actions_from_a_shared_source_ref(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The engine reports the source_ref, which whole turns share, so position rules."""
    first = _claim_model()
    second = _claim_model()
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[first, second]))
    service = DecayService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]
    monkeypatch.setattr(
        "app.services.decay_service.rust_bridge.evaluate_decay",
        lambda _claims, _now: [
            DecayAction(claim_ref="turn-1", action="Keep"),
            DecayAction(claim_ref="turn-1", action="Expire"),
        ],
    )

    result = await service.run_decay(user_id="user-1")

    assert result == {"keep": 1, "reduce_confidence": 0, "expire": 1, "archive": 0}
    assert first.verification_state == "tentative"
    assert second.verification_state == "retracted"


@pytest.mark.asyncio
async def test_run_decay_refuses_a_mismatched_action_count(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Fewer actions than claims means the pairing is guesswork; fail before commit."""
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[_claim_model(), _claim_model()]))
    service = DecayService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]
    monkeypatch.setattr(
        "app.services.decay_service.rust_bridge.evaluate_decay",
        lambda _claims, _now: [DecayAction(claim_ref="turn-1", action="Keep")],
    )

    with pytest.raises(ValueError):
        await service.run_decay(user_id="user-1")

    assert db.commits == 0


@pytest.mark.asyncio
async def test_run_decay_mixed_actions(monkeypatch: pytest.MonkeyPatch) -> None:
    claim_a = _claim_model()
    claim_b = _claim_model()
    claim_c = _claim_model()
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[claim_a, claim_b, claim_c]))
    service = DecayService(cast(AsyncSession, db))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]
    monkeypatch.setattr(
        "app.services.decay_service.rust_bridge.evaluate_decay",
        lambda _claims, _now: [
            DecayAction(claim_ref=str(claim_a.claim_id), action="Keep"),
            DecayAction(claim_ref=str(claim_b.claim_id), action="Expire"),
            DecayAction(
                claim_ref=str(claim_c.claim_id),
                action=DecayActionTypeReduceConfidenceVariant(
                    ReduceConfidence=DecayActionTypeReduceConfidencePayload(new_confidence=0.5)
                ),
            ),
        ],
    )

    result = await service.run_decay(user_id="user-1")
    assert result["keep"] == 1
    assert result["expire"] == 1
    assert result["reduce_confidence"] == 1
