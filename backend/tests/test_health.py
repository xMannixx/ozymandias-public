"""Health endpoint tests."""

import pytest
from _pytest.monkeypatch import MonkeyPatch
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_ok(client: AsyncClient, monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr("app.api.health.import_module", lambda _module: object())
    monkeypatch.setattr(
        "app.api.health.get_llm_router",
        lambda: type(
            "RouterStub",
            (),
            {
                "available_providers": ["ollama"],
                "get_model_name": lambda self, _name: "llama3.1:8b",
            },
        )(),
    )

    async def _probe(_provider_name: str) -> tuple[str, str | None]:
        return "ok", None

    monkeypatch.setattr("app.api.health._get_provider_runtime_status", _probe)

    response = await client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["database"] == "ok"
    assert payload["redis"] == "ok"
    assert payload["rust_bindings"] == "ok"
    assert payload["llm_providers"] == ["ollama"]
    providers = {entry["name"]: entry for entry in payload["llm_provider_health"]}
    assert providers["ollama"]["status"] == "ok"
    assert providers["ollama"]["configured"] is True
    assert providers["deepseek"]["configured"] is False
    assert payload["live_web"]["connector_status"] in {"configured", "not_configured"}
    assert isinstance(payload["live_web"]["native_provider_candidates"], list)
