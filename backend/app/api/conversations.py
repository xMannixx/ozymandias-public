"""Conversation endpoints for chat history."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import get_current_user
from app.database import get_db
from app.models.conversation import Conversation, ConversationMessage
from app.schemas.api_models import (
    ConversationMessageResponse,
    ConversationResponse,
    UpdateConversationRequest,
)
from app.services.conversation_service import ConversationService
from app.services.errors import NotFoundError

router = APIRouter(tags=["conversations"])


@router.get("", response_model=list[ConversationResponse])
async def list_conversations(
    project_id: str | None = Query(default=None),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConversationResponse]:
    service = ConversationService(db)
    try:
        conversations = await service.list_conversations(user_id=user_id, project_id=project_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [_to_conversation_response(item) for item in conversations]


@router.get("/{conversation_id}/messages", response_model=list[ConversationMessageResponse])
async def list_messages(
    conversation_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConversationMessageResponse]:
    service = ConversationService(db)
    try:
        messages = await service.list_messages(conversation_id=conversation_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [_to_message_response(item) for item in messages]


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def rename_conversation(
    conversation_id: str,
    payload: UpdateConversationRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationResponse:
    service = ConversationService(db)
    try:
        conversation = await service.rename_conversation(
            conversation_id=conversation_id,
            user_id=user_id,
            title=payload.title,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _to_conversation_response(conversation)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    service = ConversationService(db)
    try:
        await service.delete_conversation(conversation_id=conversation_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


def _to_conversation_response(conversation: Conversation) -> ConversationResponse:
    return ConversationResponse(
        conversation_id=str(conversation.conversation_id),
        title=conversation.title,
        project_id=str(conversation.project_id) if conversation.project_id else None,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )


def _to_message_response(message: ConversationMessage) -> ConversationMessageResponse:
    role = message.role if message.role in {"user", "assistant"} else "assistant"
    return ConversationMessageResponse(
        message_id=str(message.message_id),
        conversation_id=str(message.conversation_id),
        role=role,  # type: ignore[arg-type]
        content=message.content,
        provider=message.provider,
        model=message.model,
        turn_id=message.turn_id,
        created_at=message.created_at,
    )
