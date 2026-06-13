"""Audit logging service with Rust-side validation."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.schemas import AuditEntry, AuditEventType, AuditResult, Channel, Sensitivity
from app.services import rust_bridge
from app.services.errors import ValidationError
from app.services.utils import normalize_user_id


class AuditService:
    """Create and persist validated audit entries."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def log(
        self,
        *,
        event_type: AuditEventType,
        result: AuditResult,
        user_id: str,
        channel: Channel,
        actor: str,
        target_id: str,
        detail: str,
        payload: dict[str, Any] | None = None,
        source_ref: str | None = None,
        sensitivity: Sensitivity = Sensitivity.S0,
    ) -> AuditLog:
        """Validate an audit event through Rust and write it to the DB."""
        now = datetime.now(tz=UTC)
        payload_json = json.dumps(payload, sort_keys=True) if payload is not None else None
        entry = AuditEntry(
            event_type=event_type,
            result=result,
            actor=actor,
            target_id=target_id,
            detail=detail,
            timestamp=now.isoformat(),
            sensitivity=sensitivity,
            channel=channel,
            payload=payload_json,
            source_ref=source_ref,
        )
        validation = rust_bridge.validate_audit_entry(entry)
        if not isinstance(validation, str) or validation != "Valid":
            raise ValidationError(f"Invalid audit entry: {validation!r}")

        audit_log = AuditLog(
            event_type=event_type.value,
            result=result.value,
            user_id=normalize_user_id(user_id),
            channel=channel.value,
            payload=payload,
            source_ref=source_ref,
            sensitivity=sensitivity.value,
        )
        self.db.add(audit_log)
        await self.db.commit()
        await self.db.refresh(audit_log)
        return audit_log

    async def list_entries(
        self,
        *,
        user_id: str,
        event_type: str | None,
        sensitivity: str | None,
        result: str | None,
        after: datetime | None,
        before: datetime | None,
        limit: int,
        offset: int,
        exclude_s4: bool = True,
    ) -> tuple[list[AuditLog], int]:
        """List audit entries with filters and pagination metadata."""
        filters = [AuditLog.user_id == normalize_user_id(user_id)]
        if event_type is not None:
            filters.append(AuditLog.event_type == event_type)
        if result is not None:
            filters.append(AuditLog.result == result)
        if sensitivity is not None:
            filters.append(AuditLog.sensitivity == sensitivity)
        elif exclude_s4:
            filters.append(AuditLog.sensitivity != Sensitivity.S4.value)
        if after is not None:
            filters.append(AuditLog.created_at >= after)
        if before is not None:
            filters.append(AuditLog.created_at <= before)

        entries_stmt = (
            select(AuditLog)
            .where(*filters)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        entries_result = await self.db.execute(entries_stmt)
        entries = list(entries_result.scalars().all())

        total_stmt = select(func.count()).select_from(AuditLog).where(*filters)
        total_result = await self.db.execute(total_stmt)
        total_raw = total_result.scalar_one_or_none()
        total = int(total_raw) if total_raw is not None else 0
        return entries, total
