"""Claim business logic service."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.claim import Claim, ClaimVersion
from app.schemas import (
    AuditEventType,
    AuditResult,
    Channel,
    ClaimData,
    Sensitivity,
    SourceType,
    VerificationState,
)
from app.services.audit_service import AuditService
from app.services.errors import ConflictError, NotFoundError
from app.services.utils import normalize_user_id


class ClaimService:
    """Business layer for claim operations."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.audit = AuditService(db)

    async def list_claims(
        self,
        *,
        user_id: str,
        subject: str | None = None,
        sensitivity: Sensitivity | None = None,
    ) -> list[Claim]:
        """Return active claims for the given user and optional filters."""
        stmt = select(Claim).where(
            Claim.user_id == normalize_user_id(user_id),
            Claim.verification_state.notin_(
                [VerificationState.superseded.value, VerificationState.retracted.value]
            ),
        )
        if subject is not None:
            stmt = stmt.where(Claim.subject == subject)
        if sensitivity is not None:
            stmt = stmt.where(Claim.sensitivity == sensitivity.value)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_claim(self, *, claim_id: str, user_id: str) -> Claim:
        """Load one claim by id for one user."""
        try:
            claim_uuid = uuid.UUID(claim_id)
        except ValueError as exc:
            raise NotFoundError(f"Claim not found: {claim_id}") from exc
        stmt = select(Claim).where(
            Claim.claim_id == claim_uuid,
            Claim.user_id == normalize_user_id(user_id),
        )
        result = await self.db.execute(stmt)
        claim = result.scalar_one_or_none()
        if claim is None:
            raise NotFoundError(f"Claim not found: {claim_id}")
        return claim

    async def create_claim(self, *, user_id: str, payload: ClaimData) -> Claim:
        """Create a direct claim with append-only version record."""
        return await self._persist_claim(
            user_id=user_id,
            payload=payload,
            source_ref=payload.source_ref,
            source_type=payload.source_type,
            changed_by="user",
            change_reason="direct_create",
        )

    async def create_claim_from_proposal(
        self,
        *,
        user_id: str,
        claim_data: ClaimData,
        source_ref: str | None,
        source_type: SourceType,
        changed_by: str = "system",
    ) -> Claim:
        """Create a claim from an approved proposal with append-only versioning."""
        return await self._persist_claim(
            user_id=user_id,
            payload=claim_data,
            source_ref=source_ref or claim_data.source_ref,
            source_type=source_type,
            changed_by=changed_by,
            change_reason="proposal_approved",
        )

    async def retract_claim(
        self,
        *,
        claim_id: str,
        user_id: str,
        changed_by: str = "user",
    ) -> Claim:
        """Retract a claim without deleting it (append-only policy)."""
        claim = await self.get_claim(claim_id=claim_id, user_id=user_id)
        claim.verification_state = VerificationState.retracted.value
        claim.superseded_at = datetime.now(tz=UTC)
        claim.updated_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(claim)

        await self._record_version(claim, changed_by=changed_by, change_reason="User retracted")
        await self.audit.log(
            event_type=AuditEventType.memory_retracted,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.system,
            actor=f"service:{changed_by}",
            target_id=str(claim.claim_id),
            detail="Claim retracted",
            payload={"claim_id": str(claim.claim_id)},
            source_ref=claim.source_ref,
            sensitivity=Sensitivity(claim.sensitivity),
        )
        return claim

    async def archive_claim(
        self,
        *,
        claim_id: str,
        user_id: str,
        changed_by: str = "user",
    ) -> Claim:
        """Archive a claim without retracting its verification state."""
        claim = await self.get_claim(claim_id=claim_id, user_id=user_id)
        claim.lifecycle = "archived"
        claim.decay_eligible = False
        claim.updated_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(claim)

        await self._record_version(claim, changed_by=changed_by, change_reason="User archived")
        await self.audit.log(
            # TODO: eigenen AuditEventType.memory_archived einfuehren,
            # wenn ozy-contracts erweitert wird.
            event_type=AuditEventType.memory_retracted,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.system,
            actor=f"service:{changed_by}",
            target_id=str(claim.claim_id),
            detail="Claim archived",
            payload={"claim_id": str(claim.claim_id)},
            source_ref=claim.source_ref,
            sensitivity=Sensitivity(claim.sensitivity),
        )
        return claim

    async def list_versions(self, *, claim_id: str, user_id: str) -> list[ClaimVersion]:
        """Return all versions for a claim sorted by newest first."""
        claim = await self.get_claim(claim_id=claim_id, user_id=user_id)
        stmt = (
            select(ClaimVersion)
            .where(ClaimVersion.claim_id == claim.claim_id)
            .order_by(ClaimVersion.version_number.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def confirm_claim(
        self,
        *,
        claim_id: str,
        user_id: str,
        changed_by: str = "user",
    ) -> Claim:
        """Confirm a claim unless it is already final."""
        claim = await self.get_claim(claim_id=claim_id, user_id=user_id)
        if claim.verification_state == VerificationState.retracted.value:
            raise ConflictError("Retracted claim cannot be confirmed")
        if claim.verification_state == VerificationState.confirmed.value:
            raise ConflictError("Claim is already confirmed")

        claim.verification_state = VerificationState.confirmed.value
        claim.updated_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(claim)

        await self._record_version(claim, changed_by=changed_by, change_reason="User confirmed")
        await self.audit.log(
            event_type=AuditEventType.memory_confirmed,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.system,
            actor=f"service:{changed_by}",
            target_id=str(claim.claim_id),
            detail="Claim confirmed",
            payload={"claim_id": str(claim.claim_id)},
            source_ref=claim.source_ref,
            sensitivity=Sensitivity(claim.sensitivity),
        )
        return claim

    async def lock_claim(
        self,
        *,
        claim_id: str,
        user_id: str,
        changed_by: str = "user",
    ) -> Claim:
        """User-lock a claim and disable decay."""
        claim = await self.get_claim(claim_id=claim_id, user_id=user_id)
        if claim.user_locked:
            raise ConflictError("Claim is already locked")

        claim.user_locked = True
        claim.decay_eligible = False
        claim.updated_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(claim)

        await self._record_version(claim, changed_by=changed_by, change_reason="User locked")
        await self.audit.log(
            event_type=AuditEventType.action_executed,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.system,
            actor=f"service:{changed_by}",
            target_id=str(claim.claim_id),
            detail="Claim locked",
            payload={"claim_id": str(claim.claim_id)},
            source_ref=claim.source_ref,
            sensitivity=Sensitivity(claim.sensitivity),
        )
        return claim

    async def unlock_claim(
        self,
        *,
        claim_id: str,
        user_id: str,
        changed_by: str = "user",
    ) -> Claim:
        """Remove user lock and enable decay."""
        claim = await self.get_claim(claim_id=claim_id, user_id=user_id)
        if not claim.user_locked:
            raise ConflictError("Claim is not locked")

        claim.user_locked = False
        claim.decay_eligible = True
        claim.updated_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(claim)

        await self._record_version(claim, changed_by=changed_by, change_reason="User unlocked")
        await self.audit.log(
            event_type=AuditEventType.action_executed,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.system,
            actor=f"service:{changed_by}",
            target_id=str(claim.claim_id),
            detail="Claim unlocked",
            payload={"claim_id": str(claim.claim_id)},
            source_ref=claim.source_ref,
            sensitivity=Sensitivity(claim.sensitivity),
        )
        return claim

    async def update_sensitivity(
        self,
        *,
        claim_id: str,
        user_id: str,
        sensitivity: Sensitivity,
        changed_by: str = "user",
    ) -> Claim:
        """Update claim sensitivity and the derived handling policy."""
        claim = await self.get_claim(claim_id=claim_id, user_id=user_id)
        claim.sensitivity = sensitivity.value
        claim.handling_policy = _sensitivity_to_policy(sensitivity.value)
        claim.updated_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(claim)

        await self._record_version(
            claim,
            changed_by=changed_by,
            change_reason=f"Sensitivity updated to {sensitivity.value}",
        )
        await self.audit.log(
            event_type=AuditEventType.action_executed,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.system,
            actor=f"service:{changed_by}",
            target_id=str(claim.claim_id),
            detail="Claim sensitivity updated",
            payload={
                "claim_id": str(claim.claim_id),
                "sensitivity": claim.sensitivity,
                "handling_policy": claim.handling_policy,
            },
            source_ref=claim.source_ref,
            sensitivity=sensitivity,
        )
        return claim

    async def _persist_claim(
        self,
        *,
        user_id: str,
        payload: ClaimData,
        source_ref: str | None,
        source_type: SourceType,
        changed_by: str,
        change_reason: str,
    ) -> Claim:
        claim = Claim(
            user_id=normalize_user_id(user_id),
            subject=payload.subject,
            attribute=payload.attribute,
            value=payload.value,
            content=payload.content,
            memory_type=payload.memory_type,
            authority_class=payload.authority_class,
            verification_state=payload.verification_state.value,
            confidence=payload.confidence,
            source_ref=source_ref,
            source_type=source_type.value,
            sensitivity=payload.sensitivity.value,
            trust_level=payload.trust_level.value,
            handling_policy=payload.handling_policy.value,
            user_locked=payload.user_locked,
            decay_eligible=payload.decay_eligible,
            lifecycle=payload.lifecycle.value,
            valid_from=_parse_datetime(payload.valid_from),
            valid_to=_parse_datetime(payload.valid_to),
        )
        self.db.add(claim)
        await self.db.commit()
        await self.db.refresh(claim)

        await self._record_version(claim, changed_by=changed_by, change_reason=change_reason)
        await self.audit.log(
            event_type=AuditEventType.memory_confirmed,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.system,
            actor=f"service:{changed_by}",
            target_id=str(claim.claim_id),
            detail="Claim created",
            payload={"claim_id": str(claim.claim_id)},
            source_ref=source_ref,
            sensitivity=payload.sensitivity,
        )
        return claim

    async def _record_version(
        self,
        claim: Claim,
        *,
        changed_by: str,
        change_reason: str,
    ) -> ClaimVersion:
        latest_stmt = (
            select(ClaimVersion)
            .where(ClaimVersion.claim_id == claim.claim_id)
            .order_by(ClaimVersion.version_number.desc())
            .limit(1)
        )
        latest_result = await self.db.execute(latest_stmt)
        latest = latest_result.scalar_one_or_none()
        version_number = (latest.version_number + 1) if latest is not None else 1
        previous_hash = latest.version_hash if latest is not None else None

        snapshot = _claim_snapshot(claim)
        version_hash = _compute_version_hash(snapshot)
        version = ClaimVersion(
            claim_id=claim.claim_id,
            version_number=version_number,
            version_hash=version_hash,
            previous_hash=previous_hash,
            content_snapshot=snapshot,
            change_reason=change_reason,
            changed_by=changed_by,
        )
        self.db.add(version)
        await self.db.commit()
        await self.db.refresh(version)
        return version


def _parse_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _sensitivity_to_policy(sensitivity: str) -> str:
    return {
        "S0": "cloud_ok_encrypted",
        "S1": "cloud_ok_encrypted",
        "S2": "cloud_ok_encrypted",
        "S3": "local_only",
        "S4": "s4_isolated",
    }.get(sensitivity, "cloud_ok_encrypted")


def _claim_snapshot(claim: Claim) -> dict[str, Any]:
    return {
        "claim_id": str(claim.claim_id),
        "user_id": str(claim.user_id),
        "subject": claim.subject,
        "attribute": claim.attribute,
        "value": claim.value,
        "content": claim.content,
        "memory_type": claim.memory_type,
        "authority_class": claim.authority_class,
        "verification_state": claim.verification_state,
        "confidence": claim.confidence,
        "source_ref": claim.source_ref,
        "source_type": claim.source_type,
        "sensitivity": claim.sensitivity,
        "trust_level": claim.trust_level,
        "handling_policy": claim.handling_policy,
        "user_locked": claim.user_locked,
        "decay_eligible": claim.decay_eligible,
        "lifecycle": claim.lifecycle,
        "valid_from": claim.valid_from.isoformat() if claim.valid_from else None,
        "valid_to": claim.valid_to.isoformat() if claim.valid_to else None,
        "ingested_at": claim.ingested_at.isoformat() if claim.ingested_at else None,
        "superseded_at": claim.superseded_at.isoformat() if claim.superseded_at else None,
        "review_due": claim.review_due,
        "last_reviewed": claim.last_reviewed.isoformat() if claim.last_reviewed else None,
        "last_accessed": claim.last_accessed.isoformat() if claim.last_accessed else None,
        "created_at": claim.created_at.isoformat() if claim.created_at else None,
        "updated_at": claim.updated_at.isoformat() if claim.updated_at else None,
    }


def _compute_version_hash(snapshot: dict[str, Any]) -> str:
    canonical_json = json.dumps(snapshot, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
