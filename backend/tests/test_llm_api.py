"""API tests for LLM management endpoints."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.auth.jwt import get_current_user


class _RouterStub:
    available_providers = ["deepseek", "ollama", "lmstudio"]

    @staticmethod
    def get_model_name(provider_name: str) -> str:
        models = {
            "deepseek": "deepseek-chat",
            "ollama": "llama3.1:8b",
            "lmstudio": "qwen-local",
        }
        return models[provider_name]


@pytest.mark.asyncio
async def test_list_providers_returns_configured_models(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.api.llm.get_llm_router", lambda: _RouterStub())

    response = await client.get("/llm/providers")
    assert response.status_code == 200
    payload = response.json()
    assert payload == [
        {"name": "deepseek", "is_local": False, "current_model": "deepseek-chat"},
        {"name": "ollama", "is_local": True, "current_model": "llama3.1:8b"},
        {"name": "lmstudio", "is_local": True, "current_model": "qwen-local"},
    ]


@pytest.mark.asyncio
async def test_list_ollama_models_returns_model_names(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.api.llm.get_settings",
        lambda: SimpleNamespace(ollama_base_url="http://localhost:11434"),
    )

    class _FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "models": [
                    {"name": "qwen:14b"},
                    {"model": "llama3.1:8b"},
                ]
            }

    class _FakeAsyncClient:
        async def __aenter__(self) -> _FakeAsyncClient:
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:  # type: ignore[no-untyped-def]
            del exc_type, exc, tb

        async def get(self, url: str) -> _FakeResponse:
            assert url == "http://localhost:11434/api/tags"
            return _FakeResponse()

    monkeypatch.setattr("app.api.llm.httpx.AsyncClient", lambda **_: _FakeAsyncClient())

    response = await client.get("/llm/ollama/models")
    assert response.status_code == 200
    assert response.json() == ["qwen:14b", "llama3.1:8b"]


@pytest.mark.asyncio
async def test_list_ollama_models_returns_empty_when_unreachable(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.api.llm.get_settings",
        lambda: SimpleNamespace(ollama_base_url="http://localhost:11434"),
    )

    class _FakeAsyncClient:
        async def __aenter__(self) -> _FakeAsyncClient:
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:  # type: ignore[no-untyped-def]
            del exc_type, exc, tb

        async def get(self, _url: str) -> object:
            raise RuntimeError("connection refused")

    monkeypatch.setattr("app.api.llm.httpx.AsyncClient", lambda **_: _FakeAsyncClient())

    response = await client.get("/llm/ollama/models")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_lmstudio_models_returns_empty_when_unreachable(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.api.llm.get_settings",
        lambda: SimpleNamespace(lmstudio_base_url="http://localhost:1234/v1"),
    )

    class _FakeAsyncClient:
        async def __aenter__(self) -> _FakeAsyncClient:
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:  # type: ignore[no-untyped-def]
            del exc_type, exc, tb

        async def get(self, _url: str) -> object:
            raise RuntimeError("connection refused")

    monkeypatch.setattr("app.api.llm.httpx.AsyncClient", lambda **_: _FakeAsyncClient())

    response = await client.get("/llm/lmstudio/models")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_deepseek_models_returns_the_v4_family(client: AsyncClient) -> None:
    """deepseek-chat and deepseek-reasoner were retired in July 2026."""
    response = await client.get("/llm/deepseek/models")
    assert response.status_code == 200
    assert response.json() == ["deepseek-v4-flash", "deepseek-v4-pro"]


@pytest.mark.asyncio
async def test_list_openrouter_models_returns_the_live_catalogue(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _catalogue() -> list[str]:
        return ["anthropic/claude-sonnet-5", "openai/gpt-5.6"]

    monkeypatch.setattr("app.api.llm.openrouter_catalogue.list_models", _catalogue)

    response = await client.get("/llm/openrouter/models")
    assert response.status_code == 200
    assert response.json() == ["anthropic/claude-sonnet-5", "openai/gpt-5.6"]


@pytest.mark.asyncio
async def test_list_openai_models_returns_static_list(client: AsyncClient) -> None:
    response = await client.get("/llm/openai/models")
    assert response.status_code == 200
    body = response.json()
    assert "gpt-4o" in body
    assert len(body) >= 3


@pytest.mark.asyncio
async def test_list_gemini_models_returns_static_list(client: AsyncClient) -> None:
    response = await client.get("/llm/gemini/models")
    assert response.status_code == 200
    body = response.json()
    assert any(model.startswith("gemini-") for model in body)
    assert len(body) >= 2


@pytest.mark.asyncio
async def test_list_providers_without_auth_returns_401(app: FastAPI) -> None:
    app.dependency_overrides.pop(get_current_user, None)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as unauthorized_client:
        response = await unauthorized_client.get("/llm/providers")
    assert response.status_code == 401
