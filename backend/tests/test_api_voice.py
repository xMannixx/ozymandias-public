"""API tests for voice endpoints."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.auth.jwt import get_current_user
from app.services.errors import ServiceError
from app.services.llm.tts import OpenAITTS
from app.services.llm.whisper import WhisperSTT


@pytest.mark.asyncio
async def test_voice_transcribe_returns_text(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_transcribe(
        self: WhisperSTT,
        audio_bytes: bytes,
        *,
        language: str = "de",
        filename: str = "audio.wav",
        content_type: str = "audio/wav",
    ) -> str:
        del filename, content_type
        assert audio_bytes == b"abc"
        assert language == "de"
        return "Hallo Welt"

    monkeypatch.setattr(WhisperSTT, "transcribe", _fake_transcribe)
    response = await client.post(
        "/voice/stt",
        files={"file": ("sample.wav", b"abc", "audio/wav")},
    )
    assert response.status_code == 200
    assert response.json() == {"text": "Hallo Welt"}


@pytest.mark.asyncio
async def test_voice_transcribe_rejects_empty_upload(client: AsyncClient) -> None:
    response = await client.post(
        "/voice/transcribe",
        files={"file": ("sample.wav", b"", "audio/wav")},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_voice_transcribe_rejects_invalid_mime(client: AsyncClient) -> None:
    response = await client.post(
        "/voice/transcribe",
        files={"file": ("sample.txt", b"abc", "text/plain")},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_voice_transcribe_rejects_large_file(client: AsyncClient) -> None:
    response = await client.post(
        "/voice/transcribe",
        files={"file": ("sample.wav", b"x" * (25 * 1024 * 1024 + 1), "audio/wav")},
    )
    assert response.status_code == 413


@pytest.mark.asyncio
async def test_voice_transcribe_maps_provider_error_to_502(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _boom(self: WhisperSTT, audio_bytes: bytes, **_: object) -> str:
        del audio_bytes
        raise RuntimeError("provider down")

    monkeypatch.setattr(WhisperSTT, "transcribe", _boom)
    response = await client.post(
        "/voice/transcribe",
        files={"file": ("sample.wav", b"abc", "audio/wav")},
    )
    assert response.status_code == 502


@pytest.mark.asyncio
async def test_voice_transcribe_requires_auth(app: FastAPI) -> None:
    app.dependency_overrides.pop(get_current_user, None)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/voice/transcribe",
            files={"file": ("sample.wav", b"abc", "audio/wav")},
        )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_voice_tts_streams_mpeg(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_synthesize(
        self: OpenAITTS,
        text: str,
        *,
        voice: str | None = None,
        model: str | None = None,
    ) -> bytes:
        del self
        assert text == "Hallo"
        assert voice == "ash"
        assert model == "tts-1"
        return b"mp3-bytes"

    monkeypatch.setattr(OpenAITTS, "synthesize", _fake_synthesize)
    response = await client.post(
        "/voice/tts",
        json={"text": "Hallo", "voice": "ash", "model": "tts-1"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("audio/mpeg")
    assert response.content == b"mp3-bytes"


@pytest.mark.asyncio
async def test_voice_tts_rejects_empty_text(client: AsyncClient) -> None:
    response = await client.post("/voice/tts", json={"text": " "})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_voice_tts_rejects_too_long_text(client: AsyncClient) -> None:
    response = await client.post("/voice/tts", json={"text": "x" * 4097})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_voice_tts_rejects_invalid_voice(client: AsyncClient) -> None:
    response = await client.post("/voice/tts", json={"text": "Hallo", "voice": "invalid"})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_voice_tts_requires_auth(app: FastAPI) -> None:
    app.dependency_overrides.pop(get_current_user, None)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post("/voice/tts", json={"text": "Hallo"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_voice_tts_maps_service_error_to_502(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fake_synthesize(
        self: OpenAITTS,
        text: str,
        *,
        voice: str | None = None,
        model: str | None = None,
    ) -> bytes:
        del self, text, voice, model
        raise ServiceError("bad gateway")

    monkeypatch.setattr(OpenAITTS, "synthesize", _fake_synthesize)
    response = await client.post("/voice/tts", json={"text": "Hallo"})
    assert response.status_code == 502


@pytest.mark.asyncio
async def test_voice_voices_list(client: AsyncClient) -> None:
    response = await client.get("/voice/voices")
    assert response.status_code == 200
    payload = response.json()
    assert "voices" in payload
    assert "ash" in payload["voices"]


@pytest.mark.asyncio
async def test_voice_tts_maps_generic_exception_to_502(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fake_synthesize(
        self: OpenAITTS,
        text: str,
        *,
        voice: str | None = None,
        model: str | None = None,
    ) -> bytes:
        del self, text, voice, model
        raise RuntimeError("unexpected failure")

    monkeypatch.setattr(OpenAITTS, "synthesize", _fake_synthesize)
    response = await client.post("/voice/tts", json={"text": "Hallo"})
    assert response.status_code == 502
