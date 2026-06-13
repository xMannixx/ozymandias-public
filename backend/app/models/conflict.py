"""Conflict group SQLAlchemy models."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base

if TYPE_CHECKING:
    from app.models.claim import Claim
    from app.models.proposal import MemoryProposal


class ConflictGroup(Base):
    """Conflict groups produced by write gate conflict detection."""

    __tablename__ = "conflict_groups"
    __table_args__ = (Index("idx_conflict_groups_pending", "user_id", "status"),)

    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'pending'"))
    resolution: Mapped[str | None] = mapped_column(Text)
    resolved_by: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=text("now()"))
    resolved_at: Mapped[datetime | None] = mapped_column()

    claims: Mapped[list[ConflictGroupClaim]] = relationship(
        back_populates="conflict_group",
        cascade="all, delete-orphan",
    )
    proposals: Mapped[list[MemoryProposal]] = relationship(back_populates="conflict_group")


class ConflictGroupClaim(Base):
    """Many-to-many mapping between conflict groups and claims."""

    __tablename__ = "conflict_group_claims"
    __table_args__ = (Index("idx_conflict_group_claims_claim", "claim_id"),)

    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conflict_groups.group_id", ondelete="CASCADE"),
        primary_key=True,
    )
    claim_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("claims.claim_id", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=text("now()"))

    conflict_group: Mapped[ConflictGroup] = relationship(back_populates="claims")
    claim: Mapped[Claim] = relationship()
