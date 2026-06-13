"""Claim-related SQLAlchemy models."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class Claim(Base):
    """Semantically structured memory claim."""

    __tablename__ = "claims"
    __table_args__ = (
        Index("idx_claims_sensitivity", "user_id", "sensitivity"),
        Index("idx_claims_verification", "user_id", "verification_state"),
        Index("idx_claims_authority", "user_id", "authority_class"),
    )

    claim_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    attribute: Mapped[str | None] = mapped_column(Text)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    memory_type: Mapped[str] = mapped_column(Text, nullable=False)
    authority_class: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'evidence'")
    )
    verification_state: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'tentative'")
    )
    confidence: Mapped[float] = mapped_column(Float, nullable=False, server_default=text("0.5"))
    source_ref: Mapped[str | None] = mapped_column(Text)
    source_type: Mapped[str] = mapped_column(Text, nullable=False)
    sensitivity: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'S0'"))
    trust_level: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'T3'"))
    handling_policy: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'cloud_ok_encrypted'")
    )
    user_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    decay_eligible: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    lifecycle: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'permanent'"))
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    superseded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_due: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    last_reviewed: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_accessed: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    versions: Mapped[list[ClaimVersion]] = relationship(back_populates="claim")
    access_logs: Mapped[list[ClaimAccessLog]] = relationship(back_populates="claim")


class ClaimAccessLog(Base):
    """Access tracking for relevance and citation behavior."""

    __tablename__ = "claim_access_log"

    access_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    claim_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("claims.claim_id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    intent_type: Mapped[str] = mapped_column(Text, nullable=False)
    was_cited: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    provider_id: Mapped[str | None] = mapped_column(Text)
    accessed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    claim: Mapped[Claim] = relationship(back_populates="access_logs")


class ClaimVersion(Base):
    """Append-only claim history records."""

    __tablename__ = "claim_versions"
    __table_args__ = (
        Index("idx_versions_claim_number", "claim_id", "version_number", unique=True),
    )

    version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    claim_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("claims.claim_id"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    version_hash: Mapped[str] = mapped_column(Text, nullable=False)
    previous_hash: Mapped[str | None] = mapped_column(Text)
    content_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    change_reason: Mapped[str | None] = mapped_column(Text)
    changed_by: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    claim: Mapped[Claim] = relationship(back_populates="versions")
