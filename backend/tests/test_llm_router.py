"""Tests for LLM router behavior."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from app.schemas import Sensitivity
from app.services.errors import ServiceError
from app.services.llm.base import LLMMessage, LLMResponse
from app.services.llm.router import LLMRouter


class _FakeProvider:
    def __init__(self, provider_name: str) -> None:
        self.provider_name = provider_name
        self.last_model: str | None = None

    async def chat(
        self,
        messages: list[LLMMessage],
        *,
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
    ) -> LLMResponse:
        del messages, tools
        self.last_model = model
        return LLMResponse(
            content="ok",
            model="fake",
            provider=self.provider_name,
            tokens_used=1,
        )


def _patch_router_dependencies(
    monkeypatch: pytest.MonkeyPatch,
    *,
    deepseek_key: str = "dsk",
    openai_key: str = "oak",
    gemini_key: str = "gak",
    mistral_key: str = "mrk",
    lmstudio_model: str = "",
) -> None:
    monkeypatch.setattr(
        "app.services.llm.router.get_settings",
        lambda: SimpleNamespace(
            deepseek_api_key=deepseek_key,
            openai_api_key=openai_key,
            gemini_api_key=gemini_key,
            mistral_api_key=mistral_key,
            lmstudio_model=lmstudio_model,
        ),
    )
    monkeypatch.setattr(
        "app.services.llm.router.DeepSeekProvider",
        lambda: _FakeProvider("deepseek"),
    )
    monkeypatch.setattr(
        "app.services.llm.router.OpenAIProvider",
        lambda: _FakeProvider("openai"),
    )
    monkeypatch.setattr(
        "app.services.llm.router.GeminiProvider",
        lambda: _FakeProvider("gemini"),
    )
    monkeypatch.setattr(
        "app.services.llm.router.MistralProvider",
        lambda: _FakeProvider("mistral"),
    )
    monkeypatch.setattr(
        "app.services.llm.router.OllamaProvider",
        lambda: _FakeProvider("ollama"),
    )
    monkeypatch.setattr(
        "app.services.llm.router.LMStudioProvider",
        lambda: _FakeProvider("lmstudio"),
    )


def test_router_selects_ollama_for_s4(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    provider = router.select_provider(intent="general_turn", sensitivity=Sensitivity.S4)
    assert isinstance(provider, _FakeProvider)
    assert provider.provider_name == "ollama"


def test_router_selects_ollama_for_s3(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    provider = router.select_provider(intent="general_turn", sensitivity=Sensitivity.S3)
    assert isinstance(provider, _FakeProvider)
    assert provider.provider_name == "ollama"


def test_router_selects_lmstudio_for_s3_preferred_local(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_router_dependencies(monkeypatch, lmstudio_model="qwen-local")
    router = LLMRouter()
    provider = router.select_provider(
        intent="general_turn",
        sensitivity=Sensitivity.S3,
        preferred_local_provider="lmstudio",
    )
    assert isinstance(provider, _FakeProvider)
    assert provider.provider_name == "lmstudio"


def test_router_selects_openai_for_tool_call(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    provider = router.select_provider(intent="tool_call", sensitivity=Sensitivity.S1)
    assert isinstance(provider, _FakeProvider)
    assert provider.provider_name == "openai"


def test_router_selects_gemini_for_creative_intent(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    provider = router.select_provider(intent="creative", sensitivity=Sensitivity.S1)
    assert isinstance(provider, _FakeProvider)
    assert provider.provider_name == "gemini"


def test_router_selects_deepseek_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    provider = router.select_provider(intent="general_turn", sensitivity=Sensitivity.S1)
    assert isinstance(provider, _FakeProvider)
    assert provider.provider_name == "deepseek"


def test_router_selects_gemini_when_preferred_provider_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    provider = router.select_provider(
        intent="general_turn",
        sensitivity=Sensitivity.S1,
        preferred_provider="gemini",
    )
    assert isinstance(provider, _FakeProvider)
    assert provider.provider_name == "gemini"


def test_router_falls_back_when_preferred_provider_not_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_router_dependencies(monkeypatch, gemini_key="")
    router = LLMRouter()
    provider = router.select_provider(
        intent="general_turn",
        sensitivity=Sensitivity.S1,
        preferred_provider="gemini",
    )
    assert isinstance(provider, _FakeProvider)
    assert provider.provider_name == "deepseek"


def test_router_keeps_s4_override_for_claim_extraction(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    provider = router.select_provider(intent="claim_extraction", sensitivity=Sensitivity.S4)
    assert isinstance(provider, _FakeProvider)
    assert provider.provider_name == "ollama"


def test_router_raises_clear_error_when_provider_not_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_router_dependencies(monkeypatch, openai_key="")
    router = LLMRouter()
    with pytest.raises(ServiceError, match="Provider 'openai' not configured"):
        router.select_provider(intent="tool_call", sensitivity=Sensitivity.S1)


def test_router_available_providers_contains_only_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_router_dependencies(monkeypatch, deepseek_key="", gemini_key="", mistral_key="")
    router = LLMRouter()
    assert sorted(router.available_providers) == ["ollama", "openai"]


@pytest.mark.asyncio
async def test_router_s3_uses_preferred_local_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    local_provider = router._providers["ollama"]
    assert isinstance(local_provider, _FakeProvider)

    await router.route(
        intent="general_turn",
        sensitivity=Sensitivity.S3,
        messages=[{"role": "user", "content": "test"}],
        preferred_model="deepseek-chat",
        preferred_local_model="qwen2.5:7b",
    )

    assert local_provider.last_model == "qwen2.5:7b"


@pytest.mark.asyncio
async def test_router_s3_does_not_fallback_to_cloud_model_name(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    local_provider = router._providers["ollama"]
    assert isinstance(local_provider, _FakeProvider)

    await router.route(
        intent="general_turn",
        sensitivity=Sensitivity.S3,
        messages=[{"role": "user", "content": "test"}],
        preferred_model="deepseek-chat",
        preferred_local_model=None,
    )

    assert local_provider.last_model is None


@pytest.mark.asyncio
async def test_router_prefers_local_model_when_local_provider_is_explicitly_selected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    local_provider = router._providers["ollama"]
    assert isinstance(local_provider, _FakeProvider)

    await router.route(
        intent="general_turn",
        sensitivity=Sensitivity.S1,
        messages=[{"role": "user", "content": "test"}],
        preferred_provider="ollama",
        preferred_model="deepseek-chat",
        preferred_local_model="qwen2.5:7b",
    )

    assert local_provider.last_model == "qwen2.5:7b"


def test_router_selects_mistral_when_preferred_provider_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    provider = router.select_provider(
        intent="general_turn",
        sensitivity=Sensitivity.S1,
        preferred_provider="mistral",
    )
    assert isinstance(provider, _FakeProvider)
    assert provider.provider_name == "mistral"

