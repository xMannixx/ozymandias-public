"""Extended health endpoint tests."""

from __future__ import annotations

import pytest
from _pytest.monkeypatch import MonkeyPatch
from httpx import AsyncClient


class _RouterStub:
    def __init__(self, providers: list[str]) -> None:
        self.available_providers = providers

    def get_model_name(self, name: str) -> str:
        return f"{name}-model"


@pytest.mark.asyncio
async def test_health_contains_redis_and_llm_providers(
    client: AsyncClient, monkeypatch: MonkeyPatch
) -> None:
    monkeypatch.setattr("app.api.health.import_module", lambda _module: object())
    monkeypatch.setattr(
        "app.api.health.get_llm_router",
        lambda: _RouterStub(["ollama", "deepseek"]),
    )

    async def _probe(provider_name: str) -> tuple[str, str | None]:
        if provider_name == "ollama":
            return "ok", None
        return "configured", None

    monkeypatch.setattr("app.api.health._get_provider_runtime_status", _probe)

    response = await client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["database"] == "ok"
    assert payload["redis"] == "ok"
    assert payload["llm_providers"] == ["ollama", "deepseek"]
    providers = {entry["name"]: entry for entry in payload["llm_provider_health"]}
    assert providers["ollama"]["status"] == "ok"
    assert providers["deepseek"]["status"] == "configured"
    assert providers["openai"]["status"] == "not_configured"
    assert payload["live_web"]["connector_status"] in {"configured", "not_configured"}
    assert payload["live_web"]["native_provider_candidates"] == ["deepseek"]


@pytest.mark.asyncio
async def test_health_reports_redis_ok(client: AsyncClient, monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr("app.api.health.import_module", lambda _module: object())
    monkeypatch.setattr("app.api.health.get_llm_router", lambda: _RouterStub(["ollama"]))

    async def _probe(_provider_name: str) -> tuple[str, str | None]:
        return "ok", None

    monkeypatch.setattr("app.api.health._get_provider_runtime_status", _probe)

    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["redis"] == "ok"
    assert response.json()["live_web"]["connector_status"] in {"configured", "not_configured"}
