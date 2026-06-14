"""Tests for concrete Mistral LLM provider."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services.llm.mistral import MistralProvider


class _FakeOpenAIResponse:
    def __init__(self, text: str, tokens: int) -> None:
        self.choices = [SimpleNamespace(message=SimpleNamespace(content=text))]
        self.usage = SimpleNamespace(total_tokens=tokens)

    def model_dump(self) -> dict[str, object]:
        return {"ok": True}


@pytest.mark.asyncio
async def test_mistral_provider_maps_response(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.llm.mistral.get_settings",
        lambda: SimpleNamespace(
            mistral_api_key="key",
            mistral_base_url="https://api.mistral.ai/v1",
            mistral_model="mistral-large-latest",
        ),
    )

    class _FakeClient:
        def __init__(self, **_: object) -> None:
            self.chat = SimpleNamespace(
                completions=SimpleNamespace(
                    create=self._create,
                )
            )

        async def _create(self, **_: object) -> _FakeOpenAIResponse:
            return _FakeOpenAIResponse("mistral-answer", 42)

    monkeypatch.setattr("app.services.llm.mistral.AsyncOpenAI", _FakeClient)
    provider = MistralProvider()
    result = await provider.chat([{"role": "user", "content": "hello"}])
    assert result.provider == "mistral"
    assert result.content == "mistral-answer"
    assert result.tokens_used == 42
    assert result.model == "mistral-large-latest"
