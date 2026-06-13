"""Unit tests for live web service orchestration."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.services.live_web_service import LiveWebContext, LiveWebService, LiveWebSource


@pytest.mark.asyncio
async def test_search_returns_none_context_when_mode_off() -> None:
    service = LiveWebService()
    result = await service.search(query="latest news", mode="off")
    assert result.strategy == "none"
    assert result.sources == []


@pytest.mark.asyncio
async def test_search_uses_connector_only_mode() -> None:
    service = LiveWebService()
    connector_sources = [
        LiveWebSource(title="Example", url="https://example.com", snippet="hello"),
    ]
    service._search_with_connector = AsyncMock(return_value=connector_sources)  # type: ignore[method-assign]

    result = await service.search(query="latest news", mode="connector_only")

    assert result.strategy == "connector"
    assert result.sources == connector_sources


@pytest.mark.asyncio
async def test_search_prefers_provider_native_for_provider_native_first() -> None:
    service = LiveWebService()
    native = LiveWebContext(
        strategy="provider_native",
        sources=[LiveWebSource(title="N", url="https://n.example", snippet="n")],
    )
    service._search_with_provider_native = AsyncMock(return_value=native)  # type: ignore[method-assign]
    service._search_with_connector = AsyncMock(return_value=[])  # type: ignore[method-assign]

    result = await service.search(query="latest news", mode="provider_native_first")

    assert result.strategy == "provider_native"
    assert service._search_with_connector.await_count == 0


@pytest.mark.asyncio
async def test_search_falls_back_to_connector_when_native_returns_none() -> None:
    service = LiveWebService()
    service._search_with_provider_native = AsyncMock(return_value=None)  # type: ignore[method-assign]
    connector_sources = [
        LiveWebSource(title="C", url="https://c.example", snippet="c"),
    ]
    service._search_with_connector = AsyncMock(return_value=connector_sources)  # type: ignore[method-assign]

    result = await service.search(query="latest news", mode="provider_native_first")

    assert result.strategy == "connector"
    assert result.sources == connector_sources
