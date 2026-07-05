"""Unit tests for conversation service."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import cast
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation, ConversationMessage
from app.schemas import Sensitivity
from app.services.conversation_service import ConversationService, derive_title
from app.services.errors import NotFoundError
from tests.conftest import FakeAsyncSession, FakeQueryResult


def _conversation() -> Conversation:
    now = datetime.now(tz=UTC)
    return Conversation(
        conversation_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        title="Test chat",
        created_at=now,
        updated_at=now,
    )


def _message(
    conversation_id: uuid.UUID,
    *,
    seq: int,
    role: str = "user",
    content: str = "hello",
    sensitivity: str = "S0",
) -> ConversationMessage:
    return ConversationMessage(
        message_id=uuid.uuid4(),
        conversation_id=conversation_id,
        user_id=uuid.uuid4(),
        seq=seq,
        role=role,
        content=content,
        sensitivity=sensitivity,
        provider=None,
        model=None,
        turn_id=None,
        created_at=datetime.now(tz=UTC),
    )


def test_derive_title_short_text_unchanged() -> None:
    assert derive_title("Hello Ozy") == "Hello Ozy"


def test_derive_title_collapses_whitespace() -> None:
    assert derive_title("Hello\n  Ozy \t there") == "Hello Ozy there"


def test_derive_title_truncates_long_text() -> None:
    title = derive_title("x" * 200)
    assert len(title) <= 80
    assert title.endswith("\u2026")


def test_derive_title_empty_fallback() -> None:
    assert derive_title("   ") == "New chat"


@pytest.mark.asyncio
async def test_create_conversation_adds_and_commits() -> None:
    session = FakeAsyncSession()
    service = ConversationService(cast(AsyncSession, session))

    conversation = await service.create_conversation(user_id="user-1", title="Hello Ozy")
    assert conversation.title == "Hello Ozy"
    assert session.commits == 1
    assert len(session.added) == 1


@pytest.mark.asyncio
async def test_get_conversation_raises_for_invalid_uuid() -> None:
    session = FakeAsyncSession()
    service = ConversationService(cast(AsyncSession, session))

    with pytest.raises(NotFoundError):
        await service.get_conversation(conversation_id="not-a-uuid", user_id="user-1")


@pytest.mark.asyncio
async def test_get_conversation_raises_when_missing() -> None:
    session = FakeAsyncSession()
    service = ConversationService(cast(AsyncSession, session))

    with pytest.raises(NotFoundError):
        await service.get_conversation(conversation_id=str(uuid.uuid4()), user_id="user-1")


@pytest.mark.asyncio
async def test_rename_conversation_updates_title() -> None:
    session = FakeAsyncSession()
    conversation = _conversation()
    session.queue_execute_result(FakeQueryResult(single=conversation))
    service = ConversationService(cast(AsyncSession, session))

    renamed = await service.rename_conversation(
        conversation_id=str(conversation.conversation_id),
        user_id="user-1",
        title="Renamed",
    )
    assert renamed.title == "Renamed"
    assert session.commits == 1


@pytest.mark.asyncio
async def test_delete_conversation_deletes_and_audits() -> None:
    session = FakeAsyncSession()
    conversation = _conversation()
    session.queue_execute_result(FakeQueryResult(single=conversation))
    service = ConversationService(cast(AsyncSession, session))
    service.audit.log = AsyncMock()  # type: ignore[method-assign]

    await service.delete_conversation(
        conversation_id=str(conversation.conversation_id), user_id="user-1"
    )
    assert session.deleted == [conversation]
    assert service.audit.log.await_count == 1


@pytest.mark.asyncio
async def test_list_messages_returns_ordered_messages() -> None:
    session = FakeAsyncSession()
    conversation = _conversation()
    messages = [
        _message(conversation.conversation_id, seq=1),
        _message(conversation.conversation_id, seq=2, role="assistant", content="hi"),
    ]
    session.queue_execute_result(FakeQueryResult(single=conversation))
    session.queue_execute_result(FakeQueryResult(values=cast(list[object], messages)))
    service = ConversationService(cast(AsyncSession, session))

    result = await service.list_messages(
        conversation_id=str(conversation.conversation_id), user_id="user-1"
    )
    assert [item.seq for item in result] == [1, 2]


@pytest.mark.asyncio
async def test_append_message_assigns_next_seq() -> None:
    session = FakeAsyncSession()
    session.queue_execute_result(FakeQueryResult(single=3))
    conversation = _conversation()
    service = ConversationService(cast(AsyncSession, session))

    message = await service.append_message(
        conversation=conversation,
        user_id="user-1",
        role="assistant",
        content="answer",
        sensitivity=Sensitivity.S1,
        provider="ollama",
        model="llama3",
        turn_id="turn-9",
    )
    assert message.seq == 4
    assert message.sensitivity == "S1"
    assert message.provider == "ollama"
    assert session.commits == 1


@pytest.mark.asyncio
async def test_recent_history_returns_oldest_first() -> None:
    session = FakeAsyncSession()
    conversation = _conversation()
    newest_first = [
        _message(conversation.conversation_id, seq=3, content="third"),
        _message(conversation.conversation_id, seq=2, content="second"),
        _message(conversation.conversation_id, seq=1, content="first"),
    ]
    session.queue_execute_result(FakeQueryResult(values=cast(list[object], newest_first)))
    service = ConversationService(cast(AsyncSession, session))

    history = await service.recent_history(conversation=conversation, provider_is_local=True)
    assert [item.content for item in history] == ["first", "second", "third"]


@pytest.mark.asyncio
async def test_recent_history_excludes_sensitive_messages_for_cloud() -> None:
    session = FakeAsyncSession()
    conversation = _conversation()
    newest_first = [
        _message(conversation.conversation_id, seq=3, content="normal", sensitivity="S1"),
        _message(conversation.conversation_id, seq=2, content="secret", sensitivity="S3"),
        _message(conversation.conversation_id, seq=1, content="intimate", sensitivity="S4"),
    ]
    session.queue_execute_result(FakeQueryResult(values=cast(list[object], newest_first)))
    service = ConversationService(cast(AsyncSession, session))

    history = await service.recent_history(conversation=conversation, provider_is_local=False)
    assert [item.content for item in history] == ["normal"]


@pytest.mark.asyncio
async def test_recent_history_respects_char_budget() -> None:
    session = FakeAsyncSession()
    conversation = _conversation()
    newest_first = [
        _message(conversation.conversation_id, seq=2, content="b" * 100),
        _message(conversation.conversation_id, seq=1, content="a" * 100),
    ]
    session.queue_execute_result(FakeQueryResult(values=cast(list[object], newest_first)))
    service = ConversationService(cast(AsyncSession, session))

    history = await service.recent_history(
        conversation=conversation, max_chars=150, provider_is_local=True
    )
    assert len(history) == 1
    assert history[0].content == "b" * 100
