"""Episode and procedural rule SQLAlchemy models."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Float, Integer, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class ProceduralRule(Base):
    """Procedural memory rules loaded on every turn."""

    __tablename__ = "procedural_rules"

    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    rule: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    sensitivity: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'S0'"))
    source_type: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=text("now()"))


class Episode(Base):
    """Append-only episodic memory records."""

    __tablename__ = "episodes"

    episode_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    turn_index: Mapped[int | None] = mapped_column(Integer)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sensitivity: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'S0'"))
    extracted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    extraction_job_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    # Schema uses pgvector(1536); ARRAY(Float) keeps this scaffold dependency-light.
    embedding: Mapped[list[float] | None] = mapped_column(ARRAY(Float))
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=text("now()"))
