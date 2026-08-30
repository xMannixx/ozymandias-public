"""Tests for concrete LLM providers."""

from __future__ import annotations

from collections.abc import AsyncIterator
from types import SimpleNamespace

import pytest

from app.services.errors import ServiceError
from app.services.llm.anthropic_provider import AnthropicProvider
from app.services.llm.base import LLMResponse, token_detail_from_openai_usage
from app.services.llm.deepseek import DeepSeekProvider
from app.services.llm.gemini import GeminiProvider
from app.services.llm.lmstudio import LMStudioProvider
from app.services.llm.ollama import OllamaProvider
from app.services.llm.ollama_catalogue import LocalModel
from app.services.llm.openai_provider import OpenAIProvider


def _fake_ollama(
    monkeypatch: pytest.MonkeyPatch,
    *,
    installed: list[str],
    configured: str = "llama3",
    tokens: tuple[int, int] = (2, 5),
) -> list[str]:
    """Run OllamaProvider against a fake runtime, returning the models it tried."""
    attempted: list[str] = []
    prompt_tokens, completion_tokens = tokens

    class _FakeOllamaClient:
        def __init__(self, **_: object) -> None:
            pass

        async def chat(self, **kwargs: object) -> object:
            attempted.append(str(kwargs["model"]))
            if kwargs.get("stream"):
                return _stream()
            return {
                "message": {"content": "ollama-answer"},
                "prompt_eval_count": prompt_tokens,
                "eval_count": completion_tokens,
            }

    async def _stream() -> AsyncIterator[dict[str, object]]:
        yield {"message": {"content": "streamed"}}
        yield {
            "message": {"content": ""},
            "done": True,
            "prompt_eval_count": prompt_tokens,
            "eval_count": completion_tokens,
        }

    async def _installed_models() -> list[LocalModel]:
        # Ascending size, so a test expecting the largest model cannot pass by
        # accidentally picking the first entry.
        return [
            LocalModel(tag=tag, size_bytes=(index + 1) * 1_000_000_000)
            for index, tag in enumerate(installed)
        ]

    monkeypatch.setattr(
        "app.services.llm.ollama.get_settings",
        lambda: SimpleNamespace(
            ollama_base_url="http://localhost:11434",
            ollama_model=configured,
        ),
    )
    monkeypatch.setattr("app.services.llm.ollama.AsyncClient", _FakeOllamaClient)
    monkeypatch.setattr("app.services.llm.ollama_catalogue.installed_models", _installed_models)
    return attempted


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
    _fake_ollama(monkeypatch, installed=["llama3"], tokens=(3, 7))
    provider = OllamaProvider()
    result = await provider.chat([{"role": "user", "content": "hello"}])
    assert result.provider == "ollama"
    assert result.content == "ollama-answer"
    assert result.tokens_used == 10


