"""Tests for the OpenRouter provider."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from app.services.errors import ServiceError
from app.services.llm.openrouter import OpenRouterProvider


class _FakeResponse:
    def __init__(self, text: str, tokens: int, reasoning: str | None = None) -> None:
        self.choices = [SimpleNamespace(message=SimpleNamespace(content=text, reasoning=reasoning))]
        self.usage = SimpleNamespace(total_tokens=tokens, prompt_tokens=10, completion_tokens=2)

    def model_dump(self) -> dict[str, object]:
        return {"ok": True}


class _FakeClient:
    """Records how it was constructed so header and key handling can be checked."""

    instances: list[_FakeClient] = []
    next_response = _FakeResponse("brokered-answer", 12)

    def __init__(self, **kwargs: Any) -> None:
        self.kwargs = kwargs
        self.requests: list[dict[str, Any]] = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))
        _FakeClient.instances.append(self)

    async def _create(self, **payload: Any) -> _FakeResponse:
        self.requests.append(payload)
        return _FakeClient.next_response


@pytest.fixture(autouse=True)
def _reset_clients() -> None:
    _FakeClient.instances = []
    _FakeClient.next_response = _FakeResponse("brokered-answer", 12)


def _patch(monkeypatch: pytest.MonkeyPatch, *, api_key: str = "or-key") -> None:
    monkeypatch.setattr(
        "app.services.llm.openrouter.get_settings",
        lambda: SimpleNamespace(
            openrouter_api_key=api_key,
            openrouter_base_url="https://openrouter.ai/api/v1",
            openrouter_model="~openai/gpt-mini-latest",
        ),
    )
    monkeypatch.setattr("app.services.llm.openrouter.AsyncOpenAI", _FakeClient)


@pytest.mark.asyncio
async def test_provider_maps_response(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch(monkeypatch)
    provider = OpenRouterProvider()
    result = await provider.chat([{"role": "user", "content": "hello"}])
    assert result.provider == "openrouter"
    assert result.content == "brokered-answer"
    assert result.tokens_used == 12
    assert result.model == "~openai/gpt-mini-latest"


@pytest.mark.asyncio
async def test_requested_model_wins_over_the_default(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch(monkeypatch)
    provider = OpenRouterProvider()
    result = await provider.chat(
        [{"role": "user", "content": "hello"}],
        model="anthropic/claude-sonnet-5",
    )
    assert result.model == "anthropic/claude-sonnet-5"
    assert _FakeClient.instances[0].requests[0]["model"] == "anthropic/claude-sonnet-5"


@pytest.mark.asyncio
async def test_stored_key_overrides_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """A key from user settings must be used instead of the one in .env."""
    _patch(monkeypatch, api_key="env-key")
    provider = OpenRouterProvider()
    await provider.chat([{"role": "user", "content": "hello"}], api_key="settings-key")
    assert _FakeClient.instances[-1].kwargs["api_key"] == "settings-key"


@pytest.mark.asyncio
async def test_attribution_headers_carry_no_content(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch(monkeypatch)
    OpenRouterProvider()
    headers = _FakeClient.instances[0].kwargs["default_headers"]
    assert set(headers) == {"HTTP-Referer", "X-OpenRouter-Title"}
    assert headers["X-OpenRouter-Title"] == "Ozymandias"


@pytest.mark.asyncio
async def test_missing_key_is_a_clear_error(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch(monkeypatch, api_key="")
    provider = OpenRouterProvider()
    with pytest.raises(ServiceError, match="api_key is missing"):
        await provider.chat([{"role": "user", "content": "hello"}])


@pytest.mark.asyncio
async def test_thinking_text_is_kept(monkeypatch: pytest.MonkeyPatch) -> None:
    """OpenRouter calls it `reasoning` where DeepSeek says `reasoning_content`."""
    _patch(monkeypatch)
    _FakeClient.next_response = _FakeResponse("answer", 5, reasoning="step one")
    provider = OpenRouterProvider()
    result = await provider.chat([{"role": "user", "content": "hello"}])
    assert result.reasoning_content == "step one"
