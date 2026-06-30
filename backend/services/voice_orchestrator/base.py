"""Voice orchestrator interface + DTOs.

The orchestrator is the seam where intent classification (parsing) meets
the domain services (writes). Everything between an IntentResult and the
final HTTP response goes through this layer.

Design rules baked into this interface:
  - The orchestrator NEVER performs DB I/O directly.
  - The orchestrator NEVER trusts client-sent checklist state.
  - The orchestrator NEVER mutates an intent result.
  - The orchestrator MUST gate every write on a confidence threshold.
  - The orchestrator's return value (`ActionResult`) is the source of
    truth for what the controller sends back to the client.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Optional

from services.intent_engine import IntentResult


class ActionStatus(str, Enum):
    EXECUTED = "executed"
    REQUIRES_CONFIRMATION = "requires_confirmation"
    REJECTED = "rejected"
    NOT_APPLICABLE = "not_applicable"


class ActionType(str, Enum):
    """What the orchestrator did. None means the intent was read-only
    (READ_NEXT_STEP / REPEAT_STEP) or could not be acted on."""

    CHECKLIST_ITEM_COMPLETED = "checklist_item_completed"
    NOTE_ADDED = "note_added"
    NEXT_STEP_READ = "next_step_read"
    CURRENT_STEP_REPEATED = "current_step_repeated"
    PROCEDURE_COMPLETED = "procedure_completed"
    NONE = "none"


@dataclass
class ActionPayload:
    """Action-shaped extra data for the response. Always JSON-serialisable."""

    type: ActionType = ActionType.NONE
    data: Dict[str, Any] = field(default_factory=dict)

    def to_public(self) -> Dict[str, Any]:
        return {"type": self.type.value, "data": self.data}


@dataclass
class ActionResult:
    """What the orchestrator returns to the controller.

    Fields:
      success                 final success flag for the HTTP response
      requires_confirmation   true when confidence below threshold or
                              the domain service flagged ambiguity
      status                  fine-grained outcome enum (for logging)
      action                  ActionType + JSON-safe payload
      message                 human-readable summary (English)
      threshold               confidence threshold actually used
    """

    success: bool
    requires_confirmation: bool
    status: ActionStatus
    action: ActionPayload
    message: str
    threshold: float

    # Convenience constructors -----------------------------------------
    @classmethod
    def confirmation(
        cls,
        *,
        message: str,
        threshold: float,
    ) -> "ActionResult":
        return cls(
            success=False,
            requires_confirmation=True,
            status=ActionStatus.REQUIRES_CONFIRMATION,
            action=ActionPayload(type=ActionType.NONE),
            message=message,
            threshold=threshold,
        )

    @classmethod
    def rejected(
        cls,
        *,
        message: str,
        threshold: float,
    ) -> "ActionResult":
        return cls(
            success=False,
            requires_confirmation=False,
            status=ActionStatus.REJECTED,
            action=ActionPayload(type=ActionType.NONE),
            message=message,
            threshold=threshold,
        )

    @classmethod
    def not_applicable(
        cls,
        *,
        message: str,
        threshold: float,
    ) -> "ActionResult":
        return cls(
            success=False,
            requires_confirmation=False,
            status=ActionStatus.NOT_APPLICABLE,
            action=ActionPayload(type=ActionType.NONE),
            message=message,
            threshold=threshold,
        )

    @classmethod
    def executed(
        cls,
        *,
        action: ActionPayload,
        message: str,
        threshold: float,
    ) -> "ActionResult":
        return cls(
            success=True,
            requires_confirmation=False,
            status=ActionStatus.EXECUTED,
            action=action,
            message=message,
            threshold=threshold,
        )

    def to_public(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "requiresConfirmation": self.requires_confirmation,
            "status": self.status.value,
            "action": self.action.to_public(),
            "message": self.message,
            "threshold": self.threshold,
        }


class VoiceCommandOrchestrator(ABC):
    """Abstract orchestrator. Concrete impl lives in `orchestrator.py`."""

    name: str = "voice_command_orchestrator"
    confidence_threshold: float = 0.90

    @abstractmethod
    async def execute(
        self,
        intent_result: IntentResult,
        *,
        procedure_id: str,
        user: Optional[Dict[str, Any]] = None,
    ) -> ActionResult:
        """Validate confidence and dispatch to the appropriate service.

        MUST be a pure dispatcher — implementations may NOT contain DB
        I/O or business rules beyond the confidence gate.
        """
        raise NotImplementedError
