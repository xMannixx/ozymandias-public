"""Extended health endpoint tests."""

from __future__ import annotations

import pytest
from _pytest.monkeypatch import MonkeyPatch
from httpx import AsyncClient

from app.auth.jwt import create_access_token
from app.config import get_settings


class _RouterStub:
    def __init__(self, providers: list[str]) -> None:
        self.available_providers = providers

    def get_model_name(self, name: str) -> str:
        return f"{name}-model"


def _stored_keys(monkeypatch: MonkeyPatch, **keys: str) -> dict[str, str]:
    """Give the request a user whose settings hold these API keys."""

    class _SettingsStub:
        def __init__(self) -> None:
            for field, value in keys.items():
                setattr(self, f"{field}_api_key", value)

        def __getattr__(self, _name: str) -> None:
            return None

    class _SettingsServiceStub:
        def __init__(self, _db: object) -> None:
            pass

        async def get_or_create(self, _user_id: str) -> _SettingsStub:
            return _SettingsStub()

    monkeypatch.setattr("app.services.settings_service.SettingsService", _SettingsServiceStub)
    token = create_access_token("9f1c7a52-0000-4000-8000-00000000beef")
    return {"Authorization": f"Bearer {token}"}


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

    response = await client.get("/health", headers=_stored_keys(monkeypatch, deepseek="dsk"))
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
async def test_health_counts_a_provider_whose_key_lives_in_user_settings(
    client: AsyncClient, monkeypatch: MonkeyPatch
) -> None:
    """Keys are normally saved in the UI, not the environment.

    Reporting only what the router picked up from .env would leave a provider
    unselectable right after its key was entered.
    """
    monkeypatch.setattr("app.api.health.import_module", lambda _module: object())
    monkeypatch.setattr("app.api.health.get_llm_router", lambda: _RouterStub(["ollama"]))

    async def _probe(_provider_name: str) -> tuple[str, str | None]:
        return "configured", None

    monkeypatch.setattr("app.api.health._get_provider_runtime_status", _probe)

    headers = _stored_keys(monkeypatch, openrouter="sk-or-v1-stored-in-the-database")
    response = await client.get("/health", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert "openrouter" in payload["llm_providers"]
    providers = {entry["name"]: entry for entry in payload["llm_provider_health"]}
    assert providers["openrouter"]["configured"] is True


@pytest.mark.asyncio
async def test_health_drops_a_provider_whose_key_was_removed(
    client: AsyncClient, monkeypatch: MonkeyPatch
) -> None:
    """The router keeps providers a single request registered; health must not.

    Otherwise a deleted key stays "configured" until the process restarts, and
    the UI keeps offering a provider that can no longer authenticate.
    """
    monkeypatch.setattr("app.api.health.import_module", lambda _module: object())
    monkeypatch.setattr(
        "app.api.health.get_llm_router",
        lambda: _RouterStub(["ollama", "openrouter"]),
    )

    async def _probe(_provider_name: str) -> tuple[str, str | None]:
        return "configured", None

    monkeypatch.setattr("app.api.health._get_provider_runtime_status", _probe)

    response = await client.get("/health", headers=_stored_keys(monkeypatch))
    assert response.status_code == 200
    payload = response.json()
    assert "openrouter" not in payload["llm_providers"]


@pytest.mark.asyncio
async def test_health_reports_unusable_bindings_as_the_dev_fallback(
    client: AsyncClient, monkeypatch: MonkeyPatch
) -> None:
    """A wheel built against another Python raises ImportError, not a missing module.

    Reporting that as a 500 hides the one thing the endpoint exists to say.
    """

    def _broken_import(_module: str) -> object:
        raise ImportError("dynamic module does not define module export function")

    settings = get_settings().model_copy(update={"auth_dev_bypass": True})
    monkeypatch.setattr("app.api.health.get_settings", lambda: settings)
    monkeypatch.setattr("app.api.health.import_module", _broken_import)
    monkeypatch.setattr("app.api.health.get_llm_router", lambda: _RouterStub(["ollama"]))

    async def _probe(_provider_name: str) -> tuple[str, str | None]:
        return "ok", None

    monkeypatch.setattr("app.api.health._get_provider_runtime_status", _probe)

    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["rust_bindings"] == "dev-fallback"


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
