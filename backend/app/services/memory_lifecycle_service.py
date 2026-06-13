"""Lane-coupled decay, expiry and cleanup for the v2 memory subsystem.

Confidence decays per lane half-life; facts past their lane TTL are retracted.
Recall snippets and entity-graph rows expire by ``expires_at``. Active
behavioral rules past their 30-day TTL fall back to ``pending`` and require a
fresh guardian re-approval. Deterministic verdicts come from
:mod:`app.memory.lifecycle`.
"""

from __future__ import annotations

import asyncio
from collections import Counter
from datetime import UTC, datetime
from typing import Any

from celery import shared_task
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.memory.lanes import AuthorityClass
from app.memory.lifecycle import evaluate_lane_decay
from app.models.claim import Claim
from app.models.memory import (
    BehavioralRule,
    MemoryEntity,
    MemoryEntityRelation,
    RecallSnippet,
)
from app.schemas import AuditEventType, AuditResult, Channel, Sensitivity, VerificationState
from app.services.audit_service import AuditService
from app.services.utils import normalize_user_id


class MemoryLifecycleService:
    """Apply lane decay and expire stale memory rows."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.audit = AuditService(db)

    async def run_lane_decay(self, *, user_id: str) -> dict[str, int]:
        """Decay confidence / expire active claims per their lane policy."""
        uid = normalize_user_id(user_id)
        now = datetime.now(tz=UTC)
        stmt = select(Claim).where(
            Claim.user_id == uid,
            Claim.decay_eligible.is_(True),
            Claim.verification_state.notin_(
                [VerificationState.superseded.value, VerificationState.retracted.value]
            ),
        )
        result = await self.db.execute(stmt)
        claims = list(result.scalars().all())
        counters: Counter[str] = Counter()
        for claim in claims:
            reference = claim.ingested_at or claim.created_at
            age_days = (now - _aware(reference)).total_seconds() / 86400 if reference else 0.0
            decision = evaluate_lane_decay(
                lane=_safe_lane(claim.authority_class),
                confidence=float(claim.confidence),
                age_days=age_days,
                user_locked=claim.user_locked,
            )
            counters[decision.action] += 1
            if decision.action == "reduce" and decision.new_confidence is not None:
                claim.confidence = decision.new_confidence
            elif decision.action == "expire":
                claim.verification_state = VerificationState.retracted.value
                claim.superseded_at = now
        await self.db.commit()
        await self.audit.log(
            event_type=AuditEventType.action_executed,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.celery,
            actor="service:memory_lifecycle",
            target_id=str(uid),
            detail="Lane decay completed",
            payload=dict(counters),
            source_ref="memory-lifecycle",
            sensitivity=Sensitivity.S0,
        )
        return dict(counters)

    async def cleanup_expired(self, *, user_id: str) -> dict[str, int]:
        """Remove expired snippets / graph rows and re-gate expired rules."""
        uid = normalize_user_id(user_id)
        now = datetime.now(tz=UTC)
        counts: dict[str, int] = {}

        counts["snippets"] = await self._delete_expired(RecallSnippet, uid, now)
        counts["relations"] = await self._delete_expired(MemoryEntityRelation, uid, now)
        counts["entities"] = await self._delete_expired(MemoryEntity, uid, now)

        rule_stmt = (
            update(BehavioralRule)
            .where(
                BehavioralRule.user_id == uid,
                BehavioralRule.status == "active",
                BehavioralRule.expires_at.is_not(None),
                BehavioralRule.expires_at <= now,
            )
            .values(status="pending", activated_at=None)
        )
        rule_result: Any = await self.db.execute(rule_stmt)
        counts["rules_re_review"] = int(rule_result.rowcount or 0)
        await self.db.commit()
        return counts

    async def _delete_expired(self, model: Any, uid: object, now: datetime) -> int:
        stmt = delete(model).where(
            model.user_id == uid,
            model.expires_at.is_not(None),
            model.expires_at <= now,
        )
        result: Any = await self.db.execute(stmt)
        return int(result.rowcount or 0)


def _safe_lane(value: str) -> AuthorityClass:
    try:
        return AuthorityClass(value)
    except ValueError:
        return AuthorityClass.evidence


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


async def _run_memory_cleanup_job(user_id: str) -> dict[str, int]:
    async with AsyncSessionLocal() as db:
        service = MemoryLifecycleService(db)
        decay = await service.run_lane_decay(user_id=user_id)
        cleanup = await service.cleanup_expired(user_id=user_id)
        return {**{f"decay_{k}": v for k, v in decay.items()}, **cleanup}


@shared_task(name="ozy.memory.cleanup")  # type: ignore[untyped-decorator,misc,unused-ignore]
def run_memory_cleanup_task(user_id: str) -> dict[str, int]:
    """Celery task: lane decay + expiry cleanup for one user."""
    return asyncio.run(_run_memory_cleanup_job(user_id))
