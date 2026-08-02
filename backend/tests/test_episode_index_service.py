"""Tests for turning chat messages into embedded episodes."""

from __future__ import annotations

import uuid
from typing import cast

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import ConversationMessage
from app.models.user import EMBEDDING_DIMENSIONS, Episode
from app.services.episode_index_service import (
    EMBED_BATCH_SIZE,
    MIN_CHARS_TO_EMBED,
    EpisodeIndexService,
)
from app.services.llm.embeddings import EmbeddingClient
from tests.conftest import FakeAsyncSession, FakeQueryResult

USER_ID = uuid.uuid4()
CONVERSATION_ID = uuid.uuid4()


class _FakeEmbeddings:
    """Embedding client double with a fixed answer and a call log."""

    model = "test-embed"

    def __init__(self, *, available: bool = True) -> None:
        self.available = available
        self.batches: list[list[str]] = []

    async def embed_texts(self, texts: list[str]) -> list[list[float]] | None:
        self.batches.append(texts)
        if not self.available:
            return None
        return [[float(index)] * EMBEDDING_DIMENSIONS for index, _ in enumerate(texts)]


def _message(content: str, *, seq: int = 1) -> ConversationMessage:
    return ConversationMessage(
        message_id=uuid.uuid4(),
        conversation_id=CONVERSATION_ID,
        user_id=USER_ID,
        seq=seq,
        role="user",
        content=content,
        sensitivity="S1",
    )


def _service(
    messages: list[ConversationMessage],
    embeddings: _FakeEmbeddings,
) -> tuple[EpisodeIndexService, FakeAsyncSession]:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=list(messages)))
    service = EpisodeIndexService(
        cast(AsyncSession, db), embeddings=cast(EmbeddingClient, embeddings)
    )
    return service, db


def _episodes(db: FakeAsyncSession) -> list[Episode]:
    return [row for row in db.added if isinstance(row, Episode)]


@pytest.mark.asyncio
async def test_every_indexed_message_becomes_an_episode() -> None:
    messages = [
        _message("Where did we land on the storage budget?", seq=1),
        _message("We agreed on 200 euros a month for object storage.", seq=2),
    ]
    embeddings = _FakeEmbeddings()
    service, db = _service(messages, embeddings)

    counts = await service.index_user(user_id=str(USER_ID))

    episodes = _episodes(db)
    assert counts == {"messages": 2, "embedded": 2, "skipped": 0}
    assert [episode.turn_index for episode in episodes] == [1, 2]
    assert [episode.content for episode in episodes] == [m.content for m in messages]
    assert db.commits >= 1


@pytest.mark.asyncio
async def test_episodes_keep_the_sensitivity_of_their_message() -> None:
    """A local vector is fine, but the row still has to carry its own label."""
    message = _message("The clinic appointment moved to Thursday morning.")
    message.sensitivity = "S3"
    service, db = _service([message], _FakeEmbeddings())

    await service.index_user(user_id=str(USER_ID))

    assert _episodes(db)[0].sensitivity == "S3"


@pytest.mark.asyncio
async def test_nothing_to_index_touches_neither_model_nor_database() -> None:
    embeddings = _FakeEmbeddings()
    service, db = _service([], embeddings)

    counts = await service.index_user(user_id=str(USER_ID))

    assert counts == {"messages": 0, "embedded": 0, "skipped": 0}
    assert embeddings.batches == []
    assert db.commits == 0


@pytest.mark.asyncio
async def test_short_messages_are_stored_without_a_vector() -> None:
    """ "Thanks!" would match every query, but it stays part of the history."""
    short = _message("ok thanks")
    assert len(short.content) < MIN_CHARS_TO_EMBED
    long = _message("Remind me which provider hosts the mail domain.", seq=2)
    embeddings = _FakeEmbeddings()
    service, db = _service([short, long], embeddings)

    counts = await service.index_user(user_id=str(USER_ID))

    episodes = _episodes(db)
    assert embeddings.batches == [[long.content]]
    assert counts == {"messages": 2, "embedded": 1, "skipped": 1}
    assert episodes[0].embedding is None
    assert episodes[1].embedding is not None


@pytest.mark.asyncio
async def test_an_unreachable_model_leaves_the_messages_for_the_next_run() -> None:
    """Writing episodes without vectors would mark them done and unsearchable."""
    service, db = _service(
        [_message("A message long enough to be embedded.")], _FakeEmbeddings(available=False)
    )

    counts = await service.index_user(user_id=str(USER_ID))

    assert counts == {"messages": 1, "embedded": 0, "skipped": 1}
    assert db.added == []
    assert db.commits == 0


@pytest.mark.asyncio
async def test_a_large_backlog_is_embedded_in_batches() -> None:
    messages = [
        _message(f"Message number {index} with enough text.", seq=index) for index in range(40)
    ]
    embeddings = _FakeEmbeddings()
    service, db = _service(messages, embeddings)

    counts = await service.index_user(user_id=str(USER_ID))

    assert [len(batch) for batch in embeddings.batches] == [EMBED_BATCH_SIZE, EMBED_BATCH_SIZE, 8]
    assert counts["embedded"] == 40
    assert len(_episodes(db)) == 40
