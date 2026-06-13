"""Claim endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import get_current_user
from app.database import get_db
from app.models.claim import Claim, ClaimVersion
from app.schemas import Sensitivity
from app.schemas.api_models import (
    ArchiveClaimResponse,
    ClaimResponse,
    ClaimVersionResponse,
    CreateClaimRequest,
    UpdateSensitivityRequest,
)
from app.services.claim_service import ClaimService
from app.services.errors import ConflictError, NotFoundError

router = APIRouter(tags=["claims"])


@router.get("", response_model=list[ClaimResponse])
async def list_claims(
    subject: str | None = None,
    sensitivity: Sensitivity | None = None,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ClaimResponse]:
    service = ClaimService(db)
    claims = await service.list_claims(user_id=user_id, subject=subject, sensitivity=sensitivity)
    return [_to_claim_response(item) for item in claims]


@router.get("/{claim_id}", response_model=ClaimResponse)
async def get_claim(
    claim_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClaimResponse:
    service = ClaimService(db)
    try:
        claim = await service.get_claim(claim_id=claim_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _to_claim_response(claim)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ClaimResponse)
async def create_claim(
    payload: CreateClaimRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClaimResponse:
    service = ClaimService(db)
    claim = await service.create_claim(user_id=user_id, payload=payload.claim)
    return _to_claim_response(claim)


@router.patch("/{claim_id}/retract", response_model=ArchiveClaimResponse)
async def retract_claim(
    claim_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ArchiveClaimResponse:
    service = ClaimService(db)
    try:
        claim = await service.retract_claim(claim_id=claim_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return ArchiveClaimResponse(claim_id=str(claim.claim_id), status="retracted")


@router.patch("/{claim_id}/archive", response_model=ArchiveClaimResponse)
async def archive_claim(
    claim_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ArchiveClaimResponse:
    service = ClaimService(db)
    try:
        claim = await service.archive_claim(claim_id=claim_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return ArchiveClaimResponse(claim_id=str(claim.claim_id), status="archived")


@router.get("/{claim_id}/versions", response_model=list[ClaimVersionResponse])
async def list_versions(
    claim_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ClaimVersionResponse]:
    service = ClaimService(db)
    try:
        versions = await service.list_versions(claim_id=claim_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [_to_version_response(item) for item in versions]


@router.patch("/{claim_id}/confirm", response_model=ClaimResponse)
async def confirm_claim(
    claim_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClaimResponse:
    service = ClaimService(db)
    try:
        claim = await service.confirm_claim(claim_id=claim_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _to_claim_response(claim)


@router.patch("/{claim_id}/lock", response_model=ClaimResponse)
async def lock_claim(
    claim_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClaimResponse:
    service = ClaimService(db)
    try:
        claim = await service.lock_claim(claim_id=claim_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _to_claim_response(claim)


@router.patch("/{claim_id}/unlock", response_model=ClaimResponse)
async def unlock_claim(
    claim_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClaimResponse:
    service = ClaimService(db)
    try:
        claim = await service.unlock_claim(claim_id=claim_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _to_claim_response(claim)


@router.patch("/{claim_id}/sensitivity", response_model=ClaimResponse)
async def update_sensitivity(
    claim_id: str,
    payload: UpdateSensitivityRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClaimResponse:
    service = ClaimService(db)
    try:
        claim = await service.update_sensitivity(
            claim_id=claim_id,
            user_id=user_id,
            sensitivity=payload.sensitivity,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _to_claim_response(claim)


def _to_claim_response(claim: Claim) -> ClaimResponse:
    return ClaimResponse(
        claim_id=str(claim.claim_id),
        user_id=str(claim.user_id),
        subject=claim.subject,
        attribute=claim.attribute,
        value=claim.value,
        content=claim.content,
        memory_type=claim.memory_type,
        verification_state=claim.verification_state,
        confidence=claim.confidence,
        source_ref=claim.source_ref,
        source_type=claim.source_type,
        sensitivity=claim.sensitivity,
        trust_level=claim.trust_level,
        handling_policy=claim.handling_policy,
        user_locked=claim.user_locked,
        decay_eligible=claim.decay_eligible,
        lifecycle=claim.lifecycle,
        valid_from=claim.valid_from,
        valid_to=claim.valid_to,
        ingested_at=claim.ingested_at,
        superseded_at=claim.superseded_at,
        review_due=claim.review_due,
        last_reviewed=claim.last_reviewed,
        last_accessed=claim.last_accessed,
        created_at=claim.created_at,
        updated_at=claim.updated_at,
    )


def _to_version_response(version: ClaimVersion) -> ClaimVersionResponse:
    return ClaimVersionResponse(
        version_id=str(version.version_id),
        claim_id=str(version.claim_id),
        version_number=version.version_number,
        version_hash=version.version_hash,
        previous_hash=version.previous_hash,
        content_snapshot=version.content_snapshot,
        change_reason=version.change_reason,
        changed_by=version.changed_by,
        created_at=version.created_at,
    )
