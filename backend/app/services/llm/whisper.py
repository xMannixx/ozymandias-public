"""OpenAI Whisper speech-to-text wrapper."""

from __future__ import annotations

from openai import AsyncOpenAI

from app.config import get_settings


class WhisperSTT:
    """Speech-to-text service backed by OpenAI Whisper."""

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key: str = settings.openai_api_key
        self._model_name: str = settings.whisper_model
        self._client: AsyncOpenAI | None = None

    def _get_client(self) -> AsyncOpenAI:
        if self._client is None:
            self._client = AsyncOpenAI(api_key=self._api_key)
        return self._client

    async def transcribe(
        self,
        audio_bytes: bytes,
        *,
        language: str = "de",
        filename: str = "audio.webm",
        content_type: str = "audio/webm",
    ) -> str:
        transcription = await self._get_client().audio.transcriptions.create(
            model=self._model_name,
            file=(filename, audio_bytes, content_type),
            language=language,
        )
        text = getattr(transcription, "text", "")
        return str(text)
