"""Tests for Whisper and TTS wrappers."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services.errors import ServiceError
from app.services.llm.tts import OpenAITTS
from app.services.llm.whisper import WhisperSTT


@pytest.mark.asyncio
async def test_whisper_transcribe_returns_text(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.llm.whisper.get_settings",
        lambda: SimpleNamespace(openai_api_key="key", whisper_model="whisper-1"),
    )

    class _FakeClient:
        def __init__(self, **_: object) -> None:
            self.audio = SimpleNamespace(
                transcriptions=SimpleNamespace(create=self._create),
            )

        async def _create(self, **_: object) -> object:
            return SimpleNamespace(text="hallo welt")

    monkeypatch.setattr("app.services.llm.whisper.AsyncOpenAI", _FakeClient)
    service = WhisperSTT()
    assert await service.transcribe(b"audio", language="de") == "hallo welt"


@pytest.mark.asyncio
async def test_whisper_transcribe_propagates_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.llm.whisper.get_settings",
        lambda: SimpleNamespace(openai_api_key="key", whisper_model="whisper-1"),
    )

    class _FakeClient:
        def __init__(self, **_: object) -> None:
            self.audio = SimpleNamespace(
                transcriptions=SimpleNamespace(create=self._create),
            )

        async def _create(self, **_: object) -> object:
            raise RuntimeError("boom")

    monkeypatch.setattr("app.services.llm.whisper.AsyncOpenAI", _FakeClient)
    service = WhisperSTT()
    with pytest.raises(RuntimeError, match="boom"):
        await service.transcribe(b"audio")


@pytest.mark.asyncio
async def test_tts_synthesize_returns_audio_bytes(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.llm.tts.get_settings",
        lambda: SimpleNamespace(openai_api_key="key", tts_model="tts-1", tts_voice="alloy"),
    )

    class _FakeAudioResponse:
        def read(self) -> bytes:
            return b"audio-bytes"

    class _FakeClient:
        def __init__(self, **_: object) -> None:
            self.audio = SimpleNamespace(speech=SimpleNamespace(create=self._create))

        async def _create(self, **_: object) -> _FakeAudioResponse:
            return _FakeAudioResponse()

    monkeypatch.setattr("app.services.llm.tts.AsyncOpenAI", _FakeClient)
    service = OpenAITTS()
    assert await service.synthesize("Hallo") == b"audio-bytes"


@pytest.mark.asyncio
async def test_tts_synthesize_raises_on_non_binary_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.services.llm.tts.get_settings",
        lambda: SimpleNamespace(openai_api_key="key", tts_model="tts-1", tts_voice="alloy"),
    )

    class _FakeAudioResponse:
        def read(self) -> str:
            return "not-bytes"

    class _FakeClient:
        def __init__(self, **_: object) -> None:
            self.audio = SimpleNamespace(speech=SimpleNamespace(create=self._create))

        async def _create(self, **_: object) -> _FakeAudioResponse:
            return _FakeAudioResponse()

    monkeypatch.setattr("app.services.llm.tts.AsyncOpenAI", _FakeClient)
    service = OpenAITTS()
    with pytest.raises(ServiceError, match="non-binary"):
        await service.synthesize("Hallo")
