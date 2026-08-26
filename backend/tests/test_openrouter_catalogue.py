"""Tests for the cached OpenRouter model catalogue."""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from app.services.llm import openrouter_catalogue


def _entry(slug: str, output: list[str] | None = None) -> dict[str, Any]:
    entry: dict[str, Any] = {"id": slug}
    if output is not None:
        entry["architecture"] = {"output_modalities": output}
    return entry


def _serve(monkeypatch: pytest.MonkeyPatch, payload: Any, calls: list[str]) -> None:
    """Answer the catalogue request from memory and count the round trips."""

    class _Response:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> Any:
            return payload

    class _Client:
        def __init__(self, **_: Any) -> None:
            pass

        async def __aenter__(self) -> _Client:
            return self

        async def __aexit__(self, *_: object) -> None:
            return None

        async def get(self, url: str) -> _Response:
            calls.append(url)
            return _Response()

    monkeypatch.setattr("app.services.llm.openrouter_catalogue.httpx.AsyncClient", _Client)


@pytest.fixture(autouse=True)
def _clear_cache() -> None:
    openrouter_catalogue.reset_cache()


@pytest.mark.asyncio
async def test_returns_sorted_slugs(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []
    _serve(
        monkeypatch,
        {"data": [_entry("openai/gpt-5.6"), _entry("anthropic/claude-sonnet-5")]},
        calls,
    )
    models = await openrouter_catalogue.list_models()
    assert models == ["anthropic/claude-sonnet-5", "openai/gpt-5.6"]
    assert calls == ["https://openrouter.ai/api/v1/models"]


@pytest.mark.asyncio
async def test_image_generators_are_left_out(monkeypatch: pytest.MonkeyPatch) -> None:
    """The chat pipeline needs text back, so output-only-image models are useless."""
    calls: list[str] = []
    _serve(
        monkeypatch,
        {
            "data": [
                _entry("openai/gpt-5.6", ["text"]),
                _entry("google/imagen-4", ["image"]),
                _entry("openai/omni", ["text", "image"]),
            ]
        },
        calls,
    )
    models = await openrouter_catalogue.list_models()
    assert models == ["openai/gpt-5.6", "openai/omni"]


@pytest.mark.asyncio
async def test_second_call_is_served_from_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []
    _serve(monkeypatch, {"data": [_entry("openai/gpt-5.6")]}, calls)
    await openrouter_catalogue.list_models()
    await openrouter_catalogue.list_models()
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_cache_expires(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []
    _serve(monkeypatch, {"data": [_entry("openai/gpt-5.6")]}, calls)
    clock = [1000.0]
    monkeypatch.setattr("app.services.llm.openrouter_catalogue.time.monotonic", lambda: clock[0])
    await openrouter_catalogue.list_models()
    clock[0] += openrouter_catalogue.CACHE_TTL_SECONDS + 1
    await openrouter_catalogue.list_models()
    assert len(calls) == 2


@pytest.mark.asyncio
async def test_unreachable_openrouter_yields_the_fallback_list(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _Client:
        def __init__(self, **_: Any) -> None:
            pass

        async def __aenter__(self) -> _Client:
            return self

        async def __aexit__(self, *_: object) -> None:
            return None

        async def get(self, url: str) -> None:
            raise httpx.ConnectError("nope")

    monkeypatch.setattr("app.services.llm.openrouter_catalogue.httpx.AsyncClient", _Client)
    models = await openrouter_catalogue.list_models()
    assert models == list(openrouter_catalogue.FALLBACK_MODELS)


@pytest.mark.asyncio
async def test_an_outage_keeps_serving_the_last_good_list(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []
    _serve(monkeypatch, {"data": [_entry("openai/gpt-5.6")]}, calls)
    clock = [1000.0]
    monkeypatch.setattr("app.services.llm.openrouter_catalogue.time.monotonic", lambda: clock[0])
    await openrouter_catalogue.list_models()

    class _BrokenClient:
        def __init__(self, **_: Any) -> None:
            pass

        async def __aenter__(self) -> _BrokenClient:
            return self

        async def __aexit__(self, *_: object) -> None:
            return None

        async def get(self, url: str) -> None:
            raise httpx.ConnectError("nope")

    monkeypatch.setattr("app.services.llm.openrouter_catalogue.httpx.AsyncClient", _BrokenClient)
    clock[0] += openrouter_catalogue.CACHE_TTL_SECONDS + 1
    assert await openrouter_catalogue.list_models() == ["openai/gpt-5.6"]


@pytest.mark.asyncio
async def test_unexpected_payload_does_not_empty_the_dropdown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []
    _serve(monkeypatch, {"models": ["not", "the", "documented", "shape"]}, calls)
    assert await openrouter_catalogue.list_models() == list(openrouter_catalogue.FALLBACK_MODELS)


@pytest.mark.asyncio
async def test_entries_without_an_id_are_skipped(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []
    _serve(monkeypatch, {"data": [_entry("openai/gpt-5.6"), {"name": "no slug"}, 42]}, calls)
    assert await openrouter_catalogue.list_models() == ["openai/gpt-5.6"]
