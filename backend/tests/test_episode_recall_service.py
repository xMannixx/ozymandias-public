"""Tests for semantic recall over earlier conversations."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import cast

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import EMBEDDING_DIMENSIONS, Episode
from app.services.episode_recall_service import EpisodeRecallService
from app.services.llm.embeddings import EmbeddingClient
from tests.conftest import FakeAsyncSession, FakeQueryResult

USER_ID = str(uuid.uuid4())


class _FakeEmbeddings:
    model = "test-embed"

    def __init__(self, *, available: bool = True) -> None:
        self.available = available
        self.queries: list[str] = []

    async def embed_text(self, text: str) -> list[float] | None:
        self.queries.append(text)
        return [0.1] * EMBEDDING_DIMENSIONS if self.available else None


class _FailingSession(FakeAsyncSession):
    async def execute(self, _query: object) -> FakeQueryResult:
        raise RuntimeError('type "vector" does not exist')


class _RecordingSession(FakeAsyncSession):
    """Keeps the statements so the generated filters can be inspected."""

    def __init__(self) -> None:
        super().__init__()
        self.statements: list[object] = []

    async def execute(self, _query: object) -> FakeQueryResult:
        self.statements.append(_query)
        return await super().execute(_query)


def _sql(session: _RecordingSession) -> str:
    assert session.statements, "expected a query to have been executed"
    return str(session.statements[-1])


def _episode(content: str, *, role: str = "user") -> Episode:
    return Episode(
        episode_id=uuid.uuid4(),
        user_id=uuid.UUID(USER_ID),
        conversation_id=uuid.uuid4(),
        turn_index=1,
        role=role,
        content=content,
        sensitivity="S1",
        created_at=datetime(2026, 5, 12, 9, 30, tzinfo=UTC),
    )


def _service(
    rows: list[tuple[Episode, float]],
    embeddings: _FakeEmbeddings,
    *,
    session: FakeAsyncSession | None = None,
) -> EpisodeRecallService:
    db = session or FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=list(rows)))
    return EpisodeRecallService(
        cast(AsyncSession, db), embeddings=cast(EmbeddingClient, embeddings)
    )


@pytest.mark.asyncio
async def test_recall_returns_the_matching_messages() -> None:
    episode = _episode("We settled on Hetzner for the VPS.", role="assistant")
    service = _service([(episode, 0.21)], _FakeEmbeddings())

    recalled = await service.recall(
        user_id=USER_ID,
        query="Which host did we pick again?",
        provider_is_local=True,
    )

    assert [item.content for item in recalled] == ["We settled on Hetzner for the VPS."]
    assert recalled[0].role == "assistant"
    assert recalled[0].distance == pytest.approx(0.21)
    assert recalled[0].created_at == datetime(2026, 5, 12, 9, 30, tzinfo=UTC)


@pytest.mark.asyncio
async def test_an_empty_query_never_embeds_anything() -> None:
    embeddings = _FakeEmbeddings()
    service = _service([], embeddings)

    assert await service.recall(user_id=USER_ID, query="   ", provider_is_local=True) == []
    assert embeddings.queries == []


@pytest.mark.asyncio
async def test_recall_is_skipped_when_the_local_model_is_down() -> None:
    """Without a query vector there is nothing to compare against."""
    service = _service([(_episode("anything"), 0.1)], _FakeEmbeddings(available=False))

    assert await service.recall(user_id=USER_ID, query="anything?", provider_is_local=True) == []


@pytest.mark.asyncio
async def test_private_episodes_stay_out_of_a_cloud_prompt() -> None:
    """S3/S4 content may be indexed locally, but it must not travel."""
    session = _RecordingSession()
    service = _service([], _FakeEmbeddings(), session=session)

    await service.recall(user_id=USER_ID, query="the clinic", provider_is_local=False)

    assert "sensitivity NOT IN" in _sql(session)


@pytest.mark.asyncio
async def test_a_local_model_may_see_private_episodes() -> None:
    session = _RecordingSession()
    service = _service([], _FakeEmbeddings(), session=session)

    await service.recall(user_id=USER_ID, query="the clinic", provider_is_local=True)

    assert "sensitivity NOT IN" not in _sql(session)


@pytest.mark.asyncio
async def test_the_current_chat_is_excluded_from_recall() -> None:
    """It is already in the prompt as recent history; recalling it wastes budget."""
    session = _RecordingSession()
    service = _service([], _FakeEmbeddings(), session=session)

    await service.recall(
        user_id=USER_ID,
        query="where were we",
        provider_is_local=True,
        exclude_conversation_id=str(uuid.uuid4()),
    )

    assert "conversation_id !=" in _sql(session)


@pytest.mark.asyncio
async def test_a_database_without_vectors_does_not_break_the_turn() -> None:
    service = _service(
        [],
        _FakeEmbeddings(),
        session=_FailingSession(),
    )

    assert await service.recall(user_id=USER_ID, query="anything?", provider_is_local=True) == []
