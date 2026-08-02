"""Decay evaluation service and Celery task entrypoint."""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, run_db_job
from app.models.claim import Claim
from app.schemas import (
    AuditEventType,
    AuditResult,
    Channel,
    ClaimData,
    DecayAction,
    HandlingPolicy,
    Lifecycle,
    Sensitivity,
    SourceType,
    TrustLevel,
    VerificationState,
)
from app.schemas.contracts import DecayActionTypeReduceConfidenceVariant
from app.services import rust_bridge
from app.services.audit_service import AuditService
from app.services.job_targets import user_ids_with_claims
from app.services.utils import normalize_user_id


class DecayService:
    """Apply Rust decay decisions to decay-eligible claims."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.audit = AuditService(db)

    async def run_decay(self, *, user_id: str) -> dict[str, int]:
        """Evaluate and apply decay actions for one user."""
        stmt = select(Claim).where(
            Claim.user_id == normalize_user_id(user_id),
            Claim.decay_eligible.is_(True),
            Claim.verification_state != "retracted",
        )
        result = await self.db.execute(stmt)
        claims = list(result.scalars().all())
        if not claims:
            return {"keep": 0, "reduce_confidence": 0, "expire": 0, "archive": 0}

        claim_data = [_claim_model_to_data(claim) for claim in claims]
        actions = rust_bridge.evaluate_decay(claim_data, datetime.now(tz=UTC).isoformat())
        counters: Counter[str] = Counter()

        # The engine answers one action per claim in input order. Pairing by
        # position is the only correct mapping: DecayAction.claim_ref carries the
        # source_ref, which every claim from the same turn shares.
        for claim, action in zip(claims, actions, strict=True):
            await self._apply_action(claim, action)
            counters[_action_name(action)] += 1

        await self.db.commit()
        await self.audit.log(
            event_type=AuditEventType.action_executed,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.celery,
            actor="service:decay_service",
            target_id=user_id,
            detail="Decay run completed",
            payload={"actions": dict(counters)},
            source_ref="decay-job",
            sensitivity=Sensitivity.S0,
        )
        return {
            "keep": counters.get("keep", 0),
            "reduce_confidence": counters.get("reduce_confidence", 0),
            "expire": counters.get("expire", 0),
            "archive": counters.get("archive", 0),
        }

    async def _apply_action(self, claim: Claim, action: DecayAction) -> None:
        if isinstance(action.action, str):
            if action.action == "Keep":
                return
            if action.action == "Expire":
                claim.verification_state = "retracted"
                return
            if action.action == "Archive":
                claim.verification_state = "retracted"
                claim.superseded_at = datetime.now(tz=UTC)
                return
            return

        if isinstance(action.action, DecayActionTypeReduceConfidenceVariant):
            claim.confidence = action.action.ReduceConfidence.new_confidence


def _action_name(action: DecayAction) -> str:
    if isinstance(action.action, str):
        return action.action.lower()
    if isinstance(action.action, DecayActionTypeReduceConfidenceVariant):
        return "reduce_confidence"
    return "keep"


def _claim_model_to_data(claim: Claim) -> ClaimData:
    source_type = SourceType(claim.source_type)
    return ClaimData(
        subject=claim.subject,
        attribute=claim.attribute,
        value=claim.value,
        content=claim.content,
        memory_type=claim.memory_type,
        sensitivity=Sensitivity(claim.sensitivity),
        trust_level=TrustLevel(claim.trust_level),
        handling_policy=HandlingPolicy(claim.handling_policy),
        verification_state=VerificationState(claim.verification_state),
        confidence=claim.confidence,
        source_type=source_type,
        source_ref=claim.source_ref,
        user_locked=claim.user_locked,
        decay_eligible=claim.decay_eligible,
        lifecycle=Lifecycle(claim.lifecycle),
        valid_from=claim.valid_from.isoformat() if claim.valid_from else None,
        valid_to=claim.valid_to.isoformat() if claim.valid_to else None,
    )


async def _run_decay_job(user_id: str) -> dict[str, int]:
    async with AsyncSessionLocal() as db:
        service = DecayService(db)
        return await service.run_decay(user_id=user_id)


async def _run_decay_job_for_all() -> dict[str, dict[str, int]]:
    async with AsyncSessionLocal() as db:
        user_ids = await user_ids_with_claims(db)
    return {user_id: await _run_decay_job(user_id) for user_id in user_ids}


@shared_task(name="ozy.decay.run")  # type: ignore[untyped-decorator,misc,unused-ignore]
def run_decay_task(user_id: str) -> dict[str, int]:
    """Celery task wrapper around async decay service."""
    return run_db_job(_run_decay_job(user_id))


@shared_task(name="ozy.decay.run_all")  # type: ignore[untyped-decorator,misc,unused-ignore]
def run_decay_all_task() -> dict[str, dict[str, int]]:
    """Beat entrypoint: decay for every user that has claims."""
    return run_db_job(_run_decay_job_for_all())
