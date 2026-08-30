"""Tests for the local embedding client."""

from __future__ import annotations

from typing import Any

import pytest

from app.config import Settings
from app.models.user import EMBEDDING_DIMENSIONS
from app.services.llm.embeddings import EmbeddingClient


class _FakeOllama:
    """Records the request and replays a prepared answer."""

    def __init__(self, response: object = None, error: Exception | None = None) -> None:
        self._response = response
        self._error = error
        self.calls: list[dict[str, Any]] = []

    async def embed(self, *, model: str, input: list[str]) -> object:  # noqa: A002 - ollama kwarg
        self.calls.append({"model": model, "input": input})
        if self._error is not None:
            raise self._error
        return self._response


def _client(fake: _FakeOllama) -> EmbeddingClient:
    settings = Settings(embedding_model="test-embed", ollama_base_url="http://localhost:11434")
    return EmbeddingClient(settings=settings, client=fake)  # type: ignore[arg-type]


def _vector(fill: float = 0.1) -> list[float]:
    return [fill] * EMBEDDING_DIMENSIONS


@pytest.mark.asyncio
async def test_embed_texts_returns_one_vector_per_text() -> None:
    fake = _FakeOllama({"embeddings": [_vector(0.1), _vector(0.2)]})

    vectors = await _client(fake).embed_texts(["first", "second"])

    assert vectors is not None
    assert [len(vector) for vector in vectors] == [EMBEDDING_DIMENSIONS, EMBEDDING_DIMENSIONS]
    assert fake.calls == [{"model": "test-embed", "input": ["first", "second"]}]


@pytest.mark.asyncio
async def test_empty_input_never_reaches_ollama() -> None:
    fake = _FakeOllama({"embeddings": []})

    assert await _client(fake).embed_texts([]) == []
    assert fake.calls == []


@pytest.mark.asyncio
async def test_unreachable_ollama_degrades_to_none() -> None:
    """A stopped local model must not take a turn or a job down with it."""
    fake = _FakeOllama(error=ConnectionError("connection refused"))

    assert await _client(fake).embed_texts(["anything"]) is None


@pytest.mark.asyncio
async def test_a_short_response_discards_the_whole_batch() -> None:
    """Fewer vectors than texts would pair vectors with the wrong rows."""
    fake = _FakeOllama({"embeddings": [_vector()]})

    assert await _client(fake).embed_texts(["first", "second"]) is None


@pytest.mark.asyncio
async def test_a_model_of_the_wrong_width_is_rejected() -> None:
    """The column is vector(768); anything else would fail on insert."""
    fake = _FakeOllama({"embeddings": [[0.1] * 1536]})

    assert await _client(fake).embed_texts(["first"]) is None


@pytest.mark.asyncio
async def test_embed_text_unwraps_the_single_vector() -> None:
    fake = _FakeOllama({"embeddings": [_vector(0.5)]})

    vector = await _client(fake).embed_text("hello")

    assert vector == _vector(0.5)


@pytest.mark.asyncio
async def test_embed_text_returns_none_when_embeddings_are_unavailable() -> None:
    fake = _FakeOllama(error=TimeoutError())

    assert await _client(fake).embed_text("hello") is None
