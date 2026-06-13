"""Calendar endpoints backed by Google Calendar API."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import get_current_user
from app.database import get_db
from app.schemas import AuditEventType, AuditResult, Channel, Sensitivity
from app.schemas.api_models import CalendarEventResponse, CreateEventRequest
from app.services.audit_service import AuditService
from app.services.calendar_service import CalendarService
from app.services.errors import ServiceError

router = APIRouter(tags=["calendar"])


@router.get("", response_model=list[CalendarEventResponse])
async def list_events(
    time_min: datetime | None = None,
    time_max: datetime | None = None,
    max_results: int = Query(default=50, ge=1, le=200),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CalendarEventResponse]:
    """List primary calendar events."""
    service = CalendarService(db)
    try:
        payload = await service.list_events(
            user_id=user_id,
            time_min=time_min,
            time_max=time_max,
            max_results=max_results,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return [CalendarEventResponse(**item) for item in payload]


@router.get("/{event_id}", response_model=CalendarEventResponse)
async def get_event(
    event_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CalendarEventResponse:
    """Get one calendar event."""
    service = CalendarService(db)
    try:
        payload = await service.get_event(user_id=user_id, event_id=event_id)
    except ServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return CalendarEventResponse(**payload)


@router.post("", response_model=CalendarEventResponse)
async def create_event(
    payload: CreateEventRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CalendarEventResponse:
    """Create one calendar event and log audit entry."""
    service = CalendarService(db)
    audit = AuditService(db)
    try:
        created = await service.create_event(
            user_id=user_id,
            summary=payload.summary,
            start=payload.start,
            end=payload.end,
            description=payload.description,
            location=payload.location,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await audit.log(
        event_type=AuditEventType.action_executed,
        result=AuditResult.success,
        user_id=user_id,
        channel=Channel.web,
        actor=f"user:{user_id}",
        target_id=created["id"],
        detail="calendar.create_event",
        payload={"summary": payload.summary},
        source_ref=created["id"],
        sensitivity=Sensitivity.S1,
    )
    return CalendarEventResponse(**created)


@router.delete("/{event_id}")
async def delete_event(
    event_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Delete one calendar event and log audit entry."""
    service = CalendarService(db)
    audit = AuditService(db)
    try:
        await service.delete_event(user_id=user_id, event_id=event_id)
    except ServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await audit.log(
        event_type=AuditEventType.action_executed,
        result=AuditResult.success,
        user_id=user_id,
        channel=Channel.web,
        actor=f"user:{user_id}",
        target_id=event_id,
        detail="calendar.delete_event",
        payload={"event_id": event_id},
        source_ref=event_id,
        sensitivity=Sensitivity.S1,
    )
    return {"deleted": True}
