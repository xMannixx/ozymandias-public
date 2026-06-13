"""OpenAI text-to-speech wrapper."""

from __future__ import annotations

import inspect

from openai import AsyncOpenAI

from app.config import get_settings
from app.services.errors import ServiceError


class OpenAITTS:
    """Text-to-speech service backed by OpenAI."""

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key: str = settings.openai_api_key
        self._model_name: str = settings.tts_model
        self._voice: str = settings.tts_voice
        self._client: AsyncOpenAI | None = None

    def _get_client(self) -> AsyncOpenAI:
        if self._client is None:
            self._client = AsyncOpenAI(api_key=self._api_key)
        return self._client

    async def synthesize(
        self,
        text: str,
        *,
        voice: str | None = None,
        model: str | None = None,
    ) -> bytes:
        response = await self._get_client().audio.speech.create(
            model=model or self._model_name,
            voice=voice or self._voice,
            input=text,
            response_format="mp3",
        )
        if hasattr(response, "read"):
            result = response.read()
            if inspect.isawaitable(result):
                result = await result
            if isinstance(result, bytes):
                return result
        content = getattr(response, "content", None)
        if isinstance(content, bytes):
            return content
        if isinstance(response, (bytes, bytearray)):
            return bytes(response)
        raise ServiceError("TTS provider returned non-binary response")
