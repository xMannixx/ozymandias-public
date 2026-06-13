"""Proposal endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import get_current_user
from app.database import get_db
from app.models.proposal import MemoryProposal
from app.schemas.api_models import (
    CreateProposalRequest,
    ProposalDecisionRequest,
    ProposalResponse,
)
from app.services.errors import ConflictError, NotFoundError
from app.services.proposal_service import ProposalService

router = APIRouter(tags=["proposals"])


@router.get("", response_model=list[ProposalResponse])
async def list_proposals(
    status_filter: str | None = Query(default=None, alias="status"),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProposalResponse]:
    service = ProposalService(db)
    proposals = await service.list_proposals(user_id=user_id, status=status_filter)
    return [_to_proposal_response(item) for item in proposals]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ProposalResponse)
async def create_proposal(
    payload: CreateProposalRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProposalResponse:
    service = ProposalService(db)
    proposal = await service.create_proposal(
        user_id=user_id,
        proposal=payload.proposal,
        conflict_group_id=payload.conflict_group_id,
    )
    return _to_proposal_response(proposal)


@router.post("/{proposal_id}/approve", response_model=ProposalResponse)
async def approve_proposal(
    proposal_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProposalResponse:
    service = ProposalService(db)
    try:
        proposal = await service.approve_proposal(
            proposal_id=proposal_id,
            user_id=user_id,
            decided_by=user_id,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _to_proposal_response(proposal)


@router.post("/{proposal_id}/reject", response_model=ProposalResponse)
async def reject_proposal(
    proposal_id: str,
    payload: ProposalDecisionRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProposalResponse:
    service = ProposalService(db)
    try:
        proposal = await service.reject_proposal(
            proposal_id=proposal_id,
            user_id=user_id,
            decided_by=user_id,
            reason=payload.reason,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _to_proposal_response(proposal)


def _to_proposal_response(proposal: MemoryProposal) -> ProposalResponse:
    return ProposalResponse(
        proposal_id=str(proposal.proposal_id),
        user_id=str(proposal.user_id),
        proposed_claim=proposal.proposed_claim,
        source_ref=proposal.source_ref,
        source_type=proposal.source_type,
        status=proposal.status,
        conflict_group_id=str(proposal.conflict_group_id) if proposal.conflict_group_id else None,
        rejection_reason=proposal.rejection_reason,
        created_at=proposal.created_at,
        decided_at=proposal.decided_at,
        decided_by=proposal.decided_by,
    )
