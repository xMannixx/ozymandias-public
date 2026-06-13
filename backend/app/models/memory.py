"""Structured memory v2 SQLAlchemy models.

New tables that complement the existing ``claims`` model: raw recall snippets,
a directed entity-relation graph, and the behavioral (procedural) rule lane with
its conflict ledger. Behavioral rules are intentionally a separate table from
the legacy ``procedural_rules`` scaffold; they carry the full review lifecycle
and conflict semantics ported from the agent-memory-skill.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class RecallSnippet(Base):
    """Raw conversational recall kept separate from distilled facts."""

    __tablename__ = "recall_snippets"
    __table_args__ = (
        Index("idx_snippets_user_session", "user_id", "session_id"),
        Index("idx_snippets_expires", "expires_at"),
    )

    snippet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    session_id: Mapped[str | None] = mapped_column(Text)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MemoryEntity(Base):
    """Named entity referenced across the memory graph."""

    __tablename__ = "memory_entities"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_entities_user_name"),
        Index("idx_entities_user", "user_id"),
        Index("idx_entities_expires", "expires_at"),
    )

    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    entity_type: Mapped[str | None] = mapped_column(Text)
    attributes: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MemoryEntityRelation(Base):
    """Directed edge between two entities (subject -[predicate]-> object)."""

    __tablename__ = "memory_entity_relations"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "subject_id",
            "predicate",
            "object_id",
            name="uq_relations_triple",
        ),
        Index("idx_relations_subject", "subject_id"),
        Index("idx_relations_object", "object_id"),
        Index("idx_relations_expires", "expires_at"),
    )

    relation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("memory_entities.entity_id"), nullable=False
    )
    predicate: Mapped[str] = mapped_column(Text, nullable=False)
    object_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("memory_entities.entity_id"), nullable=False
    )
    confidence: Mapped[float] = mapped_column(Float, nullable=False, server_default=text("0.5"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class BehavioralRule(Base):
    """Self-written behavioral rule (procedural lane) under review lifecycle."""

    __tablename__ = "behavioral_rules"
    __table_args__ = (
        Index("idx_behavioral_rules_status", "user_id", "status"),
        Index("idx_behavioral_rules_domain", "user_id", "domain"),
        Index("idx_behavioral_rules_expires", "expires_at"),
    )

    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    domain: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'global'"))
    behavior_text: Mapped[str] = mapped_column(Text, nullable=False)
    trigger_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    effect_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    artifact_cost: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))
    # pending | active | rejected | retired
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'pending'"))
    source_type: Mapped[str] = mapped_column(Text, nullable=False)
    previous_rule_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("behavioral_rules.rule_id")
    )
    proposed_by: Mapped[str | None] = mapped_column(Text)
    decided_by: Mapped[str | None] = mapped_column(Text)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class BehavioralRuleConflict(Base):
    """Detected conflict between a proposed rule and an existing rule."""

    __tablename__ = "behavioral_rule_conflicts"
    __table_args__ = (Index("idx_rule_conflicts_rule", "rule_id"),)

    conflict_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("behavioral_rules.rule_id"), nullable=False
    )
    other_rule_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("behavioral_rules.rule_id")
    )
    # direct | interaction | budget | cap
    conflict_type: Mapped[str] = mapped_column(Text, nullable=False)
    # hard | soft
    severity: Mapped[str] = mapped_column(Text, nullable=False)
    detail: Mapped[str | None] = mapped_column(Text)
    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
