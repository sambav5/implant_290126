"""Speech-to-Text provider interface and shared types.

The API endpoint depends ONLY on these abstractions. Concrete providers
(OpenAI Whisper, Deepgram, Google, Azure, ...) live in sibling modules and
implement `SpeechToTextProvider`.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


# --------------------------------------------------------------------------- #
# Exceptions (provider-agnostic; the route maps these to HTTP responses)      #
# --------------------------------------------------------------------------- #
class SpeechToTextError(Exception):
    """Base error for any Speech-to-Text failure."""

    user_message: str = "Transcription failed. Please try again."

    def __init__(self, message: str = "", user_message: Optional[str] = None):
        super().__init__(message or user_message or self.user_message)
        if user_message:
            self.user_message = user_message


class ProviderConfigurationError(SpeechToTextError):
    user_message = "Voice transcription is not configured on the server."


class EmptyAudioError(SpeechToTextError):
    user_message = "No audio was received. Please try recording again."


class AudioTooLargeError(SpeechToTextError):
    user_message = "Audio is too large. Please record a shorter clip."


class UnsupportedAudioFormatError(SpeechToTextError):
    user_message = "Audio format is not supported."


class ProviderTimeoutError(SpeechToTextError):
    user_message = "Transcription timed out. Please try again."


class ProviderUpstreamError(SpeechToTextError):
    user_message = "Transcription service is temporarily unavailable."


# --------------------------------------------------------------------------- #
# Result DTO                                                                  #
# --------------------------------------------------------------------------- #
@dataclass
class TranscriptionResult:
    """Provider-agnostic transcription result."""

    transcript: str
    # Optional metrics / metadata. Routes/services may log these but the public
    # API contract only exposes `transcript`.
    duration_ms: Optional[int] = None
    provider: Optional[str] = None
    model: Optional[str] = None


# --------------------------------------------------------------------------- #
# Provider interface                                                          #
# --------------------------------------------------------------------------- #
class SpeechToTextProvider(ABC):
    """Abstract Speech-to-Text provider.

    Implementations are responsible for ALL provider-specific concerns
    (auth, SDKs, audio container handling, retries). The controller MUST
    only interact through this interface.
    """

    name: str = "speech_to_text_provider"

    @abstractmethod
    async def transcribe(
        self,
        audio_bytes: bytes,
        *,
        filename: str,
        content_type: Optional[str] = None,
        language: Optional[str] = None,
        prompt: Optional[str] = None,
    ) -> TranscriptionResult:
        """Transcribe an in-memory audio blob and return the transcript.

        Args:
            audio_bytes: Raw audio bytes (in-memory; never persisted).
            filename: Original filename (used by some providers for format hint).
            content_type: MIME type, e.g. 'audio/webm'.
            language: Optional ISO-639-1 code to hint the model.
            prompt: Optional context prompt to steer the model.

        Raises:
            EmptyAudioError, AudioTooLargeError, UnsupportedAudioFormatError,
            ProviderConfigurationError, ProviderTimeoutError,
            ProviderUpstreamError, SpeechToTextError
        """
        raise NotImplementedError
