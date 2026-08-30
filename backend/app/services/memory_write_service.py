"""Lane-aware memory write path.

Wraps :class:`ClaimService` with the v2 governance gates: lane assignment,
source-trust write policy, single-valued conflict auto-reconcile and per-session
rebound protection. Deterministic decisions live in :mod:`app.memory`; this
service only performs the surrounding I/O (DB, Redis, audit).
"""

from __future__ import annotations

import time
from collections.abc import Awaitable
from dataclasses import dataclass
from typing import Any, cast

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.memory.conflicts import FactCandidate, resolve_single_valued
from app.memory.lanes import (
    AuthorityClass,
    check_write_policy,
    policy_for,
    source_category_from_type,
)
from app.memory.rebound import evaluate_rebound, rebound_triggered
from app.models.claim import Claim
from app.schemas import AuditEventType, AuditResult, Channel, ClaimData, VerificationState
from app.services.audit_service import AuditService
from app.services.claim_service import ClaimService
from app.services.utils import normalize_user_id

_REBOUND_TTL_SECONDS = 24 * 60 * 60


@dataclass(frozen=True)
class _ReboundState:
    active: bool
    non_identity_writes: int


@dataclass(frozen=True)
class WriteResult:
    """Outcome of a lane-governed write."""

    status: str  # written | rejected | superseded | noop
    lane: str
    claim_id: str | None = None
    reason: str | None = None
    rebound_active: bool = False
    conflict: bool = False


class MemoryWriteService:
    """Lane- and policy-aware writer for memory claims."""

    def __init__(self, db: AsyncSession, redis: Redis | None = None) -> None:
        self.db = db
        self.redis = redis
        self.claims = ClaimService(db)
        self.audit = AuditService(db)

    async def write_fact(
        self,
        *,
        user_id: str,
        claim_data: ClaimData,
        session_id: str | None = None,
        lane: AuthorityClass | None = None,
        actor: str = "user",
    ) -> WriteResult:
        """Write a fact subject to lane, source, rebound and conflict policy."""
        resolved_lane = lane or _coerce_lane(claim_data.authority_class)
        claim_data = claim_data.model_copy(update={"authority_class": resolved_lane})
        source = source_category_from_type(claim_data.source_type.value)

        policy = check_write_policy(
            lane=resolved_lane, source=source, confidence=claim_data.confidence
        )
        if not policy.allowed:
            await self._audit_block(user_id, resolved_lane, policy.reason, actor)
            return WriteResult(status="rejected", lane=resolved_lane.value, reason=policy.reason)

        rebound_state = await self._read_rebound_state(user_id, session_id)
        rebound_decision = evaluate_rebound(
            lane=resolved_lane,
            rebound_active=rebound_state.active,
            non_identity_writes=rebound_state.non_identity_writes,
        )
        if not rebound_decision.allowed:
            await self._audit_block(user_id, resolved_lane, rebound_decision.reason, actor)
            return WriteResult(
                status="rejected",
                lane=resolved_lane.value,
                reason=rebound_decision.reason,
                rebound_active=True,
            )

        existing = await self._find_single_valued(
            user_id=user_id, lane=resolved_lane, claim_data=claim_data
        )
        resolution = resolve_single_valued(
            lane=resolved_lane,
            existing=(
                FactCandidate(
                    value=existing.value,
                    source=source_category_from_type(existing.source_type),
                )
                if existing is not None
                else None
            ),
            incoming=FactCandidate(value=claim_data.value, source=source),
        )
        if not resolution.write_incoming:
            status = "noop" if not resolution.conflict else "rejected"
            return WriteResult(
                status=status,
                lane=resolved_lane.value,
                reason=resolution.reason,
                conflict=resolution.conflict,
            )

        if resolution.supersede_existing and existing is not None:
            existing.verification_state = VerificationState.superseded.value
            await self.db.commit()

        claim = await self.claims.create_claim(user_id=user_id, payload=claim_data)
        await self._record_rebound_write(user_id, session_id, resolved_lane, rebound_decision)
        return WriteResult(
            status="superseded" if resolution.supersede_existing else "written",
            lane=resolved_lane.value,
            claim_id=str(claim.claim_id),
            reason=resolution.reason,
            rebound_active=rebound_decision.rebound_active,
            conflict=resolution.conflict,
        )

    async def _find_single_valued(
        self, *, user_id: str, lane: AuthorityClass, claim_data: ClaimData
    ) -> Claim | None:
        if not policy_for(lane).single_valued:
            return None
        stmt = select(Claim).where(
            Claim.user_id == normalize_user_id(user_id),
            Claim.authority_class == lane.value,
            Claim.subject == claim_data.subject,
            Claim.verification_state.notin_(
                [VerificationState.superseded.value, VerificationState.retracted.value]
            ),
        )
        if claim_data.attribute is not None:
            stmt = stmt.where(Claim.attribute == claim_data.attribute)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _read_rebound_state(self, user_id: str, session_id: str | None) -> _ReboundState:
        if self.redis is None or session_id is None:
            return _ReboundState(active=False, non_identity_writes=0)
        key = _rebound_key(user_id, session_id)
        data = await _maybe_await(self.redis.hgetall(key))
        last_ts = float(data.get("last_ts", 0) or 0)
        count = int(data.get("count", 0) or 0)
        stored_active = (data.get("active", "0") or "0") == "1"
        idle = (time.time() - last_ts) if last_ts else None
        active = stored_active or rebound_triggered(idle)
        return _ReboundState(active=active, non_identity_writes=count)

    async def _record_rebound_write(
        self,
        user_id: str,
        session_id: str | None,
        lane: AuthorityClass,
        decision: object,
    ) -> None:
        if self.redis is None or session_id is None:
            return
        key = _rebound_key(user_id, session_id)
        rebound_active = getattr(decision, "rebound_active", False)
        mapping: dict[str, str] = {
            "last_ts": str(time.time()),
            "active": "1" if rebound_active else "0",
        }
        await _maybe_await(self.redis.hset(key, mapping=mapping))
        if lane != AuthorityClass.identity:
            await _maybe_await(self.redis.hincrby(key, "count", 1))
        await _maybe_await(self.redis.expire(key, _REBOUND_TTL_SECONDS))

    async def _audit_block(
        self, user_id: str, lane: AuthorityClass, reason: str | None, actor: str
    ) -> None:
        await self.audit.log(
            event_type=AuditEventType.action_blocked,
            result=AuditResult.blocked,
            user_id=user_id,
            channel=Channel.system,
            actor=f"service:{actor}",
            target_id=lane.value,
            detail="Memory write blocked by lane policy",
            payload={"lane": lane.value, "reason": reason},
        )


def _coerce_lane(value: str) -> AuthorityClass:
    try:
        return AuthorityClass(value)
    except ValueError:
        return AuthorityClass.evidence


def _rebound_key(user_id: str, session_id: str) -> str:
    return f"rebound:{normalize_user_id(user_id)}:{session_id}"


async def _maybe_await(value: Awaitable[Any] | Any) -> Any:
    if hasattr(value, "__await__"):
        return await cast(Awaitable[Any], value)
    return value
