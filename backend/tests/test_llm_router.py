"""Tests for LLM router behavior."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from app.schemas import Sensitivity
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
        api_key: str | None = None,
    ) -> LLMResponse:
        del api_key, messages, tools
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
    anthropic_key: str = "ank",
    lmstudio_model: str = "",
) -> None:
    monkeypatch.setattr(
        "app.services.llm.router.get_settings",
        lambda: SimpleNamespace(
            deepseek_api_key=deepseek_key,
            openai_api_key=openai_key,
            gemini_api_key=gemini_key,
            mistral_api_key=mistral_key,
            anthropic_api_key=anthropic_key,
            lmstudio_model=lmstudio_model,
            auth_dev_bypass=False,
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
        "app.services.llm.router.AnthropicProvider",
        lambda: _FakeProvider("anthropic"),
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


def test_router_selects_mistral_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """Mistral is first in the cloud priority chain for general intents."""
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    provider = router.select_provider(intent="general_turn", sensitivity=Sensitivity.S1)
    assert isinstance(provider, _FakeProvider)
    assert provider.provider_name == "mistral"


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
    """Unconfigured preferences fall through to the next available provider."""
    _patch_router_dependencies(monkeypatch, gemini_key="")
    router = LLMRouter()
    provider = router.select_provider(
        intent="general_turn",
        sensitivity=Sensitivity.S1,
        preferred_provider="gemini",
    )
    assert isinstance(provider, _FakeProvider)
    # Mistral is first in the cloud priority chain.
    assert provider.provider_name == "mistral"


def test_router_keeps_s4_override_for_claim_extraction(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    provider = router.select_provider(intent="claim_extraction", sensitivity=Sensitivity.S4)
    assert isinstance(provider, _FakeProvider)
    assert provider.provider_name == "ollama"


def test_router_falls_back_to_mistral_when_openai_not_configured_for_tool_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When openai is unavailable for tool_call, fallback chain delivers mistral."""
    _patch_router_dependencies(monkeypatch, openai_key="")
    router = LLMRouter()
    provider = router.select_provider(intent="tool_call", sensitivity=Sensitivity.S1)
    assert isinstance(provider, _FakeProvider)
    assert provider.provider_name == "mistral"


def test_router_falls_back_to_ollama_when_no_cloud_provider_available(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Without cloud keys, general traffic still falls back to Ollama."""
    _patch_router_dependencies(
        monkeypatch,
        deepseek_key="",
        openai_key="",
        gemini_key="",
        mistral_key="",
        anthropic_key="",
    )
    router = LLMRouter()
    provider = router.select_provider(intent="general_turn", sensitivity=Sensitivity.S1)
    assert isinstance(provider, _FakeProvider)
    assert provider.provider_name == "ollama"


def test_router_available_providers_contains_only_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_router_dependencies(
        monkeypatch,
        deepseek_key="",
        gemini_key="",
        mistral_key="",
        anthropic_key="",
    )
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


# ---------------------------------------------------------------------------
# Fallback chain tests
# ---------------------------------------------------------------------------


def test_fallback_chain_cloud_priority_order(monkeypatch: pytest.MonkeyPatch) -> None:
    """Chain for S0–S2 general_turn follows Mistral→DeepSeek→OpenAI→Anthropic→Gemini→local."""
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    chain = router._build_fallback_chain(
        intent="general_turn",
        sensitivity=Sensitivity.S1,
        enforce_local=True,
    )
    cloud_part = [p for p in chain if p not in {"ollama", "lmstudio"}]
    assert cloud_part == ["mistral", "deepseek", "openai", "anthropic", "gemini"]


def test_fallback_chain_s4_is_local_only(monkeypatch: pytest.MonkeyPatch) -> None:
    """S4 chain contains only the local provider."""
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    chain = router._build_fallback_chain(
        intent="general_turn",
        sensitivity=Sensitivity.S4,
        enforce_local=True,
    )
    assert chain == ["ollama"]


def test_fallback_chain_s3_is_local_only(monkeypatch: pytest.MonkeyPatch) -> None:
    """S3 with enforce_local chain contains only the local provider."""
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    chain = router._build_fallback_chain(
        intent="general_turn",
        sensitivity=Sensitivity.S3,
        enforce_local=True,
    )
    assert chain == ["ollama"]


def test_fallback_chain_preferred_provider_is_first(monkeypatch: pytest.MonkeyPatch) -> None:
    """User's preferred provider appears at the front of the chain."""
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    chain = router._build_fallback_chain(
        intent="general_turn",
        sensitivity=Sensitivity.S1,
        enforce_local=True,
        preferred_provider="openai",
    )
    assert chain[0] == "openai"


@pytest.mark.asyncio
async def test_route_falls_back_on_transient_error(monkeypatch: pytest.MonkeyPatch) -> None:
    """When the primary provider raises a transient error, route() tries the next one."""
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()

    # Make mistral (first in chain) fail with a transient error.
    mistral_provider = router._providers["mistral"]
    assert isinstance(mistral_provider, _FakeProvider)

    call_count = {"n": 0}

    async def _failing_chat(
        messages: list[LLMMessage],
        *,
        tools: object = None,
        model: object = None,
        api_key: object = None,
    ) -> LLMResponse:
        call_count["n"] += 1
        raise ConnectionError("connection refused")

    mistral_provider.chat = _failing_chat  # type: ignore[method-assign]

    result = await router.route(
        intent="general_turn",
        sensitivity=Sensitivity.S1,
        messages=[{"role": "user", "content": "test"}],
    )
    assert call_count["n"] == 1
    # DeepSeek is next in chain after mistral.
    assert result.provider == "deepseek"


@pytest.mark.asyncio
async def test_route_does_not_fall_back_on_auth_error(monkeypatch: pytest.MonkeyPatch) -> None:
    """Auth errors propagate immediately without trying further providers."""
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()

    mistral_provider = router._providers["mistral"]
    assert isinstance(mistral_provider, _FakeProvider)

    async def _auth_error_chat(
        messages: list[LLMMessage],
        *,
        tools: object = None,
        model: object = None,
        api_key: object = None,
    ) -> LLMResponse:
        raise PermissionError("401 invalid api key")

    mistral_provider.chat = _auth_error_chat  # type: ignore[method-assign]

    with pytest.raises(PermissionError, match="401 invalid api key"):
        await router.route(
            intent="general_turn",
            sensitivity=Sensitivity.S1,
            messages=[{"role": "user", "content": "test"}],
        )


@pytest.mark.asyncio
async def test_route_raises_last_error_when_all_providers_fail(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When all providers in the chain fail, the last exception is raised."""
    _patch_router_dependencies(
        monkeypatch,
        gemini_key="",
        anthropic_key="",
    )
    router = LLMRouter()

    for pname in list(router._providers):
        p = router._providers[pname]
        if isinstance(p, _FakeProvider):

            async def _fail(
                messages: list[LLMMessage],
                *,
                tools: object = None,
                model: object = None,
                api_key: object = None,
                _name: str = pname,
            ) -> LLMResponse:
                raise OSError(f"{_name} unreachable")

            p.chat = _fail  # type: ignore[method-assign]

    with pytest.raises(OSError):
        await router.route(
            intent="general_turn",
            sensitivity=Sensitivity.S1,
            messages=[{"role": "user", "content": "test"}],
        )
