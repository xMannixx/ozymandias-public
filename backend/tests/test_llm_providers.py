"""Tests for concrete LLM providers."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services.llm.deepseek import DeepSeekProvider
from app.services.llm.gemini import GeminiProvider
from app.services.llm.lmstudio import LMStudioProvider
from app.services.llm.ollama import OllamaProvider
from app.services.llm.openai_provider import OpenAIProvider


class _FakeOpenAIResponse:
    def __init__(self, text: str, tokens: int) -> None:
        self.choices = [SimpleNamespace(message=SimpleNamespace(content=text))]
        self.usage = SimpleNamespace(total_tokens=tokens)

    def model_dump(self) -> dict[str, object]:
        return {"ok": True}


@pytest.mark.asyncio
async def test_deepseek_provider_maps_response(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.llm.deepseek.get_settings",
        lambda: SimpleNamespace(
            deepseek_api_key="key",
            deepseek_base_url="https://api.deepseek.com/v1",
            deepseek_model="deepseek-chat",
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
            return _FakeOpenAIResponse("deepseek-answer", 13)

    monkeypatch.setattr("app.services.llm.deepseek.AsyncOpenAI", _FakeClient)
    provider = DeepSeekProvider()
    result = await provider.chat([{"role": "user", "content": "hello"}])
    assert result.provider == "deepseek"
    assert result.content == "deepseek-answer"
    assert result.tokens_used == 13
    assert result.reasoning_content is None


@pytest.mark.asyncio
async def test_deepseek_provider_maps_reasoning_content(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.llm.deepseek.get_settings",
        lambda: SimpleNamespace(
            deepseek_api_key="key",
            deepseek_base_url="https://api.deepseek.com/v1",
            deepseek_model="deepseek-reasoner",
        ),
    )

    class _FakeOpenAIResponseWithReasoning:
        def __init__(self, text: str, reasoning: str, tokens: int) -> None:
            self.choices = [
                SimpleNamespace(
                    message=SimpleNamespace(content=text, reasoning_content=reasoning),
                )
            ]
            self.usage = SimpleNamespace(total_tokens=tokens)

        def model_dump(self) -> dict[str, object]:
            return {"ok": True}

    class _FakeClient:
        def __init__(self, **_: object) -> None:
            self.chat = SimpleNamespace(
                completions=SimpleNamespace(
                    create=self._create,
                )
            )

        async def _create(self, **_: object) -> _FakeOpenAIResponseWithReasoning:
            return _FakeOpenAIResponseWithReasoning("answer", "think step", 20)

    monkeypatch.setattr("app.services.llm.deepseek.AsyncOpenAI", _FakeClient)
    provider = DeepSeekProvider()
    result = await provider.chat([{"role": "user", "content": "hello"}])
    assert result.content == "answer"
    assert result.reasoning_content == "think step"


@pytest.mark.asyncio
async def test_openai_provider_maps_response(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.llm.openai_provider.get_settings",
        lambda: SimpleNamespace(openai_api_key="key", openai_model="gpt-4o"),
    )

    class _FakeClient:
        def __init__(self, **_: object) -> None:
            self.chat = SimpleNamespace(
                completions=SimpleNamespace(
                    create=self._create,
                )
            )

        async def _create(self, **_: object) -> _FakeOpenAIResponse:
            return _FakeOpenAIResponse("openai-answer", 21)

    monkeypatch.setattr("app.services.llm.openai_provider.AsyncOpenAI", _FakeClient)
    provider = OpenAIProvider()
    result = await provider.chat([{"role": "user", "content": "hello"}], tools=[])
    assert result.provider == "openai"
    assert result.content == "openai-answer"
    assert result.tokens_used == 21


@pytest.mark.asyncio
async def test_gemini_provider_maps_response(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.llm.gemini.get_settings",
        lambda: SimpleNamespace(gemini_api_key="key", gemini_model="gemini-2.0-flash"),
    )

    class _FakeGeminiResponse:
        text = "gemini-answer"
        usage_metadata = SimpleNamespace(total_token_count=9)

        def model_dump(self) -> dict[str, object]:
            return {"ok": True}

    class _FakeGeminiClient:
        def __init__(self, **_: object) -> None:
            self.aio = SimpleNamespace(
                models=SimpleNamespace(generate_content=self._generate_content)
            )

        async def _generate_content(self, **_: object) -> _FakeGeminiResponse:
            return _FakeGeminiResponse()

    monkeypatch.setattr("app.services.llm.gemini.genai.Client", _FakeGeminiClient)
    provider = GeminiProvider()
    result = await provider.chat([{"role": "user", "content": "hello"}])
    assert result.provider == "gemini"
    assert result.content == "gemini-answer"
    assert result.tokens_used == 9


@pytest.mark.asyncio
async def test_ollama_provider_maps_response(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.llm.ollama.get_settings",
        lambda: SimpleNamespace(ollama_base_url="http://localhost:11434", ollama_model="llama3"),
    )

    class _FakeOllamaClient:
        def __init__(self, **_: object) -> None:
            pass

        async def chat(self, **_: object) -> dict[str, object]:
            return {
                "message": {"content": "ollama-answer"},
                "prompt_eval_count": 3,
                "eval_count": 7,
            }

    monkeypatch.setattr("app.services.llm.ollama.AsyncClient", _FakeOllamaClient)
    provider = OllamaProvider()
    result = await provider.chat([{"role": "user", "content": "hello"}])
    assert result.provider == "ollama"
    assert result.content == "ollama-answer"
    assert result.tokens_used == 10


@pytest.mark.asyncio
async def test_ollama_provider_retries_default_model_when_override_not_found(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.services.llm.ollama.get_settings",
        lambda: SimpleNamespace(ollama_base_url="http://localhost:11434", ollama_model="llama3"),
    )
    attempted_models: list[str] = []

    class _FakeOllamaClient:
        def __init__(self, **_: object) -> None:
            pass

        async def chat(self, **kwargs: object) -> dict[str, object]:
            model = str(kwargs["model"])
            attempted_models.append(model)
            if model == "deepseek-chat":
                raise RuntimeError("model 'deepseek-chat' not found")
            return {
                "message": {"content": "ollama-fallback-answer"},
                "prompt_eval_count": 2,
                "eval_count": 5,
            }

    monkeypatch.setattr("app.services.llm.ollama.AsyncClient", _FakeOllamaClient)
    provider = OllamaProvider()
    result = await provider.chat(
        [{"role": "user", "content": "hello"}],
        model="deepseek-chat",
    )
    assert attempted_models == ["deepseek-chat", "llama3"]
    assert result.provider == "ollama"
    assert result.model == "llama3"
    assert result.content == "ollama-fallback-answer"


@pytest.mark.asyncio
async def test_lmstudio_provider_maps_response(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.llm.lmstudio.get_settings",
        lambda: SimpleNamespace(
            lmstudio_base_url="http://localhost:1234/v1",
            lmstudio_model="qwen-local",
        ),
    )
    captured_kwargs: dict[str, object] = {}

    class _FakeClient:
        def __init__(self, **kwargs: object) -> None:
            captured_kwargs.update(kwargs)
            self.chat = SimpleNamespace(
                completions=SimpleNamespace(
                    create=self._create,
                )
            )

        async def _create(self, **_: object) -> _FakeOpenAIResponse:
            return _FakeOpenAIResponse("lmstudio-answer", 17)

    monkeypatch.setattr("app.services.llm.lmstudio.AsyncOpenAI", _FakeClient)
    provider = LMStudioProvider()
    result = await provider.chat([{"role": "user", "content": "hello"}])
    assert result.provider == "lmstudio"
    assert result.content == "lmstudio-answer"
    assert result.tokens_used == 17
    assert captured_kwargs["api_key"] == "lm-studio"
    assert captured_kwargs["base_url"] == "http://localhost:1234/v1"


@pytest.mark.asyncio
async def test_lmstudio_provider_propagates_connection_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.services.llm.lmstudio.get_settings",
        lambda: SimpleNamespace(
            lmstudio_base_url="http://localhost:1234/v1",
            lmstudio_model="qwen-local",
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
            raise RuntimeError("lmstudio unreachable")

    monkeypatch.setattr("app.services.llm.lmstudio.AsyncOpenAI", _FakeClient)
    provider = LMStudioProvider()
    with pytest.raises(RuntimeError, match="unreachable"):
        await provider.chat([{"role": "user", "content": "hello"}])
