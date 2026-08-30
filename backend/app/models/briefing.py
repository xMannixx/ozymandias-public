"""Daily briefing SQLAlchemy model."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, DateTime, Index, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class Briefing(Base):
    """One rendered morning briefing.

    The unique constraint is what keeps the hourly heartbeat from writing a
    second briefing on a day that already has one.
    """

    __tablename__ = "briefings"
    __table_args__ = (
        UniqueConstraint("user_id", "briefing_date", name="briefings_user_id_briefing_date_key"),
        Index("idx_briefings_user_date", "user_id", "briefing_date"),
    )

    briefing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    briefing_date: Mapped[date] = mapped_column(Date, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    #: Same information as ``content``, structured for the dashboard card.
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