@pytest.mark.asyncio
async def test_ollama_provider_falls_back_to_configured_model_for_a_cloud_override(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A cloud model name reaches Ollama when a user keeps both preferences."""
    attempted = _fake_ollama(monkeypatch, installed=["llama3"])
    provider = OllamaProvider()
    result = await provider.chat(
        [{"role": "user", "content": "hello"}],
        model="deepseek-v4-pro",
    )
    assert attempted == ["llama3"]
    assert result.model == "llama3"


@pytest.mark.asyncio
async def test_ollama_provider_uses_the_largest_installed_model_as_a_substitute(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The configured default is only a guess until someone pulls it.

    Without a substitute every S3/S4 turn fails, and there is no cloud provider
    allowed to take over. This one answers the user, so capability wins.
    """
    attempted = _fake_ollama(monkeypatch, installed=["nemotron-3-nano:4b", "gemma3:12b"])
    result = await OllamaProvider().chat([{"role": "user", "content": "hello"}])
    assert attempted == ["gemma3:12b"]
    assert result.model == "gemma3:12b"


@pytest.mark.asyncio
async def test_ollama_provider_matches_a_configured_model_without_its_tag(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _fake_ollama(monkeypatch, installed=["llama3:latest"])
    result = await OllamaProvider().chat([{"role": "user", "content": "hello"}])
    assert result.model == "llama3:latest"


@pytest.mark.asyncio
async def test_ollama_provider_streaming_also_picks_an_installed_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Chat streams, so a fix that only covers chat() fixes nothing in practice."""
    attempted = _fake_ollama(monkeypatch, installed=["gemma3:12b"])
    provider = OllamaProvider()
    chunks = [item async for item in provider.chat_stream([{"role": "user", "content": "hi"}])]
    assert attempted == ["gemma3:12b"]
    assert chunks[0] == "streamed"
    assert isinstance(chunks[-1], LLMResponse)
    assert chunks[-1].model == "gemma3:12b"


@pytest.mark.asyncio
async def test_ollama_provider_reports_an_empty_runtime(monkeypatch: pytest.MonkeyPatch) -> None:
    _fake_ollama(monkeypatch, installed=[])
    with pytest.raises(ServiceError, match="no chat model installed"):
        await OllamaProvider().chat([{"role": "user", "content": "hello"}])


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


def test_token_detail_reads_openai_cache_details() -> None:
    usage = SimpleNamespace(
        prompt_tokens=1000,
        completion_tokens=200,
        total_tokens=1200,
        prompt_tokens_details=SimpleNamespace(cached_tokens=768),
    )

    detail = token_detail_from_openai_usage(usage)
    assert detail.prompt_tokens == 1000
    assert detail.completion_tokens == 200
    assert detail.cached_prompt_tokens == 768
    assert detail.total_tokens == 1200


def test_token_detail_reads_deepseek_cache_hits() -> None:
    usage = SimpleNamespace(
        prompt_tokens=500,
        completion_tokens=100,
        total_tokens=600,
        prompt_cache_hit_tokens=320,
    )

    assert token_detail_from_openai_usage(usage).cached_prompt_tokens == 320


def test_token_detail_falls_back_to_sum_and_never_exceeds_prompt() -> None:
    usage = {"prompt_tokens": 10, "completion_tokens": 5, "prompt_cache_hit_tokens": 99}

    detail = token_detail_from_openai_usage(usage)
    assert detail.total_tokens == 15
    assert detail.cached_prompt_tokens == 10


def test_token_detail_without_usage_is_zero() -> None:
    detail = token_detail_from_openai_usage(None)
    assert (detail.prompt_tokens, detail.completion_tokens, detail.total_tokens) == (0, 0, 0)


@pytest.mark.asyncio
async def test_openai_provider_reports_token_breakdown(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.llm.openai_provider.get_settings",
        lambda: SimpleNamespace(openai_api_key="key", openai_model="gpt-4o"),
    )

    class _Response:
        def __init__(self) -> None:
            self.choices = [SimpleNamespace(message=SimpleNamespace(content="answer"))]
            self.usage = SimpleNamespace(
                prompt_tokens=800,
                completion_tokens=120,
                total_tokens=920,
                prompt_tokens_details=SimpleNamespace(cached_tokens=640),
            )

        def model_dump(self) -> dict[str, object]:
            return {"ok": True}

    class _FakeClient:
        def __init__(self, **_: object) -> None:
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

        async def _create(self, **_: object) -> _Response:
            return _Response()

    monkeypatch.setattr("app.services.llm.openai_provider.AsyncOpenAI", _FakeClient)
    result = await OpenAIProvider().chat([{"role": "user", "content": "hello"}])
    assert result.tokens_used == 920
    assert result.prompt_tokens == 800
    assert result.completion_tokens == 120
    assert result.cached_prompt_tokens == 640


@pytest.mark.asyncio
async def test_anthropic_provider_folds_cache_reads_into_prompt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.services.llm.anthropic_provider.get_settings",
        lambda: SimpleNamespace(anthropic_api_key="key", anthropic_model="claude-sonnet"),
    )

    class _FakeClient:
        def __init__(self, **_: object) -> None:
            self.messages = SimpleNamespace(create=self._create)

        async def _create(self, **_: object) -> SimpleNamespace:
            return SimpleNamespace(
                content=[SimpleNamespace(text="claude-answer")],
                usage=SimpleNamespace(
                    input_tokens=100,
                    output_tokens=40,
                    cache_read_input_tokens=300,
                ),
            )

    monkeypatch.setattr("app.services.llm.anthropic_provider.AsyncAnthropic", _FakeClient)
    result = await AnthropicProvider().chat([{"role": "user", "content": "hello"}])
    assert result.prompt_tokens == 400
    assert result.cached_prompt_tokens == 300
    assert result.tokens_used == 440


@pytest.mark.asyncio
async def test_gemini_provider_reports_token_breakdown(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.llm.gemini.get_settings",
        lambda: SimpleNamespace(gemini_api_key="key", gemini_model="gemini-2.0-flash"),
    )

    class _FakeGeminiResponse:
        text = "gemini-answer"
        usage_metadata = SimpleNamespace(
            prompt_token_count=70,
            candidates_token_count=30,
            cached_content_token_count=20,
            total_token_count=100,
        )

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
    result = await GeminiProvider().chat([{"role": "user", "content": "hello"}])
    assert result.prompt_tokens == 70
    assert result.completion_tokens == 30
    assert result.cached_prompt_tokens == 20
    assert result.tokens_used == 100


@pytest.mark.asyncio
async def test_ollama_provider_reports_token_breakdown(monkeypatch: pytest.MonkeyPatch) -> None:
    _fake_ollama(monkeypatch, installed=["llama3"], tokens=(33, 11))
    result = await OllamaProvider().chat([{"role": "user", "content": "hello"}])
    assert result.prompt_tokens == 33
    assert result.completion_tokens == 11
    assert result.cached_prompt_tokens == 0
