"""Factory that returns the configured SpeechToTextProvider.

The controller depends only on `SpeechToTextProvider` via this factory.
Swap providers by changing the `SPEECH_TO_TEXT_PROVIDER` env var and adding
a new implementation here — no controller changes required.
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache

from .base import ProviderConfigurationError, SpeechToTextProvider

logger = logging.getLogger(__name__)

_REGISTRY = {
    # alias -> import path of a zero-arg class
    "gemini": "services.speech_to_text.gemini_provider.GeminiSpeechToTextProvider",
    "google": "services.speech_to_text.gemini_provider.GeminiSpeechToTextProvider",
    "gemini_whisper": "services.speech_to_text.gemini_provider.GeminiSpeechToTextProvider",
    "openai_whisper": "services.speech_to_text.openai_whisper_provider.OpenAIWhisperProvider",
    "whisper": "services.speech_to_text.openai_whisper_provider.OpenAIWhisperProvider",
    "openai": "services.speech_to_text.openai_whisper_provider.OpenAIWhisperProvider",
}


def _load_class(dotted: str):
    module_path, _, class_name = dotted.rpartition(".")
    module = __import__(module_path, fromlist=[class_name])
    return getattr(module, class_name)


@lru_cache(maxsize=1)
def get_speech_to_text_provider() -> SpeechToTextProvider:
    """Return the singleton SpeechToTextProvider configured via env."""
    raw = (os.environ.get("SPEECH_TO_TEXT_PROVIDER") or "openai_whisper").strip().lower()
    if raw not in _REGISTRY:
        raise ProviderConfigurationError(
            f"Unknown SPEECH_TO_TEXT_PROVIDER='{raw}'. "
            f"Supported: {sorted(set(_REGISTRY))}."
        )
    cls = _load_class(_REGISTRY[raw])
    provider = cls()
    logger.info("Speech-to-Text provider initialised: %s", provider.name)
    return provider


def reset_speech_to_text_provider_cache() -> None:
    """Test/dev helper: clear the cached provider so env changes take effect."""
    get_speech_to_text_provider.cache_clear()
