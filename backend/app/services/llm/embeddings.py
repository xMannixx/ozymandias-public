"""Text embeddings from the local Ollama instance.

Embeddings are computed locally on purpose. Conversation content carries every
sensitivity level, and sending an S3 or S4 message to a hosted embedding API
would leak it just as surely as sending it to a chat model. Locality is the
only reason the whole history may be indexed at all.

Every failure degrades to ``None`` instead of raising: embeddings improve
recall, they are never required for a turn to succeed. A stopped Ollama means
older conversations stay unindexed until it is back, nothing more.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any, cast

from ollama import AsyncClient

from app.config import Settings, get_settings
from app.models.user import EMBEDDING_DIMENSIONS

logger = logging.getLogger(__name__)

#: A single embed call should not hold up a Celery task for minutes.
_TIMEOUT_SECONDS = 60.0


class EmbeddingClient:
    """Turn text into vectors using the configured local model."""

    def __init__(
        self,
        *,
        settings: Settings | None = None,
        client: AsyncClient | None = None,
    ) -> None:
        resolved = settings or get_settings()
        self._model = resolved.embedding_model
        self._client = client or AsyncClient(
            host=resolved.ollama_base_url,
            timeout=_TIMEOUT_SECONDS,
        )

    @property
    def model(self) -> str:
        """Name of the embedding model, for audit entries and diagnostics."""
        return self._model

    async def embed_texts(self, texts: list[str]) -> list[list[float]] | None:
        """Embed every text, or return ``None`` if the batch cannot be trusted.

        A partial result would silently shift vectors onto the wrong rows, so
        anything unexpected — an unreachable host, a short response, a model of
        a different width — discards the whole batch.
        """
        if not texts:
            return []
        try:
            response = await self._client.embed(model=self._model, input=texts)
        except Exception as exc:
            logger.warning("embedding request failed (model=%s): %s", self._model, exc)
            return None

        raw: dict[str, Any]
        if hasattr(response, "model_dump"):
            raw = response.model_dump()
        else:
            raw = cast(dict[str, Any], response)
        vectors = raw.get("embeddings")
        if not isinstance(vectors, list) or len(vectors) != len(texts):
            logger.warning("embedding response did not cover the batch (model=%s)", self._model)
            return None

        result: list[list[float]] = []
        for vector in vectors:
            if not isinstance(vector, list) or len(vector) != EMBEDDING_DIMENSIONS:
                logger.warning(
                    "embedding model %s returned %s dimensions, expected %s",
                    self._model,
                    len(vector) if isinstance(vector, list) else "a non-list",
                    EMBEDDING_DIMENSIONS,
                )
                return None
            result.append([float(value) for value in vector])
        return result

    async def embed_text(self, text: str) -> list[float] | None:
        """Embed one text, or ``None`` when embeddings are unavailable."""
        vectors = await self.embed_texts([text])
        if not vectors:
            return None
        return vectors[0]


@lru_cache(maxsize=1)
def get_embedding_client() -> EmbeddingClient:
    """Return the shared embedding client."""
    return EmbeddingClient()
