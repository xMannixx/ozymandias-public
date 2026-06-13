"""Recall snippets and entity-relation graph CRUD.

Snippets are raw conversational recall (separate from distilled claims).
Entities/relations form a directed graph used for 1-hop relation-aware recall.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.memory import MemoryEntity, MemoryEntityRelation, RecallSnippet
from app.services.errors import NotFoundError
from app.services.utils import normalize_user_id

_DEFAULT_SNIPPET_TTL = timedelta(days=7)
_DEFAULT_RELATION_TTL = timedelta(days=90)


class MemoryGraphService:
    """Manage recall snippets and the entity-relation graph."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def add_snippet(
        self,
        *,
        user_id: str,
        role: str,
        content: str,
        session_id: str | None = None,
        ttl: timedelta | None = _DEFAULT_SNIPPET_TTL,
    ) -> RecallSnippet:
        """Store one raw recall snippet with an expiry."""
        expires_at = datetime.now(tz=UTC) + ttl if ttl is not None else None
        snippet = RecallSnippet(
            user_id=normalize_user_id(user_id),
            session_id=session_id,
            role=role,
            content=content,
            expires_at=expires_at,
        )
        self.db.add(snippet)
        await self.db.commit()
        await self.db.refresh(snippet)
        return snippet

    async def list_snippets(
        self, *, user_id: str, session_id: str | None = None, limit: int = 50
    ) -> list[RecallSnippet]:
        """List recent snippets, optionally scoped to a session."""
        stmt = select(RecallSnippet).where(RecallSnippet.user_id == normalize_user_id(user_id))
        if session_id is not None:
            stmt = stmt.where(RecallSnippet.session_id == session_id)
        stmt = stmt.order_by(RecallSnippet.created_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def upsert_entity(
        self,
        *,
        user_id: str,
        name: str,
        entity_type: str | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> MemoryEntity:
        """Create or update an entity by name."""
        uid = normalize_user_id(user_id)
        existing = await self.db.execute(
            select(MemoryEntity).where(MemoryEntity.user_id == uid, MemoryEntity.name == name)
        )
        entity = existing.scalar_one_or_none()
        if entity is None:
            entity = MemoryEntity(
                user_id=uid,
                name=name,
                entity_type=entity_type,
                attributes=attributes,
            )
            self.db.add(entity)
        else:
            if entity_type is not None:
                entity.entity_type = entity_type
            if attributes is not None:
                entity.attributes = attributes
            entity.updated_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(entity)
        return entity

    async def list_entities(self, *, user_id: str) -> list[MemoryEntity]:
        """List all entities for a user."""
        result = await self.db.execute(
            select(MemoryEntity).where(MemoryEntity.user_id == normalize_user_id(user_id))
        )
        return list(result.scalars().all())

    async def add_relation(
        self,
        *,
        user_id: str,
        subject_id: str,
        predicate: str,
        object_id: str,
        confidence: float = 0.5,
        ttl: timedelta | None = _DEFAULT_RELATION_TTL,
    ) -> MemoryEntityRelation:
        """Add a directed edge between two existing entities."""
        uid = normalize_user_id(user_id)
        expires_at = datetime.now(tz=UTC) + ttl if ttl is not None else None
        relation = MemoryEntityRelation(
            user_id=uid,
            subject_id=_to_uuid(subject_id),
            predicate=predicate,
            object_id=_to_uuid(object_id),
            confidence=confidence,
            expires_at=expires_at,
        )
        self.db.add(relation)
        await self.db.commit()
        await self.db.refresh(relation)
        return relation

    async def list_relations(self, *, user_id: str) -> list[MemoryEntityRelation]:
        """List all relations for a user."""
        result = await self.db.execute(
            select(MemoryEntityRelation).where(
                MemoryEntityRelation.user_id == normalize_user_id(user_id)
            )
        )
        return list(result.scalars().all())


def _to_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise NotFoundError(f"Invalid id: {value}") from exc
