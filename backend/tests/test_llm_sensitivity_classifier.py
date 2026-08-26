"""Tests for local sensitivity pre-classifier."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from app.schemas import Channel, Sensitivity
from app.services.llm.ollama_catalogue import LocalModel
from app.services.llm.sensitivity_classifier import classify_sensitivity


def _fake_ollama(
    monkeypatch: pytest.MonkeyPatch,
    *,
    answer: object = "S1",
    error: Exception | None = None,
    installed: list[LocalModel] | None = None,
    configured_model: str = "llama3.1:8b",
) -> list[dict[str, Any]]:
    """Answer /api/chat with `answer`, returning the request payloads sent."""
    requests: list[dict[str, Any]] = []

    class _FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> object:
            return answer if isinstance(answer, dict) else {"message": {"content": answer}}

    class _FakeAsyncClient:
        async def __aenter__(self) -> _FakeAsyncClient:
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:  # type: ignore[no-untyped-def]
            del exc_type, exc, tb

        async def post(self, url: str, *, json: dict[str, Any]) -> _FakeResponse:
            requests.append({"url": url, **json})
            if error is not None:
                raise error
            return _FakeResponse()

    async def _installed() -> list[LocalModel]:
        if installed is not None:
            return list(installed)
        return [LocalModel(tag=configured_model, size_bytes=5_000_000_000)]

    monkeypatch.setattr(
        "app.services.llm.sensitivity_classifier.get_settings",
        lambda: SimpleNamespace(
            ollama_base_url="http://localhost:11434",
            ollama_model=configured_model,
        ),
    )
    monkeypatch.setattr("app.services.llm.ollama_catalogue.installed_models", _installed)
    monkeypatch.setattr(
        "app.services.llm.sensitivity_classifier.httpx.AsyncClient",
        lambda **_: _FakeAsyncClient(),
    )
    return requests


@pytest.mark.asyncio
async def test_classify_sensitivity_detects_s4_keyword() -> None:
    value = await classify_sensitivity("ich will ficken", Channel.web)
    assert value.sensitivity is Sensitivity.S4
    assert value.source == "keyword"


@pytest.mark.asyncio
async def test_classify_sensitivity_detects_s3_keyword() -> None:
    value = await classify_sensitivity("mein gehalt ist zu niedrig", Channel.web)
    assert value.sensitivity is Sensitivity.S3
    assert value.source == "keyword"


@pytest.mark.asyncio
async def test_classify_sensitivity_uses_ollama_s4_when_no_keyword(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests = _fake_ollama(monkeypatch, answer="S4")

    value = await classify_sensitivity("ich hatte einen komischen tag", Channel.web)
    assert value.sensitivity is Sensitivity.S4
    assert value.source == "local_llm"
    assert value.local_classifier_available is True
    assert requests[0]["url"] == "http://localhost:11434/api/chat"
    assert requests[0]["model"] == "llama3.1:8b"


@pytest.mark.asyncio
async def test_classify_sensitivity_uses_ollama_s1_when_no_keyword(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _fake_ollama(monkeypatch, answer="S1")

    value = await classify_sensitivity("heute war mein tag okay", Channel.web)
    assert value.sensitivity is Sensitivity.S1
    assert value.source == "local_llm"
    assert value.local_classifier_available is True


@pytest.mark.asyncio
async def test_classify_sensitivity_falls_back_to_the_fastest_installed_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """OLLAMA_MODEL is only a guess until someone pulls it.

    Nothing else notices when this classifier fails: it downgrades the message
    to S1, and the reply comes from the cloud as if that had been the plan.
    """
    requests = _fake_ollama(
        monkeypatch,
        answer="S3",
        installed=[
            LocalModel(tag="gemma3:12b", size_bytes=8_150_000_000),
            LocalModel(tag="nemotron-3-nano:4b", size_bytes=2_840_000_000),
        ],
        configured_model="llama3.2",
    )

    value = await classify_sensitivity("was denkst du darueber", Channel.web)
    assert value.sensitivity is Sensitivity.S3
    assert value.source == "local_llm"
    assert requests[0]["model"] == "nemotron-3-nano:4b"


@pytest.mark.asyncio
async def test_classify_sensitivity_keeps_the_model_loaded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Loading the model dominates the request; paying it once is the point."""
    requests = _fake_ollama(monkeypatch, answer="S1")

    await classify_sensitivity("irgendwas alltaegliches", Channel.web)
    assert requests[0]["keep_alive"] == "30m"
    assert requests[0]["options"]["temperature"] == 0


@pytest.mark.asyncio
async def test_classify_sensitivity_asks_reasoning_models_not_to_think(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Thinking spends the token budget and returns an empty answer.

    That is indistinguishable from an outage, so every message would silently
    end up at S1.
    """
    requests = _fake_ollama(monkeypatch, answer="S2")

    value = await classify_sensitivity("was haeltst du von dem plan", Channel.web)
    assert value.sensitivity is Sensitivity.S2
    assert requests[0]["think"] is False


@pytest.mark.asyncio
async def test_classify_sensitivity_degrades_when_no_model_is_installed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests = _fake_ollama(monkeypatch, installed=[])

    value = await classify_sensitivity("nichts spezielles", Channel.web)
    assert value.sensitivity is Sensitivity.S1
    assert value.source == "degraded"
    assert value.local_classifier_available is False
    assert requests == []


@pytest.mark.asyncio
async def test_classify_sensitivity_degrades_when_ollama_unreachable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _fake_ollama(monkeypatch, error=RuntimeError("connection refused"))

    value = await classify_sensitivity("nichts spezielles", Channel.web)
    assert value.sensitivity is Sensitivity.S1
    assert value.source == "degraded"
    assert value.local_classifier_available is False


@pytest.mark.asyncio
async def test_classify_sensitivity_degrades_on_unparseable_ollama_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _fake_ollama(monkeypatch, answer="ich weiss es nicht")

    value = await classify_sensitivity("nichts spezielles", Channel.web)
    assert value.sensitivity is Sensitivity.S1
    assert value.source == "degraded"
    assert value.local_classifier_available is True
