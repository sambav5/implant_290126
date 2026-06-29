"""Intent Engine interface, DTOs and exceptions.

Provider-agnostic. Concrete engines (OpenAI, Anthropic, regex fallback, ...)
implement `IntentEngine.process(transcript, context) -> IntentResult`.

The Intent Engine performs PARSING ONLY. It must not touch the database,
the checklist service, or any business state. The transcription endpoint
passes in a minimal `ProcedureContext` derived from the request payload.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


# --------------------------------------------------------------------------- #
# Supported intents (closed set)                                              #
# --------------------------------------------------------------------------- #
class IntentKind(str, Enum):
    UPDATE_CHECKLIST = "UPDATE_CHECKLIST"
    ADD_NOTE = "ADD_NOTE"
    READ_NEXT_STEP = "READ_NEXT_STEP"
    REPEAT_STEP = "REPEAT_STEP"
    FINISH_PROCEDURE = "FINISH_PROCEDURE"
    UNKNOWN = "UNKNOWN"

    @classmethod
    def coerce(cls, raw: Any) -> "IntentKind":
        if isinstance(raw, cls):
            return raw
        if isinstance(raw, str):
            normalised = raw.strip().upper().replace(" ", "_").replace("-", "_")
            for member in cls:
                if member.value == normalised:
                    return member
        return cls.UNKNOWN


# --------------------------------------------------------------------------- #
# DTOs                                                                        #
# --------------------------------------------------------------------------- #
@dataclass
class ProcedureContext:
    """Minimal context passed to the Intent Engine.

    Intentionally NOT a patient record. Only enough for the LLM to map a
    transcript to a checklist item or command.
    """

    procedure_id: str
    procedure_name: Optional[str] = None
    current_step: Optional[str] = None
    pending_items: List[str] = field(default_factory=list)
    completed_items: List[str] = field(default_factory=list)

    def to_prompt_block(self, *, max_items: int = 12) -> str:
        """Render the context as a compact text block for the LLM.

        Items are truncated to `max_items` per list to keep prompts small.
        """
        lines = []
        if self.procedure_name:
            lines.append(f"Procedure: {self.procedure_name}")
        else:
            lines.append(f"Procedure ID: {self.procedure_id}")
        if self.current_step:
            lines.append(f"Current Step: {self.current_step}")
        if self.pending_items:
            lines.append("Pending Items:")
            for item in self.pending_items[:max_items]:
                lines.append(f"- {item}")
        if self.completed_items:
            lines.append("Completed Steps:")
            for item in self.completed_items[:max_items]:
                lines.append(f"- {item}")
        return "\n".join(lines)


@dataclass
class IntentResult:
    """Structured intent payload returned by an Intent Engine.

    `confidence` is always in [0.0, 1.0]. Engines should never throw for
    parsing failures; instead they return `intent=UNKNOWN` with a low score.
    """

    transcript: str
    intent: IntentKind = IntentKind.UNKNOWN
    confidence: float = 0.0
    entity: Optional[str] = None
    parameters: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        # Confidence clamp guarantees the contract no matter where this DTO
        # is constructed.
        try:
            value = float(self.confidence)
        except (TypeError, ValueError):
            value = 0.0
        self.confidence = max(0.0, min(1.0, value))
        if not isinstance(self.intent, IntentKind):
            self.intent = IntentKind.coerce(self.intent)
        if self.parameters is None or not isinstance(self.parameters, dict):
            self.parameters = {}
        if self.entity is not None and not isinstance(self.entity, str):
            self.entity = str(self.entity)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "transcript": self.transcript,
            "intent": self.intent.value,
            "confidence": round(self.confidence, 4),
            "entity": self.entity,
            "parameters": self.parameters,
        }


# --------------------------------------------------------------------------- #
# Exceptions                                                                  #
# --------------------------------------------------------------------------- #
class IntentEngineError(Exception):
    """Base intent engine error."""

    user_message: str = "Intent parsing failed."

    def __init__(self, message: str = "", user_message: Optional[str] = None):
        super().__init__(message or user_message or self.user_message)
        if user_message:
            self.user_message = user_message


class IntentEngineConfigurationError(IntentEngineError):
    user_message = "Intent engine is not configured."


class IntentEngineTimeoutError(IntentEngineError):
    user_message = "Intent parsing timed out."


class IntentEngineUpstreamError(IntentEngineError):
    user_message = "Intent provider is unavailable."


# --------------------------------------------------------------------------- #
# Interface                                                                   #
# --------------------------------------------------------------------------- #
class IntentEngine(ABC):
    """Abstract Intent Engine.

    Implementations are responsible for all provider-specific concerns
    (SDK choice, prompts, response parsing). The controller MUST only
    interact through this interface.
    """

    name: str = "intent_engine"

    @abstractmethod
    async def process(
        self,
        transcript: str,
        context: ProcedureContext,
    ) -> IntentResult:
        """Classify a transcript into a structured intent.

        Implementations MUST NOT raise for parsing/upstream failures —
        return `IntentResult(intent=UNKNOWN, confidence=...)` instead.
        Configuration errors MAY raise `IntentEngineConfigurationError`.
        """
        raise NotImplementedError
