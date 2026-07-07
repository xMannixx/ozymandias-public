"""API tests for conversation endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from app.models.conversation import Conversation, ConversationMessage
from app.services.conversation_service import ConversationService
from app.services.errors import NotFoundError


def _conversation(title: str = "Test chat") -> Conversation:
    now = datetime.now(tz=UTC)
    return Conversation(
        conversation_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        title=title,
        created_at=now,
        updated_at=now,
    )


def _message(conversation_id: uuid.UUID, *, seq: int, role: str) -> ConversationMessage:
    return ConversationMessage(
        message_id=uuid.uuid4(),
        conversation_id=conversation_id,
        user_id=uuid.uuid4(),
        seq=seq,
        role=role,
        content=f"message {seq}",
        sensitivity="S0",
        provider="ollama" if role == "assistant" else None,
        model="llama3" if role == "assistant" else None,
        turn_id="turn-1",
        created_at=datetime.now(tz=UTC),
    )


@pytest.mark.asyncio
async def test_list_conversations_returns_items(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_list(self: ConversationService, *, user_id: str) -> list[Conversation]:
        assert user_id == "test-user-id"
        return [_conversation("First"), _conversation("Second")]

    monkeypatch.setattr(ConversationService, "list_conversations", fake_list)
    response = await client.get("/conversations")
    assert response.status_code == 200
    body = response.json()
    assert [item["title"] for item in body] == ["First", "Second"]


@pytest.mark.asyncio
async def test_list_messages_returns_history(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    conversation = _conversation()

    async def fake_messages(
        self: ConversationService, *, conversation_id: str, user_id: str
    ) -> list[ConversationMessage]:
        assert conversation_id == str(conversation.conversation_id)
        return [
            _message(conversation.conversation_id, seq=1, role="user"),
            _message(conversation.conversation_id, seq=2, role="assistant"),
        ]

    monkeypatch.setattr(ConversationService, "list_messages", fake_messages)
    response = await client.get(f"/conversations/{conversation.conversation_id}/messages")
    assert response.status_code == 200
    body = response.json()
    assert [item["role"] for item in body] == ["user", "assistant"]
    assert body[1]["provider"] == "ollama"


@pytest.mark.asyncio
async def test_list_messages_404_for_unknown_conversation(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_messages(
        self: ConversationService, *, conversation_id: str, user_id: str
    ) -> list[ConversationMessage]:
        raise NotFoundError(f"Conversation not found: {conversation_id}")

    monkeypatch.setattr(ConversationService, "list_messages", fake_messages)
    response = await client.get(f"/conversations/{uuid.uuid4()}/messages")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_rename_conversation_returns_updated_title(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    conversation = _conversation("Renamed")

    async def fake_rename(
        self: ConversationService, *, conversation_id: str, user_id: str, title: str
    ) -> Conversation:
        assert title == "Renamed"
        return conversation

    monkeypatch.setattr(ConversationService, "rename_conversation", fake_rename)
    response = await client.patch(
        f"/conversations/{conversation.conversation_id}",
        json={"title": "Renamed"},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Renamed"


@pytest.mark.asyncio
async def test_delete_conversation_returns_204(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_delete(self: ConversationService, *, conversation_id: str, user_id: str) -> None:
        return None

    monkeypatch.setattr(ConversationService, "delete_conversation", fake_delete)
    response = await client.delete(f"/conversations/{uuid.uuid4()}")
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_conversation_404_when_missing(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_delete(self: ConversationService, *, conversation_id: str, user_id: str) -> None:
        raise NotFoundError(f"Conversation not found: {conversation_id}")

    monkeypatch.setattr(ConversationService, "delete_conversation", fake_delete)
    response = await client.delete(f"/conversations/{uuid.uuid4()}")
    assert response.status_code == 404
