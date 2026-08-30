"""Tests for the installed local model catalogue."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from app.services.errors import ServiceError
from app.services.llm import ollama_catalogue


@pytest.fixture(autouse=True)
def _clean_cache() -> Any:
    ollama_catalogue.reset_cache()
    yield
    ollama_catalogue.reset_cache()


def _tags_payload(*entries: dict[str, Any]) -> dict[str, Any]:
    return {"models": list(entries)}


def _install(
    monkeypatch: pytest.MonkeyPatch,
    payload: Any,
    *,
    calls: list[str] | None = None,
) -> None:
    """Answer the Ollama tag endpoint with `payload`."""

    class _FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> Any:
            return payload

    class _FakeAsyncClient:
        async def __aenter__(self) -> _FakeAsyncClient:
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:  # type: ignore[no-untyped-def]
            del exc_type, exc, tb

        async def get(self, url: str) -> _FakeResponse:
            if calls is not None:
                calls.append(url)
            return _FakeResponse()

    monkeypatch.setattr(
        "app.services.llm.ollama_catalogue.get_settings",
        lambda: SimpleNamespace(ollama_base_url="http://localhost:11434"),
    )
    monkeypatch.setattr(
        "app.services.llm.ollama_catalogue.httpx.AsyncClient",
        lambda **_: _FakeAsyncClient(),
    )


@pytest.mark.asyncio
async def test_returns_installed_tags_sorted(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []
    _install(
        monkeypatch,
        _tags_payload({"model": "qwen3:14b"}, {"name": "gemma3:12b"}),
        calls=calls,
    )

    assert await ollama_catalogue.chat_models() == ["gemma3:12b", "qwen3:14b"]
    assert calls == ["http://localhost:11434/api/tags"]


@pytest.mark.asyncio
async def test_skips_embedding_models(monkeypatch: pytest.MonkeyPatch) -> None:
    """An embedding model cannot answer a turn, and Ollama lists it anyway.

    nomic-embed-text sorts first, so picking it as a chat fallback breaks every
    local turn.
    """
    _install(
        monkeypatch,
        _tags_payload(
            {"model": "nomic-embed-text:latest", "details": {"family": "nomic-bert"}},
            {"model": "all-minilm:latest", "details": {"family": "bert"}},
            {"model": "gemma3:12b", "details": {"family": "gemma3"}},
        ),
    )

    assert await ollama_catalogue.chat_models() == ["gemma3:12b"]


@pytest.mark.asyncio
async def test_skips_embedding_models_named_without_a_known_family(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install(
        monkeypatch,
        _tags_payload(
            {"model": "mxbai-embed-large:latest", "details": {"family": "something-new"}},
            {"model": "qwen3:8b", "details": {"families": ["qwen3"]}},
        ),
    )

    assert await ollama_catalogue.chat_models() == ["qwen3:8b"]


@pytest.mark.asyncio
async def test_second_call_is_served_from_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []
    _install(monkeypatch, _tags_payload({"model": "gemma3:12b"}), calls=calls)

    await ollama_catalogue.chat_models()
    await ollama_catalogue.chat_models()

    assert len(calls) == 1


@pytest.mark.asyncio
async def test_cache_expires(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []
    _install(monkeypatch, _tags_payload({"model": "gemma3:12b"}), calls=calls)

    await ollama_catalogue.chat_models()
    # Age the entry instead of freezing the clock: monotonic() is shared with
    # the event loop, and faking it breaks unrelated machinery.
    cached = ollama_catalogue._cache
    assert cached is not None
    ollama_catalogue._cache = (cached[0] - ollama_catalogue.CACHE_TTL_SECONDS - 1, cached[1])
    await ollama_catalogue.chat_models()

    assert len(calls) == 2


@pytest.mark.asyncio
async def test_malformed_payload_yields_no_models(monkeypatch: pytest.MonkeyPatch) -> None:
    _install(monkeypatch, {"models": "not-a-list"})

    assert await ollama_catalogue.chat_models() == []


@pytest.mark.asyncio
async def test_resolve_model_prefers_the_first_installed_candidate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install(
        monkeypatch,
        _tags_payload({"model": "gemma3:12b"}, {"model": "qwen3:8b"}),
    )

    resolved = await ollama_catalogue.resolve_model(
        "deepseek-v4-pro",
        "qwen3:8b",
        fallback="largest",
    )
    assert resolved == "qwen3:8b"


@pytest.mark.asyncio
async def test_resolve_model_answers_with_the_largest_installed_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An answer to the user should come from the most capable model there is."""
    _install(
        monkeypatch,
        _tags_payload(
            {"model": "gemma3:12b", "size": 8_150_000_000},
            {"model": "nemotron-3-nano:4b", "size": 2_840_000_000},
        ),
    )

    assert await ollama_catalogue.resolve_model("llama3.2", fallback="largest") == "gemma3:12b"


@pytest.mark.asyncio
async def test_resolve_model_classifies_with_the_smallest_installed_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A one-token classification runs on every message, so speed wins."""
    _install(
        monkeypatch,
        _tags_payload(
            {"model": "gemma3:12b", "size": 8_150_000_000},
            {"model": "nemotron-3-nano:4b", "size": 2_840_000_000},
        ),
    )

    resolved = await ollama_catalogue.resolve_model("llama3.2", fallback="smallest")
    assert resolved == "nemotron-3-nano:4b"


@pytest.mark.asyncio
async def test_resolve_model_reports_a_substitution_once(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """This runs on every message; a line per turn would bury the rest."""
    _install(monkeypatch, _tags_payload({"model": "gemma3:12b"}))

    with caplog.at_level("WARNING"):
        await ollama_catalogue.resolve_model("llama3.2", fallback="largest")
        await ollama_catalogue.resolve_model("llama3.2", fallback="largest")

    substitutions = [record for record in caplog.records if "is installed" in record.getMessage()]
    assert len(substitutions) == 1


@pytest.mark.asyncio
async def test_resolve_model_matches_a_candidate_without_its_tag(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install(monkeypatch, _tags_payload({"model": "llama3.2:latest"}))

    assert await ollama_catalogue.resolve_model("llama3.2", fallback="largest") == "llama3.2:latest"


@pytest.mark.asyncio
async def test_resolve_model_reports_an_empty_runtime(monkeypatch: pytest.MonkeyPatch) -> None:
    _install(monkeypatch, _tags_payload({"model": "nomic-embed-text:latest"}))

    with pytest.raises(ServiceError, match="no chat model installed"):
        await ollama_catalogue.resolve_model("llama3.2", fallback="largest")


@pytest.mark.asyncio
async def test_unreachable_runtime_propagates(monkeypatch: pytest.MonkeyPatch) -> None:
    """Callers must be able to tell an outage apart from an empty model list."""

    class _FakeAsyncClient:
        async def __aenter__(self) -> _FakeAsyncClient:
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:  # type: ignore[no-untyped-def]
            del exc_type, exc, tb

        async def get(self, _url: str) -> object:
            raise RuntimeError("All connection attempts failed")

    monkeypatch.setattr(
        "app.services.llm.ollama_catalogue.get_settings",
        lambda: SimpleNamespace(ollama_base_url="http://localhost:11434"),
    )
    monkeypatch.setattr(
        "app.services.llm.ollama_catalogue.httpx.AsyncClient",
        lambda **_: _FakeAsyncClient(),
    )

    with pytest.raises(RuntimeError, match="All connection attempts failed"):
        await ollama_catalogue.chat_models()
