"""OpenAI Whisper implementation of the SpeechToTextProvider interface.

Provider-specific concerns (SDK choice, API key handling, file-like wrapping,
response parsing, container hints) live ONLY in this module. The route does
not import this file directly — it asks the factory for a provider.
"""
from __future__ import annotations

import asyncio
import io
import logging
import os
import time
from typing import Optional

from .base import (
    AudioTooLargeError,
    EmptyAudioError,
    ProviderConfigurationError,
    ProviderTimeoutError,
    ProviderUpstreamError,
    SpeechToTextProvider,
    TranscriptionResult,
    UnsupportedAudioFormatError,
)

logger = logging.getLogger(__name__)

# Whisper supports these container formats.
_WHISPER_EXTENSIONS = {"mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"}

# Map common MIME types to a filename extension Whisper accepts.
_MIME_TO_EXT = {
    "audio/webm": "webm",
    "audio/ogg": "webm",  # treat webm/opus & ogg/opus the same for Whisper
    "audio/mp4": "mp4",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
}


class _NamedBytesIO(io.BytesIO):
    """BytesIO subclass that carries a `.name` attribute.

    The OpenAI SDK inspects `file.name` to infer the audio format when no
    explicit extension hint is provided.
    """

    def __init__(self, data: bytes, name: str):
        super().__init__(data)
        self.name = name


def _resolve_extension(filename: str, content_type: Optional[str]) -> Optional[str]:
    """Pick a Whisper-friendly extension based on filename / MIME type.

    Returns None when neither filename nor content type clearly indicates an
    audio container we support. The caller turns that into a 415 response.
    """
    # 1) try filename extension
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext in _WHISPER_EXTENSIONS:
            return ext

    # 2) try MIME type mapping
    if content_type:
        primary = content_type.split(";", 1)[0].strip().lower()
        if primary in _MIME_TO_EXT:
            return _MIME_TO_EXT[primary]
        # Generic audio/* from MediaRecorder — assume webm (the browser default).
        if primary.startswith("audio/"):
            return "webm"

    # Not enough signal to call this an audio container we support.
    return None


class OpenAIWhisperProvider(SpeechToTextProvider):
    """Whisper (whisper-1) provider via emergentintegrations.

    Configuration (env vars, read once at construction):
        EMERGENT_LLM_KEY            - universal key (preferred) OR
        OPENAI_API_KEY              - direct OpenAI key
        SPEECH_TO_TEXT_MODEL        - default 'whisper-1'
        SPEECH_TO_TEXT_LANGUAGE     - default 'en'
        SPEECH_TO_TEXT_TIMEOUT_SECONDS - default 30
        SPEECH_TO_TEXT_MAX_BYTES    - default 25_000_000 (Whisper hard limit)
    """

    name = "openai_whisper"

    def __init__(self) -> None:
        api_key = os.environ.get("EMERGENT_LLM_KEY") or os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ProviderConfigurationError(
                "Neither EMERGENT_LLM_KEY nor OPENAI_API_KEY is set."
            )

        try:
            from emergentintegrations.llm.openai import OpenAISpeechToText
        except Exception as exc:  # pragma: no cover - import-time failures
            raise ProviderConfigurationError(
                f"emergentintegrations is not installed correctly: {exc}"
            ) from exc

        self._client = OpenAISpeechToText(api_key=api_key)
        self._model = os.environ.get("SPEECH_TO_TEXT_MODEL", "whisper-1")
        self._language = os.environ.get("SPEECH_TO_TEXT_LANGUAGE") or None
        self._timeout = float(os.environ.get("SPEECH_TO_TEXT_TIMEOUT_SECONDS", "30"))
        self._max_bytes = int(os.environ.get("SPEECH_TO_TEXT_MAX_BYTES", "25000000"))

    async def transcribe(
        self,
        audio_bytes: bytes,
        *,
        filename: str,
        content_type: Optional[str] = None,
        language: Optional[str] = None,
        prompt: Optional[str] = None,
    ) -> TranscriptionResult:
        if not audio_bytes:
            raise EmptyAudioError("Audio payload is empty.")
        size = len(audio_bytes)
        if size > self._max_bytes:
            raise AudioTooLargeError(
                f"Audio size {size} bytes exceeds limit {self._max_bytes}."
            )

        ext = _resolve_extension(filename, content_type)
        if ext is None or ext not in _WHISPER_EXTENSIONS:
            raise UnsupportedAudioFormatError(
                f"Unsupported audio format. Allowed: {sorted(_WHISPER_EXTENSIONS)}."
            )

        # Build an in-memory file-like object so we never touch disk.
        named_file = _NamedBytesIO(audio_bytes, name=f"audio.{ext}")

        kwargs = {
            "file": named_file,
            "model": self._model,
            "response_format": "json",
        }
        effective_language = language or self._language
        if effective_language:
            kwargs["language"] = effective_language
        if prompt:
            kwargs["prompt"] = prompt

        started = time.perf_counter()
        try:
            response = await asyncio.wait_for(
                self._client.transcribe(**kwargs),
                timeout=self._timeout,
            )
        except asyncio.TimeoutError as exc:
            raise ProviderTimeoutError(
                f"Whisper timed out after {self._timeout}s."
            ) from exc
        except ValueError as exc:
            # SDK validation errors — caller likely sent bad audio.
            raise UnsupportedAudioFormatError(str(exc)) from exc
        except Exception as exc:  # noqa: BLE001 - SDK can raise many things
            logger.exception("OpenAI Whisper upstream failure")
            raise ProviderUpstreamError(f"Whisper call failed: {exc}") from exc
        finally:
            try:
                named_file.close()
            except Exception:  # pragma: no cover
                pass

        duration_ms = int((time.perf_counter() - started) * 1000)
        transcript = self._extract_text(response).strip()

        return TranscriptionResult(
            transcript=transcript,
            duration_ms=duration_ms,
            provider=self.name,
            model=self._model,
        )

    # ------------------------------------------------------------------ #
    # Internal helpers                                                    #
    # ------------------------------------------------------------------ #
    @staticmethod
    def _extract_text(response) -> str:
        """Pull the transcript text out of Whisper's response object."""
        if response is None:
            return ""
        # Common: object with .text attribute
        text = getattr(response, "text", None)
        if isinstance(text, str):
            return text
        # Dict-like response
        if isinstance(response, dict):
            return str(response.get("text", ""))
        # Fallback: stringify
        return str(response)
