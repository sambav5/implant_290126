"""Factory returning the configured IntentEngine.

The controller depends only on `IntentEngine` via this factory. Swap engines
by changing INTENT_ENGINE env var and adding a new implementation here — no
controller changes required.
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache

from .base import IntentEngine, IntentEngineConfigurationError

logger = logging.getLogger(__name__)

_REGISTRY = {
    "gemini": "services.intent_engine.gemini_intent_engine.GeminiIntentEngine",
    "google": "services.intent_engine.gemini_intent_engine.GeminiIntentEngine",
    "gemini_intent_engine": "services.intent_engine.gemini_intent_engine.GeminiIntentEngine",
    "openai": "services.intent_engine.openai_intent_engine.OpenAIIntentEngine",
    "openai_intent_engine": "services.intent_engine.openai_intent_engine.OpenAIIntentEngine",
    "gpt": "services.intent_engine.openai_intent_engine.OpenAIIntentEngine",
}


def _load_class(dotted: str):
    module_path, _, class_name = dotted.rpartition(".")
    module = __import__(module_path, fromlist=[class_name])
    return getattr(module, class_name)


@lru_cache(maxsize=1)
def get_intent_engine() -> IntentEngine:
    """Return the singleton IntentEngine configured via env."""
    raw = (os.environ.get("INTENT_ENGINE") or "openai").strip().lower()
    if raw not in _REGISTRY:
        raise IntentEngineConfigurationError(
            f"Unknown INTENT_ENGINE='{raw}'. Supported: {sorted(set(_REGISTRY))}."
        )
    cls = _load_class(_REGISTRY[raw])
    engine = cls()
    logger.info("Intent engine initialised: %s", engine.name)
    return engine


def reset_intent_engine_cache() -> None:
    """Test/dev helper: clear the cached engine so env changes take effect."""
    get_intent_engine.cache_clear()
