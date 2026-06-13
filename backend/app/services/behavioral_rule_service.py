"""Behavioral (procedural) rule lane with a mandatory human review gate.

Rules are the only memory that rewrites future behavior, so they never
auto-activate: a proposal lands in ``pending`` and can only become ``active``
via an explicit guardian approval. Deterministic conflict detection
(:mod:`app.memory.rules`) blocks direct contradictions and caps drift; soft
conflicts require an explicit override at approval time.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.memory import rules
from app.memory.lanes import SourceCategory, source_category_from_type
from app.models.memory import BehavioralRule, BehavioralRuleConflict
from app.schemas import AuditEventType, AuditResult, Channel
from app.services.audit_service import AuditService
from app.services.errors import ConflictError, NotFoundError, ValidationError
from app.services.utils import normalize_user_id

_RULE_TTL = timedelta(days=30)


@dataclass(frozen=True)
class ProposalOutcome:
    """Result of proposing a rule, including detected conflicts."""

    rule: BehavioralRule
    conflicts: list[BehavioralRuleConflict]
    has_hard_conflict: bool


class BehavioralRuleService:
    """Lifecycle + governance for self-written behavioral rules."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.audit = AuditService(db)

    async def list_rules(self, *, user_id: str, status: str | None = None) -> list[BehavioralRule]:
        """List rules for a user, optionally filtered by lifecycle status."""
        stmt = select(BehavioralRule).where(BehavioralRule.user_id == normalize_user_id(user_id))
        if status is not None:
            stmt = stmt.where(BehavioralRule.status == status)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def propose_rule(
        self,
        *,
        user_id: str,
        behavior_text: str,
        domain: str = "global",
        trigger: dict[str, Any] | None = None,
        effect: dict[str, Any] | None = None,
        artifact_cost: int = 1,
        source_type: str,
        proposed_by: str = "model",
    ) -> ProposalOutcome:
        """Propose a rule (``pending``). Only observation sources may propose."""
        if source_category_from_type(source_type) != SourceCategory.observation:
            raise ValidationError("Behavioral rules may only be proposed from observation sources")
        if not behavior_text.strip():
            raise ValidationError("behavior_text must be non-empty")

        rule = BehavioralRule(
            user_id=normalize_user_id(user_id),
            domain=domain,
            behavior_text=behavior_text.strip(),
            trigger_json=trigger or {},
            effect_json=effect or {},
            artifact_cost=artifact_cost,
            status="pending",
            source_type=source_type,
            proposed_by=proposed_by,
        )
        self.db.add(rule)
        await self.db.commit()
        await self.db.refresh(rule)

        conflicts = await self._detect_and_store_conflicts(user_id=user_id, rule=rule)
        await self.audit.log(
            event_type=AuditEventType.action_executed,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.system,
            actor=f"service:{proposed_by}",
            target_id=str(rule.rule_id),
            detail="Behavioral rule proposed",
            payload={"rule_id": str(rule.rule_id), "domain": domain},
        )
        return ProposalOutcome(
            rule=rule,
            conflicts=conflicts,
            has_hard_conflict=any(c.severity == "hard" for c in conflicts),
        )

    async def approve_rule(
        self,
        *,
        rule_id: str,
        user_id: str,
        decided_by: str,
        override_soft: bool = False,
    ) -> BehavioralRule:
        """Guardian-only activation. Hard conflicts always block."""
        rule = await self._get_rule(rule_id=rule_id, user_id=user_id)
        if rule.status != "pending":
            raise ConflictError(f"Rule is not pending: {rule_id}")

        conflicts = await self._detect_and_store_conflicts(user_id=user_id, rule=rule)
        hard = [c for c in conflicts if c.severity == "hard"]
        soft = [c for c in conflicts if c.severity == "soft"]
        if hard:
            await self.audit.log(
                event_type=AuditEventType.action_blocked,
                result=AuditResult.blocked,
                user_id=user_id,
                channel=Channel.system,
                actor=f"user:{decided_by}",
                target_id=str(rule.rule_id),
                detail="Rule activation blocked by hard conflict",
                payload={"rule_id": str(rule.rule_id), "conflicts": len(hard)},
            )
            raise ConflictError(
                f"Rule has {len(hard)} hard conflict(s); cannot activate: "
                + "; ".join(c.detail or "" for c in hard)
            )
        if soft and not override_soft:
            raise ConflictError(
                f"Rule has {len(soft)} soft conflict(s); approve with override to proceed"
            )

        now = datetime.now(tz=UTC)
        rule.status = "active"
        rule.decided_by = decided_by
        rule.decided_at = now
        rule.activated_at = now
        rule.expires_at = now + _RULE_TTL
        if rule.previous_rule_id is not None:
            await self._retire_internal(
                rule_id=str(rule.previous_rule_id),
                user_id=user_id,
                decided_by=decided_by,
                reason="superseded",
            )
        await self.db.commit()
        await self.db.refresh(rule)

        await self.audit.log(
            event_type=AuditEventType.memory_confirmed,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.system,
            actor=f"user:{decided_by}",
            target_id=str(rule.rule_id),
            detail="Behavioral rule activated",
            payload={
                "rule_id": str(rule.rule_id),
                "override_soft": override_soft,
                "expires_at": rule.expires_at.isoformat(),
            },
        )
        return rule

    async def reject_rule(
        self,
        *,
        rule_id: str,
        user_id: str,
        decided_by: str,
        reason: str | None = None,
    ) -> BehavioralRule:
        """Reject a pending rule."""
        rule = await self._get_rule(rule_id=rule_id, user_id=user_id)
        if rule.status != "pending":
            raise ConflictError(f"Rule is not pending: {rule_id}")
        rule.status = "rejected"
        rule.decided_by = decided_by
        rule.decided_at = datetime.now(tz=UTC)
        rule.rejection_reason = reason
        await self.db.commit()
        await self.db.refresh(rule)
        await self.audit.log(
            event_type=AuditEventType.memory_rejected,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.system,
            actor=f"user:{decided_by}",
            target_id=str(rule.rule_id),
            detail="Behavioral rule rejected",
            payload={"rule_id": str(rule.rule_id), "reason": reason},
        )
        return rule

    async def retire_rule(
        self,
        *,
        rule_id: str,
        user_id: str,
        decided_by: str,
        reason: str | None = None,
    ) -> BehavioralRule:
        """Retire an active rule."""
        rule = await self._retire_internal(
            rule_id=rule_id, user_id=user_id, decided_by=decided_by, reason=reason
        )
        await self.db.commit()
        await self.db.refresh(rule)
        return rule

    async def list_conflicts(
        self, *, user_id: str, rule_id: str | None = None
    ) -> list[BehavioralRuleConflict]:
        """List stored conflicts, optionally for a single rule."""
        stmt = select(BehavioralRuleConflict).where(
            BehavioralRuleConflict.user_id == normalize_user_id(user_id)
        )
        if rule_id is not None:
            stmt = stmt.where(BehavioralRuleConflict.rule_id == _to_uuid(rule_id))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _retire_internal(
        self,
        *,
        rule_id: str,
        user_id: str,
        decided_by: str,
        reason: str | None,
    ) -> BehavioralRule:
        rule = await self._get_rule(rule_id=rule_id, user_id=user_id)
        if rule.status not in {"active", "pending"}:
            raise ConflictError(f"Rule cannot be retired from status: {rule.status}")
        rule.status = "retired"
        rule.decided_by = decided_by
        rule.decided_at = datetime.now(tz=UTC)
        if reason:
            rule.rejection_reason = reason
        await self.audit.log(
            event_type=AuditEventType.memory_retracted,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.system,
            actor=f"user:{decided_by}",
            target_id=str(rule.rule_id),
            detail="Behavioral rule retired",
            payload={"rule_id": str(rule.rule_id), "reason": reason},
        )
        return rule

    async def _detect_and_store_conflicts(
        self, *, user_id: str, rule: BehavioralRule
    ) -> list[BehavioralRuleConflict]:
        active = await self.list_rules(user_id=user_id, status="active")
        active_specs = [
            rules.RuleSpec(
                id=str(item.rule_id),
                domain=item.domain,
                trigger=item.trigger_json or {},
                effect=item.effect_json or {},
                artifact_cost=item.artifact_cost,
            )
            for item in active
            if item.rule_id != rule.rule_id
        ]
        proposed_spec = rules.RuleSpec(
            id=str(rule.rule_id),
            domain=rule.domain,
            trigger=rule.trigger_json or {},
            effect=rule.effect_json or {},
            artifact_cost=rule.artifact_cost,
        )
        detected = rules.detect_conflicts(proposed_spec, active_specs)

        existing = await self.list_conflicts(user_id=user_id, rule_id=str(rule.rule_id))
        existing_keys = {(c.conflict_type, c.other_rule_id, c.detail) for c in existing}
        stored: list[BehavioralRuleConflict] = list(existing)
        for conflict in detected:
            other = _to_uuid(conflict.other_rule_id) if conflict.other_rule_id else None
            key = (conflict.conflict_type, other, conflict.detail)
            if key in existing_keys:
                continue
            record = BehavioralRuleConflict(
                user_id=normalize_user_id(user_id),
                rule_id=rule.rule_id,
                other_rule_id=other,
                conflict_type=conflict.conflict_type,
                severity=conflict.severity,
                detail=conflict.detail,
            )
            self.db.add(record)
            stored.append(record)
        await self.db.commit()
        return stored

    async def _get_rule(self, *, rule_id: str, user_id: str) -> BehavioralRule:
        stmt = select(BehavioralRule).where(
            BehavioralRule.rule_id == _to_uuid(rule_id),
            BehavioralRule.user_id == normalize_user_id(user_id),
        )
        result = await self.db.execute(stmt)
        rule = result.scalar_one_or_none()
        if rule is None:
            raise NotFoundError(f"Behavioral rule not found: {rule_id}")
        return rule


def _to_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise NotFoundError(f"Invalid id: {value}") from exc
