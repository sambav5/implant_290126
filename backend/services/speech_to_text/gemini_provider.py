"""Google Gemini Speech-to-Text provider implementation.

Transcribes audio using Gemini 2.5 Flash / 1.5 Flash multimodal capability.
Requires GEMINI_API_KEY or GOOGLE_API_KEY environment variable.
"""
from __future__ import annotations

import base64
import json
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

# Allowed audio extensions and MIME mapping for Gemini
_MIME_MAP = {
    "webm": "audio/webm",
    "mp3": "audio/mp3",
    "wav": "audio/wav",
    "ogg": "audio/ogg",
    "m4a": "audio/mp4",
    "mp4": "audio/mp4",
}


class GeminiSpeechToTextProvider(SpeechToTextProvider):
    """Google Gemini Speech-to-Text Provider."""

    name = "gemini_speech_to_text"

    def __init__(self) -> None:
        self.api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        self.model = os.environ.get("GEMINI_STT_MODEL", "gemini-2.5-flash")
        
        if not self.api_key or "mock" in str(self.api_key).lower():
            logger.warning("GEMINI_API_KEY / GOOGLE_API_KEY missing or mock. Gemini STT running in mock mode.")
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
            logger.info("[GEMINI MOCK STT] Returning mock voice command transcript")
            return TranscriptionResult(
                transcript="mark current step complete",
                duration_ms=80,
                provider=self.name,
                model=self.model,
            )

        mime_type = content_type or "audio/webm"
        if ";" in mime_type:
            mime_type = mime_type.split(";")[0].strip()

        # Encode audio to Base64 for Gemini inlineData
        b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": b64_audio,
                            }
                        },
                        {
                            "text": "Transcribe this audio recording accurately. Return ONLY the verbatim transcribed text, without any explanations, formatting, or commentary."
                        }
                    ]
                }
            ]
        }

        started = time.perf_counter()
        try:
            res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=20)
            if not res.ok:
                logger.error(f"Gemini STT API error ({res.status_code}): {res.text}")
                raise ProviderUpstreamError(f"Gemini API returned status {res.status_code}")

            data = res.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return TranscriptionResult(transcript="", duration_ms=int((time.perf_counter() - started) * 1000), provider=self.name, model=self.model)

            parts = candidates[0].get("content", {}).get("parts", [])
            transcript = "".join(p.get("text", "") for p in parts).strip()
            duration_ms = int((time.perf_counter() - started) * 1000)

            logger.info("Gemini STT output transcript (%d ms): '%s'", duration_ms, transcript)

            return TranscriptionResult(
                transcript=transcript,
                duration_ms=duration_ms,
                provider=self.name,
                model=self.model,
            )
        except Exception as exc:
            logger.exception("Gemini Speech-To-Text API call failed")
            raise ProviderUpstreamError(f"Gemini STT call failed: {exc}") from exc
