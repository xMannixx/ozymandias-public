"""Tests for LLM router behavior."""

from __future__ import annotations

from collections.abc import AsyncIterator
from types import SimpleNamespace
from typing import Any

import pytest

from app.schemas import Sensitivity
from app.services.llm.base import LLMMessage, LLMResponse, LLMStreamItem
from app.services.llm.router import LLMRouter
from app.services.llm.usage import LLMCallUsage


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
            tokens_used=6,
            prompt_tokens=4,
            completion_tokens=2,
            cached_prompt_tokens=3,
        )

    async def chat_stream(
        self,
        messages: list[LLMMessage],
        *,
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
        api_key: str | None = None,
    ) -> AsyncIterator[LLMStreamItem]:
        response = await self.chat(messages, tools=tools, model=model, api_key=api_key)
        yield "o"
        yield "k"
        yield response


def _patch_router_dependencies(
    monkeypatch: pytest.MonkeyPatch,
    *,
    deepseek_key: str = "dsk",
    openai_key: str = "oak",
    gemini_key: str = "gak",
    mistral_key: str = "mrk",
    anthropic_key: str = "ank",
    openrouter_key: str = "ork",
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
            openrouter_api_key=openrouter_key,
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
        "app.services.llm.router.OpenRouterProvider",
        lambda: _FakeProvider("openrouter"),
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


def test_router_selects_openrouter_when_preferred(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    provider = router.select_provider(
        intent="general_turn",
        sensitivity=Sensitivity.S1,
        preferred_provider="openrouter",
    )
    assert isinstance(provider, _FakeProvider)
    assert provider.provider_name == "openrouter"


def test_openrouter_is_absent_without_a_key(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_router_dependencies(monkeypatch, openrouter_key="")
    router = LLMRouter()
    assert "openrouter" not in router.available_providers


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
        openrouter_key="",
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
        openrouter_key="",
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
    """S0–S2 general_turn: Mistral→DeepSeek→OpenAI→Anthropic→Gemini→OpenRouter→local.

    OpenRouter comes last because it brokers the same labs at a markup.
    """
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    chain = router._build_fallback_chain(
        intent="general_turn",
        sensitivity=Sensitivity.S1,
        enforce_local=True,
    )
    cloud_part = [p for p in chain if p not in {"ollama", "lmstudio"}]
    assert cloud_part == ["mistral", "deepseek", "openai", "anthropic", "gemini", "openrouter"]


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
async def test_route_records_usage_for_the_successful_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    sink: list[LLMCallUsage] = []

    await router.route(
        intent="general_turn",
        sensitivity=Sensitivity.S1,
        messages=[{"role": "user", "content": "test"}],
        usage_sink=sink,
    )

    assert len(sink) == 1
    record = sink[0]
    assert record.call_type == "chat"
    assert record.provider == "mistral"
    assert record.model == "fake"
    assert record.status == "ok"
    assert record.prompt_tokens == 4
    assert record.completion_tokens == 2
    assert record.cached_prompt_tokens == 3
    assert record.total_tokens == 6
    assert record.error_kind is None
    assert record.latency_ms >= 0


@pytest.mark.asyncio
async def test_route_records_failed_attempts_so_the_error_rate_is_honest(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    mistral_provider = router._providers["mistral"]
    assert isinstance(mistral_provider, _FakeProvider)

    async def _failing_chat(
        messages: list[LLMMessage],
        *,
        tools: object = None,
        model: object = None,
        api_key: object = None,
    ) -> LLMResponse:
        raise ConnectionError("connection refused")

    mistral_provider.chat = _failing_chat  # type: ignore[method-assign]
    sink: list[LLMCallUsage] = []

    await router.route(
        intent="general_turn",
        sensitivity=Sensitivity.S1,
        messages=[{"role": "user", "content": "test"}],
        usage_sink=sink,
    )

    assert [(r.provider, r.status) for r in sink] == [
        ("mistral", "error"),
        ("deepseek", "ok"),
    ]
    assert sink[0].error_kind == "ConnectionError"
    assert sink[0].total_tokens == 0


@pytest.mark.asyncio
async def test_route_names_the_requested_tool_in_usage(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    sink: list[LLMCallUsage] = []

    await router.route(
        intent="tool_call",
        sensitivity=Sensitivity.S1,
        messages=[{"role": "user", "content": "test"}],
        tools=[{"type": "web_search_preview"}],
        usage_sink=sink,
    )

    assert sink[0].call_type == "tool_call"
    assert sink[0].tool_name == "web_search_preview"


# ---------------------------------------------------------------------------
# route_stream tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_route_stream_yields_deltas_then_final_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()

    items = [
        item
        async for item in router.route_stream(
            intent="general_turn",
            sensitivity=Sensitivity.S1,
            messages=[{"role": "user", "content": "test"}],
        )
    ]
    assert items[:-1] == ["o", "k"]
    final = items[-1]
    assert isinstance(final, LLMResponse)
    assert final.provider == "mistral"


@pytest.mark.asyncio
async def test_route_stream_records_usage_after_the_final_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()
    sink: list[LLMCallUsage] = []

    async for _ in router.route_stream(
        intent="general_turn",
        sensitivity=Sensitivity.S1,
        messages=[{"role": "user", "content": "test"}],
        usage_sink=sink,
    ):
        pass

    assert len(sink) == 1
    assert sink[0].provider == "mistral"
    assert sink[0].status == "ok"
    assert sink[0].total_tokens == 6


@pytest.mark.asyncio
async def test_route_stream_falls_back_before_first_delta(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A provider failing before emitting tokens is skipped in favor of the next one."""
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()

    mistral_provider = router._providers["mistral"]
    assert isinstance(mistral_provider, _FakeProvider)

    async def _failing_stream(
        messages: list[LLMMessage],
        *,
        tools: object = None,
        model: object = None,
        api_key: object = None,
    ) -> AsyncIterator[LLMStreamItem]:
        raise ConnectionError("connection refused")
        yield ""  # pragma: no cover - makes this an async generator

    mistral_provider.chat_stream = _failing_stream  # type: ignore[method-assign]

    items = [
        item
        async for item in router.route_stream(
            intent="general_turn",
            sensitivity=Sensitivity.S1,
            messages=[{"role": "user", "content": "test"}],
        )
    ]
    final = items[-1]
    assert isinstance(final, LLMResponse)
    assert final.provider == "deepseek"


@pytest.mark.asyncio
async def test_route_stream_does_not_fall_back_after_first_delta(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Once tokens flowed, mid-stream errors terminate the stream instead of retrying."""
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()

    mistral_provider = router._providers["mistral"]
    assert isinstance(mistral_provider, _FakeProvider)

    async def _midstream_failure(
        messages: list[LLMMessage],
        *,
        tools: object = None,
        model: object = None,
        api_key: object = None,
    ) -> AsyncIterator[LLMStreamItem]:
        yield "partial"
        raise ConnectionError("connection reset")

    mistral_provider.chat_stream = _midstream_failure  # type: ignore[method-assign]

    received: list[LLMStreamItem] = []
    with pytest.raises(ConnectionError):
        async for item in router.route_stream(
            intent="general_turn",
            sensitivity=Sensitivity.S1,
            messages=[{"role": "user", "content": "test"}],
        ):
            received.append(item)
    assert received == ["partial"]


@pytest.mark.asyncio
async def test_route_stream_does_not_fall_back_on_auth_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_router_dependencies(monkeypatch)
    router = LLMRouter()

    mistral_provider = router._providers["mistral"]
    assert isinstance(mistral_provider, _FakeProvider)

    async def _auth_error_stream(
        messages: list[LLMMessage],
        *,
        tools: object = None,
        model: object = None,
        api_key: object = None,
    ) -> AsyncIterator[LLMStreamItem]:
        raise PermissionError("401 invalid api key")
        yield ""  # pragma: no cover - makes this an async generator

    mistral_provider.chat_stream = _auth_error_stream  # type: ignore[method-assign]

    with pytest.raises(PermissionError, match="401 invalid api key"):
        async for _item in router.route_stream(
            intent="general_turn",
            sensitivity=Sensitivity.S1,
            messages=[{"role": "user", "content": "test"}],
        ):
            pass


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
