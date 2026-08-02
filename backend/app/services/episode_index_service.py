"""Turn chat messages into searchable episodes.

The chat log in ``conversation_messages`` is chronological only: without
vectors, a question about something discussed weeks ago finds nothing. This
service embeds messages that have no episode yet and stores them in
``episodes``, which :mod:`app.services.episode_recall_service` searches.

It runs on the Celery worker, never in a turn. Indexing lags a message by up to
half an hour, and that is fine — the current conversation is already in the
prompt as recent history.
"""

from __future__ import annotations

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, run_db_job
from app.models.conversation import ConversationMessage
from app.models.user import Episode
from app.schemas import AuditEventType, AuditResult, Channel, Sensitivity
from app.services.audit_service import AuditService
from app.services.job_targets import user_ids_with_conversations
from app.services.llm.embeddings import EmbeddingClient, get_embedding_client
from app.services.utils import normalize_user_id

#: A backlog is worked off over several runs instead of in one long job.
MAX_MESSAGES_PER_RUN = 500

#: Ollama embeds a list in one call; small batches keep memory predictable.
EMBED_BATCH_SIZE = 16

#: Beyond this the embedding model truncates anyway, and the tail of a long
#: message rarely carries the topic.
MAX_CHARS_PER_MESSAGE = 4000

#: "ok", "thanks" and the like produce vectors that match everything.
MIN_CHARS_TO_EMBED = 25


class EpisodeIndexService:
    """Write embedded episodes for messages that do not have one yet."""

    def __init__(self, db: AsyncSession, *, embeddings: EmbeddingClient | None = None) -> None:
        self.db = db
        self.audit = AuditService(db)
        self._embeddings = embeddings or get_embedding_client()

    async def index_user(
        self, *, user_id: str, limit: int = MAX_MESSAGES_PER_RUN
    ) -> dict[str, int]:
        """Index one user's unindexed messages.

        Returns counts rather than raising: a run that reaches no embedding
        model is a normal outcome, not an error.
        """
        uid = normalize_user_id(user_id)
        messages = await self._unindexed_messages(uid, limit)
        if not messages:
            return {"messages": 0, "embedded": 0, "skipped": 0}

        embeddable = [m for m in messages if len(m.content.strip()) >= MIN_CHARS_TO_EMBED]
        vectors = await self._embed(embeddable)
        if vectors is None:
            # Storing episodes without vectors would mark the messages as done
            # and leave them unsearchable forever. Better to retry next run.
            return {"messages": len(messages), "embedded": 0, "skipped": len(messages)}

        for message in messages:
            self.db.add(
                Episode(
                    user_id=message.user_id,
                    conversation_id=message.conversation_id,
                    turn_index=message.seq,
                    role=message.role,
                    content=message.content,
                    sensitivity=message.sensitivity,
                    embedding=vectors.get(str(message.message_id)),
                )
            )
        await self.db.commit()

        embedded = len(vectors)
        await self.audit.log(
            event_type=AuditEventType.action_executed,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.celery,
            actor="service:episode_index",
            target_id=str(uid),
            detail="Episode indexing completed",
            payload={
                "messages": len(messages),
                "embedded": embedded,
                "model": self._embeddings.model,
            },
            source_ref="episode-index",
            sensitivity=Sensitivity.S0,
        )
        return {
            "messages": len(messages),
            "embedded": embedded,
            "skipped": len(messages) - embedded,
        }

    async def _unindexed_messages(self, uid: object, limit: int) -> list[ConversationMessage]:
        """Messages with no episode, oldest first so history fills in order."""
        has_episode = (
            select(Episode.episode_id)
            .where(
                Episode.conversation_id == ConversationMessage.conversation_id,
                Episode.turn_index == ConversationMessage.seq,
            )
            .exists()
        )
        stmt = (
            select(ConversationMessage)
            .where(ConversationMessage.user_id == uid, ~has_episode)
            .order_by(ConversationMessage.created_at)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _embed(self, messages: list[ConversationMessage]) -> dict[str, list[float]] | None:
        """Vectors per message id, or ``None`` when the model is unreachable."""
        vectors: dict[str, list[float]] = {}
        for start in range(0, len(messages), EMBED_BATCH_SIZE):
            batch = messages[start : start + EMBED_BATCH_SIZE]
            texts = [m.content.strip()[:MAX_CHARS_PER_MESSAGE] for m in batch]
            embedded = await self._embeddings.embed_texts(texts)
            if embedded is None:
                return None
            for message, vector in zip(batch, embedded, strict=True):
                vectors[str(message.message_id)] = vector
        return vectors


async def _run_episode_index_job(user_id: str) -> dict[str, int]:
    async with AsyncSessionLocal() as db:
        service = EpisodeIndexService(db)
        return await service.index_user(user_id=user_id)


async def _run_episode_index_job_for_all() -> dict[str, dict[str, int]]:
    async with AsyncSessionLocal() as db:
        user_ids = await user_ids_with_conversations(db)
    return {user_id: await _run_episode_index_job(user_id) for user_id in user_ids}


@shared_task(name="ozy.episodes.index")  # type: ignore[untyped-decorator,misc,unused-ignore]
def run_episode_index_task(user_id: str) -> dict[str, int]:
    """Celery task: index one user's new messages."""
    return run_db_job(_run_episode_index_job(user_id))


@shared_task(name="ozy.episodes.index_all")  # type: ignore[untyped-decorator,misc,unused-ignore]
def run_episode_index_all_task() -> dict[str, dict[str, int]]:
    """Beat entrypoint: index new messages of every user that chats."""
    return run_db_job(_run_episode_index_job_for_all())
