"""Speech-to-Text provider abstraction.

Usage:
    from services.speech_to_text import get_speech_to_text_provider
    provider = get_speech_to_text_provider()
    result = await provider.transcribe(audio_bytes, filename=..., content_type=...)
"""
from .base import (
    SpeechToTextProvider,
    TranscriptionResult,
    SpeechToTextError,
    EmptyAudioError,
    AudioTooLargeError,
    UnsupportedAudioFormatError,
    ProviderConfigurationError,
    ProviderTimeoutError,
    ProviderUpstreamError,
)
from .factory import get_speech_to_text_provider

__all__ = [
    "SpeechToTextProvider",
    "TranscriptionResult",
    "SpeechToTextError",
    "EmptyAudioError",
    "AudioTooLargeError",
    "UnsupportedAudioFormatError",
    "ProviderConfigurationError",
    "ProviderTimeoutError",
    "ProviderUpstreamError",
    "get_speech_to_text_provider",
]
