"""Find earlier conversations that relate to the current message.

Recent history covers the chat you are in. This covers the ones you are not:
the decision made six weeks ago in a chat you no longer remember opening.
Matching is by embedding distance, so it survives different wording.

Nothing here is allowed to break a turn. An unreachable embedding model, a
database without the vector extension, an empty index — each ends in an empty
list, and the turn proceeds with the context it has.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import Episode
from app.schemas import Sensitivity
from app.services.llm.embeddings import EmbeddingClient, get_embedding_client
from app.services.utils import normalize_user_id

logger = logging.getLogger(__name__)

#: More than a handful of old snippets crowds out claims and contacts.
MAX_EPISODES = 4

#: Cosine distance above this is topic drift, not a memory. Injecting those
#: would make the model reference conversations that never happened.
MAX_COSINE_DISTANCE = 0.55

_LOCAL_ONLY_SENSITIVITIES = {Sensitivity.S3.value, Sensitivity.S4.value}


@dataclass(frozen=True)
class RecalledEpisode:
    """One earlier message that resembles the current one."""

    role: str
    content: str
    created_at: datetime | None
    #: Cosine distance, smaller is closer. Kept for the audit trail.
    distance: float


class EpisodeRecallService:
    """Search indexed episodes by embedding distance."""

    def __init__(self, db: AsyncSession, *, embeddings: EmbeddingClient | None = None) -> None:
        self.db = db
        self._embeddings = embeddings or get_embedding_client()

    async def recall(
        self,
        *,
        user_id: str,
        query: str,
        provider_is_local: bool,
        exclude_conversation_id: str | None = None,
        limit: int = MAX_EPISODES,
    ) -> list[RecalledEpisode]:
        """Closest earlier messages, or an empty list if there are none."""
        if not query.strip():
            return []
        vector = await self._embeddings.embed_text(query)
        if vector is None:
            return []

        distance = Episode.embedding.cosine_distance(vector)
        stmt = (
            select(Episode, distance.label("distance"))
            .where(
                Episode.user_id == normalize_user_id(user_id),
                Episode.embedding.is_not(None),
                distance <= MAX_COSINE_DISTANCE,
            )
            .order_by(distance)
            .limit(limit)
        )
        if not provider_is_local:
            stmt = stmt.where(Episode.sensitivity.notin_(sorted(_LOCAL_ONLY_SENSITIVITIES)))
        current = _as_uuid(exclude_conversation_id)
        if current is not None:
            # The chat in progress is already in the prompt as recent history.
            stmt = stmt.where(Episode.conversation_id != current)

        try:
            result = await self.db.execute(stmt)
            rows = list(result.all())
        except Exception as exc:
            logger.warning("episode recall failed, continuing without it: %s", exc)
            return []

        return [
            RecalledEpisode(
                role=episode.role,
                content=episode.content,
                created_at=episode.created_at,
                distance=float(row_distance),
            )
            for episode, row_distance in rows
        ]


def _as_uuid(value: str | None) -> uuid.UUID | None:
    """Conversation ids are real UUIDs; anything else is not worth filtering on."""
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except ValueError:
        return None
