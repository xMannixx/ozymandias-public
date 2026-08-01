"""Conversation persistence and chat history business logic."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation, ConversationMessage
from app.schemas import AuditEventType, AuditResult, Channel, Sensitivity
from app.services.audit_service import AuditService
from app.services.errors import NotFoundError
from app.services.utils import normalize_user_id

MAX_TITLE_LENGTH = 80
# Cloud providers only ever see low-sensitivity history (routing policy: S3/S4 stay local).
CLOUD_SAFE_SENSITIVITIES = {Sensitivity.S0.value, Sensitivity.S1.value, Sensitivity.S2.value}


def derive_title(text: str) -> str:
    """Build a conversation title from the first user message."""
    collapsed = " ".join(text.split())
    if len(collapsed) <= MAX_TITLE_LENGTH:
        return collapsed or "New chat"
    return collapsed[: MAX_TITLE_LENGTH - 1].rstrip() + "\u2026"


class ConversationService:
    """Business layer for chat conversations and their messages."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.audit = AuditService(db)

    async def list_conversations(
        self, *, user_id: str, project_id: str | None = None
    ) -> list[Conversation]:
        """Return conversations for the user, newest activity first.

        Passing ``project_id`` narrows the list to one workspace.
        """
        stmt = (
            select(Conversation)
            .where(Conversation.user_id == normalize_user_id(user_id))
            .order_by(Conversation.updated_at.desc())
        )
        if project_id is not None:
            try:
                stmt = stmt.where(Conversation.project_id == uuid.UUID(project_id))
            except ValueError as exc:
                raise NotFoundError(f"Project not found: {project_id}") from exc
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_conversation(
        self, *, user_id: str, title: str, project_id: str | None = None
    ) -> Conversation:
        """Create a new conversation, optionally inside a workspace."""
        conversation = Conversation(
            user_id=normalize_user_id(user_id),
            title=derive_title(title),
            project_id=uuid.UUID(project_id) if project_id else None,
        )
        self.db.add(conversation)
        await self.db.commit()
        await self.db.refresh(conversation)
        return conversation

    async def get_conversation(self, *, conversation_id: str, user_id: str) -> Conversation:
        """Return one conversation owned by the user or raise NotFoundError."""
        try:
            conversation_uuid = uuid.UUID(conversation_id)
        except ValueError as exc:
            raise NotFoundError(f"Conversation not found: {conversation_id}") from exc
        stmt = select(Conversation).where(
            Conversation.conversation_id == conversation_uuid,
            Conversation.user_id == normalize_user_id(user_id),
        )
        result = await self.db.execute(stmt)
        conversation = result.scalar_one_or_none()
        if conversation is None:
            raise NotFoundError(f"Conversation not found: {conversation_id}")
        return conversation

    async def rename_conversation(
        self, *, conversation_id: str, user_id: str, title: str
    ) -> Conversation:
        """Rename a conversation."""
        conversation = await self.get_conversation(conversation_id=conversation_id, user_id=user_id)
        conversation.title = derive_title(title)
        conversation.updated_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(conversation)
        return conversation

    async def delete_conversation(self, *, conversation_id: str, user_id: str) -> None:
        """Delete a conversation including all messages (ON DELETE CASCADE)."""
        conversation = await self.get_conversation(conversation_id=conversation_id, user_id=user_id)
        await self.db.delete(conversation)
        await self.db.commit()
        await self.audit.log(
            event_type=AuditEventType.action_executed,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.web,
            actor=f"user:{user_id}",
            target_id=conversation_id,
            detail="Conversation deleted",
            payload={"conversation_id": conversation_id},
            source_ref=conversation_id,
        )

    async def list_messages(
        self, *, conversation_id: str, user_id: str
    ) -> list[ConversationMessage]:
        """Return all messages of one conversation in chronological order."""
        conversation = await self.get_conversation(conversation_id=conversation_id, user_id=user_id)
        stmt = (
            select(ConversationMessage)
            .where(ConversationMessage.conversation_id == conversation.conversation_id)
            .order_by(ConversationMessage.seq)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def append_message(
        self,
        *,
        conversation: Conversation,
        user_id: str,
        role: str,
        content: str,
        sensitivity: Sensitivity = Sensitivity.S0,
        provider: str | None = None,
        model: str | None = None,
        turn_id: str | None = None,
    ) -> ConversationMessage:
        """Append one message and bump the conversation's updated_at."""
        seq_stmt = select(func.coalesce(func.max(ConversationMessage.seq), 0)).where(
            ConversationMessage.conversation_id == conversation.conversation_id
        )
        seq_result = await self.db.execute(seq_stmt)
        next_seq = int(seq_result.scalar_one_or_none() or 0) + 1

        message = ConversationMessage(
            conversation_id=conversation.conversation_id,
            user_id=normalize_user_id(user_id),
            seq=next_seq,
            role=role,
            content=content,
            sensitivity=sensitivity.value,
            provider=provider,
            model=model,
            turn_id=turn_id,
        )
        self.db.add(message)
        conversation.updated_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(message)
        return message

    async def recent_history(
        self,
        *,
        conversation: Conversation,
        limit: int = 20,
        max_chars: int = 8000,
        provider_is_local: bool = True,
    ) -> list[ConversationMessage]:
        """Return recent messages for LLM context, oldest first.

        Non-local providers only receive S0-S2 messages so prior sensitive
        turns never leave the local boundary.
        """
        stmt = (
            select(ConversationMessage)
            .where(ConversationMessage.conversation_id == conversation.conversation_id)
            .order_by(ConversationMessage.seq.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        newest_first = list(result.scalars().all())

        selected: list[ConversationMessage] = []
        total_chars = 0
        for message in newest_first:
            if not provider_is_local and message.sensitivity not in CLOUD_SAFE_SENSITIVITIES:
                continue
            total_chars += len(message.content)
            if total_chars > max_chars:
                break
            selected.append(message)
        selected.reverse()
        return selected
