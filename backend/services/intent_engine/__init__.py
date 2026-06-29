"""Intent Engine abstraction.

The controller imports ONLY from this package. Concrete engines live in
sibling modules and implement `IntentEngine`.

Usage:
    from services.intent_engine import (
        get_intent_engine, IntentEngine, IntentResult, IntentKind,
        ProcedureContext,
    )
    engine = get_intent_engine()
    result = await engine.process(transcript, context)
"""
from .base import (
    IntentEngine,
    IntentEngineConfigurationError,
    IntentEngineError,
    IntentEngineTimeoutError,
    IntentEngineUpstreamError,
    IntentKind,
    IntentResult,
    ProcedureContext,
)
from .factory import get_intent_engine, reset_intent_engine_cache

__all__ = [
    "IntentEngine",
    "IntentEngineConfigurationError",
    "IntentEngineError",
    "IntentEngineTimeoutError",
    "IntentEngineUpstreamError",
    "IntentKind",
    "IntentResult",
    "ProcedureContext",
    "get_intent_engine",
    "reset_intent_engine_cache",
]
