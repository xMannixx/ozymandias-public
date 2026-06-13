"""Voice endpoints."""

from __future__ import annotations

from io import BytesIO
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from app.auth.jwt import get_current_user
from app.schemas.api_models import VoiceTranscriptionResponse, VoiceTTSRequest, VoiceVoicesResponse
from app.services.errors import ServiceError
from app.services.llm.tts import OpenAITTS
from app.services.llm.whisper import WhisperSTT

router = APIRouter(tags=["voice"])
MAX_STT_FILE_BYTES = 25 * 1024 * 1024
ALLOWED_STT_MIME_TYPES = {"audio/webm", "audio/mp4", "audio/wav", "audio/ogg", "audio/mpeg"}
ALLOWED_TTS_VOICES = [
    "alloy",
    "ash",
    "ballad",
    "coral",
    "echo",
    "fable",
    "nova",
    "onyx",
    "sage",
    "shimmer",
]
ALLOWED_TTS_MODELS = {"tts-1", "tts-1-hd"}


@router.post("/stt", response_model=VoiceTranscriptionResponse)
@router.post("/transcribe", response_model=VoiceTranscriptionResponse)
async def transcribe_voice(
    file: Annotated[UploadFile, File(...)],
    user_id: Annotated[str, Depends(get_current_user)],
) -> VoiceTranscriptionResponse:
    del user_id
    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type not in ALLOWED_STT_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported audio format",
        )
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty audio upload",
        )
    if len(audio_bytes) > MAX_STT_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Audio file too large (max 25MB)",
        )
    transcriber = WhisperSTT()
    try:
        text = await transcriber.transcribe(
            audio_bytes,
            language="de",
            filename=file.filename or "audio.webm",
            content_type=content_type,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Voice transcription provider failed",
        ) from exc
    return VoiceTranscriptionResponse(text=text)


@router.post("/tts")
async def synthesize_voice(
    payload: VoiceTTSRequest,
    user_id: Annotated[str, Depends(get_current_user)],
) -> StreamingResponse:
    del user_id
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Text cannot be empty")
    if len(text) > 4096:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text too long (max 4096)",
        )
    if payload.voice is not None and payload.voice not in ALLOWED_TTS_VOICES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid TTS voice")
    if payload.model is not None and payload.model not in ALLOWED_TTS_MODELS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid TTS model")

    synthesizer = OpenAITTS()
    try:
        audio_bytes = await synthesizer.synthesize(text, voice=payload.voice, model=payload.model)
    except ServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Voice synthesis provider failed",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Voice synthesis provider failed",
        ) from exc
    return StreamingResponse(BytesIO(audio_bytes), media_type="audio/mpeg")


@router.get("/voices", response_model=VoiceVoicesResponse)
async def list_tts_voices(
    user_id: Annotated[str, Depends(get_current_user)],
) -> VoiceVoicesResponse:
    del user_id
    return VoiceVoicesResponse(voices=ALLOWED_TTS_VOICES)
