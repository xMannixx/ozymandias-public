"""Mail endpoints backed by Gmail API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import get_current_user
from app.database import get_db
from app.schemas import AuditEventType, AuditResult, Channel, Sensitivity
from app.schemas.api_models import MailDetail, MailSendResponse, MailSummary, SendMailRequest
from app.services.audit_service import AuditService
from app.services.errors import ServiceError
from app.services.gmail_service import GmailService

router = APIRouter(tags=["mail"])


@router.get("", response_model=list[MailSummary])
async def list_mail(
    max_results: int = Query(default=20, ge=1, le=100),
    query: str | None = None,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MailSummary]:
    """List Gmail message summaries."""
    service = GmailService(db)
    try:
        payload = await service.list_messages(user_id=user_id, max_results=max_results, query=query)
    except ServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return [MailSummary(**item) for item in payload]


@router.get("/{message_id}", response_model=MailDetail)
async def get_mail(
    message_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MailDetail:
    """Get one full Gmail message."""
    service = GmailService(db)
    try:
        payload = await service.get_message(user_id=user_id, message_id=message_id)
    except ServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return MailDetail(**payload)


@router.post("/send", response_model=MailSendResponse)
async def send_mail(
    payload: SendMailRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MailSendResponse:
    """Send one Gmail message and log audit event."""
    service = GmailService(db)
    audit = AuditService(db)
    try:
        sent = await service.send_message(
            user_id=user_id,
            to=payload.to,
            subject=payload.subject,
            body=payload.body,
        )
    except ServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await audit.log(
        event_type=AuditEventType.action_executed,
        result=AuditResult.success,
        user_id=user_id,
        channel=Channel.web,
        actor=f"user:{user_id}",
        target_id=sent["id"],
        detail="gmail.send_message",
        payload={"to": payload.to, "subject": payload.subject},
        source_ref=sent["id"],
        sensitivity=Sensitivity.S1,
    )
    return MailSendResponse(**sent)
