"""Tests for local sensitivity pre-classifier."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.schemas import Channel, Sensitivity
from app.services.llm.sensitivity_classifier import classify_sensitivity


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
    monkeypatch.setattr(
        "app.services.llm.sensitivity_classifier.get_settings",
        lambda: SimpleNamespace(
            ollama_base_url="http://localhost:11434",
            ollama_model="llama3.1:8b",
        ),
    )

    class _FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {"message": {"content": "S4"}}

    class _FakeAsyncClient:
        async def __aenter__(self) -> _FakeAsyncClient:
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:  # type: ignore[no-untyped-def]
            del exc_type, exc, tb

        async def post(self, url: str, *, json: dict[str, object]) -> _FakeResponse:
            assert url == "http://localhost:11434/api/chat"
            assert json["model"] == "llama3.1:8b"
            return _FakeResponse()

    monkeypatch.setattr(
        "app.services.llm.sensitivity_classifier.httpx.AsyncClient",
        lambda **_: _FakeAsyncClient(),
    )

    value = await classify_sensitivity("ich hatte einen komischen tag", Channel.web)
    assert value.sensitivity is Sensitivity.S4
    assert value.source == "local_llm"
    assert value.local_classifier_available is True


@pytest.mark.asyncio
async def test_classify_sensitivity_uses_ollama_s1_when_no_keyword(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.services.llm.sensitivity_classifier.get_settings",
        lambda: SimpleNamespace(
            ollama_base_url="http://localhost:11434",
            ollama_model="llama3.1:8b",
        ),
    )

    class _FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {"message": {"content": "S1"}}

    class _FakeAsyncClient:
        async def __aenter__(self) -> _FakeAsyncClient:
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:  # type: ignore[no-untyped-def]
            del exc_type, exc, tb

        async def post(self, _url: str, *, json: dict[str, object]) -> _FakeResponse:
            assert json["model"] == "llama3.1:8b"
            return _FakeResponse()

    monkeypatch.setattr(
        "app.services.llm.sensitivity_classifier.httpx.AsyncClient",
        lambda **_: _FakeAsyncClient(),
    )

    value = await classify_sensitivity("heute war mein tag okay", Channel.web)
    assert value.sensitivity is Sensitivity.S1
    assert value.source == "local_llm"
    assert value.local_classifier_available is True


@pytest.mark.asyncio
async def test_classify_sensitivity_degrades_when_ollama_unreachable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.services.llm.sensitivity_classifier.get_settings",
        lambda: SimpleNamespace(
            ollama_base_url="http://localhost:11434",
            ollama_model="llama3.1:8b",
        ),
    )

    class _FakeAsyncClient:
        async def __aenter__(self) -> _FakeAsyncClient:
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:  # type: ignore[no-untyped-def]
            del exc_type, exc, tb

        async def post(self, _url: str, *, json: dict[str, object]) -> object:
            del json
            raise RuntimeError("connection refused")

    monkeypatch.setattr(
        "app.services.llm.sensitivity_classifier.httpx.AsyncClient",
        lambda **_: _FakeAsyncClient(),
    )

    value = await classify_sensitivity("nichts spezielles", Channel.web)
    assert value.sensitivity is Sensitivity.S1
    assert value.source == "degraded"
    assert value.local_classifier_available is False


@pytest.mark.asyncio
async def test_classify_sensitivity_degrades_on_unparseable_ollama_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.services.llm.sensitivity_classifier.get_settings",
        lambda: SimpleNamespace(
            ollama_base_url="http://localhost:11434",
            ollama_model="llama3.1:8b",
        ),
    )

    class _FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {"message": {"content": "ich weiss es nicht"}}

    class _FakeAsyncClient:
        async def __aenter__(self) -> _FakeAsyncClient:
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:  # type: ignore[no-untyped-def]
            del exc_type, exc, tb

        async def post(self, _url: str, *, json: dict[str, object]) -> _FakeResponse:
            del json
            return _FakeResponse()

    monkeypatch.setattr(
        "app.services.llm.sensitivity_classifier.httpx.AsyncClient",
        lambda **_: _FakeAsyncClient(),
    )

    value = await classify_sensitivity("nichts spezielles", Channel.web)
    assert value.sensitivity is Sensitivity.S1
    assert value.source == "degraded"
    assert value.local_classifier_available is True
