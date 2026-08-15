"""Sarvam.ai Speech-to-Text provider implementation.

Transcribes audio using Sarvam's Speech-to-Text model saaras:v3.
Requires SARVAM_API_KEY environment variable.
"""
from __future__ import annotations

import logging
import os
import time
from typing import Optional

import requests

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

class SarvamSpeechToTextProvider(SpeechToTextProvider):
    """Sarvam.ai Speech-to-Text Provider."""

    name = "sarvam_speech_to_text"

    def __init__(self) -> None:
        self.api_key = os.environ.get("SARVAM_API_KEY")
        self.model = os.environ.get("SARVAM_STT_MODEL", "saaras:v3")
        
        if not self.api_key or "mock" in str(self.api_key).lower():
            logger.warning("SARVAM_API_KEY missing or mock. Sarvam STT running in mock mode.")
            self._has_key = False
        else:
            self._has_key = True

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

        if not self._has_key:
            logger.info("[SARVAM MOCK STT] Returning mock voice command transcript")
            return TranscriptionResult(
                transcript="mark current step complete",
                duration_ms=80,
                provider=self.name,
                model=self.model,
            )

        mime_type = content_type or "audio/webm"
        if ";" in mime_type:
            mime_type = mime_type.split(";")[0].strip()

        url = "https://api.sarvam.ai/speech-to-text"
        headers = {
            "api-subscription-key": self.api_key
        }
        
        # Prepare files and data payload
        files = {
            "file": (filename, audio_bytes, mime_type)
        }
        data = {
            "model": self.model
        }

        started = time.perf_counter()
        try:
            # Synchronous post within async wrapper using requests
            res = requests.post(url, headers=headers, files=files, data=data, timeout=20)
            if not res.ok:
                logger.error(f"Sarvam STT API error ({res.status_code}): {res.text}")
                raise ProviderUpstreamError(f"Sarvam API returned status {res.status_code}")

            res_data = res.json()
            transcript = (res_data.get("transcript") or "").strip()
            duration_ms = int((time.perf_counter() - started) * 1000)

            logger.info("Sarvam STT output transcript (%d ms): '%s'", duration_ms, transcript)

            return TranscriptionResult(
                transcript=transcript,
                duration_ms=duration_ms,
                provider=self.name,
                model=self.model,
            )
        except Exception as exc:
            logger.exception("Sarvam Speech-To-Text API call failed")
            raise ProviderUpstreamError(f"Sarvam STT call failed: {exc}") from exc
