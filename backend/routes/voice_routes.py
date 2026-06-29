"""Voice endpoints.

`POST /api/voice/transcribe` accepts a multipart `audio` field, sends it to
the configured `SpeechToTextProvider`, and returns the transcript. The route
only depends on the abstraction — no provider-specific code lives here.

Non-goals (explicitly excluded):
- Persisting audio or transcripts
- Calling LLMs or running checklist logic
"""
from __future__ import annotations

import logging
import time
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from services.speech_to_text import (
    AudioTooLargeError,
    EmptyAudioError,
    ProviderConfigurationError,
    ProviderTimeoutError,
    ProviderUpstreamError,
    SpeechToTextError,
    SpeechToTextProvider,
    UnsupportedAudioFormatError,
    get_speech_to_text_provider,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])


class TranscriptionResponse(BaseModel):
    success: bool
    transcript: str


class TranscriptionErrorResponse(BaseModel):
    success: bool = False
    error: str
    code: str


def _provider_dependency() -> SpeechToTextProvider:
    """FastAPI dependency: yields the configured provider.

    Configuration errors surface as 503 so the client can show a clear message.
    """
    try:
        return get_speech_to_text_provider()
    except ProviderConfigurationError as exc:
        logger.error("Speech-to-Text not configured: %s", exc)
        raise HTTPException(status_code=503, detail=exc.user_message) from exc


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_voice(
    audio: UploadFile = File(..., description="Audio blob (webm/mp3/m4a/wav/...)"),
    provider: SpeechToTextProvider = Depends(_provider_dependency),
) -> TranscriptionResponse:
    """Transcribe an uploaded audio file. Audio is kept in memory only."""
    total_started = time.perf_counter()

    # ---- Read upload into memory (no disk persistence) -----------------
    upload_started = time.perf_counter()
    try:
        audio_bytes = await audio.read()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to read uploaded audio")
        raise HTTPException(status_code=400, detail="Unable to read uploaded audio.") from exc
    upload_ms = int((time.perf_counter() - upload_started) * 1000)

    if not audio_bytes:
        raise HTTPException(status_code=400, detail=EmptyAudioError.user_message)

    filename: str = audio.filename or "audio.webm"
    content_type: Optional[str] = audio.content_type
    size_bytes = len(audio_bytes)

    logger.info(
        "voice.transcribe upload_received provider=%s filename=%s content_type=%s size_bytes=%d upload_ms=%d",
        provider.name,
        filename,
        content_type,
        size_bytes,
        upload_ms,
    )

    # ---- Delegate to provider ------------------------------------------
    stt_started = time.perf_counter()
    try:
        result = await provider.transcribe(
            audio_bytes,
            filename=filename,
            content_type=content_type,
        )
    except EmptyAudioError as exc:
        raise HTTPException(status_code=400, detail=exc.user_message) from exc
    except AudioTooLargeError as exc:
        raise HTTPException(status_code=413, detail=exc.user_message) from exc
    except UnsupportedAudioFormatError as exc:
        raise HTTPException(status_code=415, detail=exc.user_message) from exc
    except ProviderTimeoutError as exc:
        raise HTTPException(status_code=504, detail=exc.user_message) from exc
    except ProviderConfigurationError as exc:
        raise HTTPException(status_code=503, detail=exc.user_message) from exc
    except ProviderUpstreamError as exc:
        raise HTTPException(status_code=502, detail=exc.user_message) from exc
    except SpeechToTextError as exc:
        raise HTTPException(status_code=500, detail=exc.user_message) from exc
    stt_ms = int((time.perf_counter() - stt_started) * 1000)

    transcript = (result.transcript or "").strip()
    total_ms = int((time.perf_counter() - total_started) * 1000)

    logger.info(
        "voice.transcribe completed provider=%s model=%s size_bytes=%d upload_ms=%d stt_ms=%d total_ms=%d transcript_chars=%d",
        result.provider or provider.name,
        result.model,
        size_bytes,
        upload_ms,
        stt_ms,
        total_ms,
        len(transcript),
    )

    # Discard the bytes — we never persist audio or transcripts.
    del audio_bytes

    return TranscriptionResponse(success=True, transcript=transcript)
