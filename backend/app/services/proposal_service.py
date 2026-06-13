"""Proposal business logic service."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.proposal import MemoryProposal
from app.schemas import AuditEventType, AuditResult, Channel, ClaimData, ProposalData, SourceType
from app.services.audit_service import AuditService
from app.services.claim_service import ClaimService
from app.services.errors import ConflictError, NotFoundError
from app.services.utils import normalize_user_id


class ProposalService:
    """Business layer for memory proposals."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.audit = AuditService(db)

    async def list_proposals(
        self,
        *,
        user_id: str,
        status: str | None = None,
    ) -> list[MemoryProposal]:
        """Return proposals for the user and optional status."""
        stmt = select(MemoryProposal).where(MemoryProposal.user_id == normalize_user_id(user_id))
        if status is not None:
            stmt = stmt.where(MemoryProposal.status == status)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_proposal(
        self,
        *,
        user_id: str,
        proposal: ProposalData,
        conflict_group_id: str | None = None,
    ) -> MemoryProposal:
        """Create a pending memory proposal."""
        proposal_model = MemoryProposal(
            user_id=normalize_user_id(user_id),
            proposed_claim=proposal.proposed_claim.model_dump(mode="json"),
            source_ref=proposal.source_ref,
            source_type=proposal.source_type.value,
            status="pending",
            conflict_group_id=uuid.UUID(conflict_group_id) if conflict_group_id else None,
        )
        self.db.add(proposal_model)
        await self.db.commit()
        await self.db.refresh(proposal_model)

        await self.audit.log(
            event_type=AuditEventType.action_executed,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.system,
            actor="service:proposal_service",
            target_id=str(proposal_model.proposal_id),
            detail="Proposal created",
            payload={"proposal_id": str(proposal_model.proposal_id)},
            source_ref=proposal.source_ref,
            sensitivity=proposal.proposed_claim.sensitivity,
        )
        return proposal_model

    async def approve_proposal(
        self,
        *,
        proposal_id: str,
        user_id: str,
        decided_by: str,
    ) -> MemoryProposal:
        """Approve a pending proposal and materialize it as claim."""
        proposal = await self._get_proposal(proposal_id=proposal_id, user_id=user_id)
        if proposal.status != "pending":
            raise ConflictError(f"Proposal is not pending: {proposal_id}")

        proposal.status = "confirmed"
        proposal.decided_at = datetime.now(tz=UTC)
        proposal.decided_by = decided_by
        await self.db.commit()
        await self.db.refresh(proposal)

        claim_data = ClaimData.model_validate(proposal.proposed_claim)
        claim_service = ClaimService(self.db)
        await claim_service.create_claim_from_proposal(
            user_id=user_id,
            claim_data=claim_data,
            source_ref=proposal.source_ref,
            source_type=SourceType(proposal.source_type),
            changed_by=decided_by,
        )

        await self.audit.log(
            event_type=AuditEventType.memory_confirmed,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.system,
            actor=f"user:{decided_by}",
            target_id=str(proposal.proposal_id),
            detail="Proposal approved",
            payload={"proposal_id": str(proposal.proposal_id)},
            source_ref=proposal.source_ref,
            sensitivity=claim_data.sensitivity,
        )
        return proposal

    async def reject_proposal(
        self,
        *,
        proposal_id: str,
        user_id: str,
        decided_by: str,
        reason: str | None,
    ) -> MemoryProposal:
        """Reject a pending proposal."""
        proposal = await self._get_proposal(proposal_id=proposal_id, user_id=user_id)
        if proposal.status != "pending":
            raise ConflictError(f"Proposal is not pending: {proposal_id}")

        proposal.status = "rejected"
        proposal.rejection_reason = reason
        proposal.decided_at = datetime.now(tz=UTC)
        proposal.decided_by = decided_by
        await self.db.commit()
        await self.db.refresh(proposal)

        claim_data = ClaimData.model_validate(proposal.proposed_claim)
        await self.audit.log(
            event_type=AuditEventType.memory_rejected,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.system,
            actor=f"user:{decided_by}",
            target_id=str(proposal.proposal_id),
            detail="Proposal rejected",
            payload={"proposal_id": str(proposal.proposal_id), "reason": reason},
            source_ref=proposal.source_ref,
            sensitivity=claim_data.sensitivity,
        )
        return proposal

    async def _get_proposal(self, *, proposal_id: str, user_id: str) -> MemoryProposal:
        try:
            proposal_uuid = uuid.UUID(proposal_id)
        except ValueError as exc:
            raise NotFoundError(f"Proposal not found: {proposal_id}") from exc
        stmt = select(MemoryProposal).where(
            MemoryProposal.proposal_id == proposal_uuid,
            MemoryProposal.user_id == normalize_user_id(user_id),
        )
        result = await self.db.execute(stmt)
        proposal = result.scalar_one_or_none()
        if proposal is None:
            raise NotFoundError(f"Proposal not found: {proposal_id}")
        return proposal
