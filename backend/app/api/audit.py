"""Audit feed endpoints."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import get_current_user
from app.database import get_db
from app.models.audit import AuditLog
from app.schemas.api_models import AuditEntryResponse, AuditListResponse
from app.services.audit_service import AuditService

router = APIRouter(tags=["audit"])


@router.get("", response_model=AuditListResponse)
async def list_audit_entries(
    event_type: str | None = None,
    sensitivity: str | None = None,
    result: str | None = None,
    after: datetime | None = None,
    before: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AuditListResponse:
    """Return filtered audit entries with pagination and S4 protection."""
    service = AuditService(db)
    entries, total = await service.list_entries(
        user_id=user_id,
        event_type=event_type,
        sensitivity=sensitivity,
        result=result,
        after=after,
        before=before,
        limit=limit,
        offset=offset,
        exclude_s4=sensitivity != "S4",
    )
    return AuditListResponse(
        entries=[_to_audit_entry_response(item) for item in entries],
        total=total,
        limit=limit,
        offset=offset,
    )


def _to_audit_entry_response(entry: AuditLog) -> AuditEntryResponse:
    return AuditEntryResponse(
        audit_id=str(entry.audit_id),
        event_type=entry.event_type,
        user_id=str(entry.user_id),
        channel=entry.channel,
        payload=entry.payload,
        source_ref=entry.source_ref,
        result=entry.result,
        sensitivity=entry.sensitivity,
        created_at=entry.created_at,
    )
