"""Audit log SQLAlchemy models."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Index, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class AuditLog(Base):
    """Append-only audit log records."""

    __tablename__ = "audit_log"
    __table_args__ = (
        Index("idx_audit_event", "event_type", "created_at"),
        Index("idx_audit_user", "user_id", "created_at"),
        Index("idx_audit_sensitivity", "sensitivity"),
    )

    audit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    channel: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    source_ref: Mapped[str | None] = mapped_column(Text)
    result: Mapped[str | None] = mapped_column(Text)
    sensitivity: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'S0'"))
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=text("now()"))
