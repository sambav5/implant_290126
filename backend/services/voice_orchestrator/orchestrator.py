"""Default VoiceCommandOrchestrator implementation.

Responsibilities (the WHOLE list — anything else belongs in a service):
  1. Apply the confidence gate.
  2. Map intent -> domain service call.
  3. Translate service exceptions/results into ActionResult.
  4. Format the user-facing message.

It does NOT:
  - Query MongoDB directly.
  - Mutate any document.
  - Re-validate transcripts (that's the IntentEngine's job).
  - Refer to specific LLM providers.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from services.intent_engine import IntentKind, IntentResult
from services.checklist_service import (
    AmbiguousChecklistItemError,
    ChecklistItemAlreadyCompleteError,
    ChecklistItemNotFoundError,
    ChecklistService,
    ProcedureNotFoundError,
)
from services.notes_service import EmptyNoteError, NotesService
from services.procedure_service import (
    ProcedureError,
    ProcedureService,
    ProcedureValidationError,
)

from .base import (
    ActionPayload,
    ActionResult,
    ActionType,
    VoiceCommandOrchestrator,
)

logger = logging.getLogger(__name__)


class DefaultVoiceCommandOrchestrator(VoiceCommandOrchestrator):
    """Concrete orchestrator wired against the three domain services."""

    name = "default_voice_orchestrator"

    def __init__(
        self,
        *,
        checklist_service: ChecklistService,
        notes_service: NotesService,
        procedure_service: ProcedureService,
        confidence_threshold: float = 0.90,
    ) -> None:
        self._checklist = checklist_service
        self._notes = notes_service
        self._procedure = procedure_service
        self.confidence_threshold = float(confidence_threshold)

    # ------------------------------------------------------------------ #
    # Entry point                                                        #
    # ------------------------------------------------------------------ #
    async def execute(
        self,
        intent_result: IntentResult,
        *,
        procedure_id: str,
        user: Optional[Dict[str, Any]] = None,
        proc_context: Optional[ProcedureContext] = None,
    ) -> ActionResult:
        if not procedure_id:
            return ActionResult.rejected(
                message="Missing procedure identifier.",
                threshold=self.confidence_threshold,
            )

        # UNKNOWN never executes — it's the intent engine's "I don't know".
        if intent_result.intent is IntentKind.UNKNOWN:
            return ActionResult.not_applicable(
                message="Sorry, I didn't catch a command.",
                threshold=self.confidence_threshold,
            )

        # 1) Confidence gate ------------------------------------------------
        if intent_result.confidence < self.confidence_threshold:
            return ActionResult.confirmation(
                message=self._build_confirmation_message(intent_result),
                threshold=self.confidence_threshold,
            )

        # 2) Dispatch --------------------------------------------------------
        try:
            if intent_result.intent is IntentKind.UPDATE_CHECKLIST:
                return await self._handle_update_checklist(intent_result, procedure_id, user, proc_context)
            if intent_result.intent is IntentKind.ADD_NOTE:
                return await self._handle_add_note(intent_result, procedure_id, user)
            if intent_result.intent is IntentKind.READ_NEXT_STEP:
                return await self._handle_read_next_step(procedure_id)
            if intent_result.intent is IntentKind.REPEAT_STEP:
                return await self._handle_repeat_step(procedure_id)
            if intent_result.intent is IntentKind.FINISH_PROCEDURE:
                return await self._handle_finish_procedure(procedure_id, user)
        except ProcedureNotFoundError as exc:
            return ActionResult.rejected(
                message=exc.user_message, threshold=self.confidence_threshold,
            )

        # Should be unreachable — IntentKind is a closed set.
        return ActionResult.not_applicable(
            message="Unsupported command.",
            threshold=self.confidence_threshold,
        )

    # ------------------------------------------------------------------ #
    # Per-intent handlers (thin dispatchers — no business logic)         #
    # ------------------------------------------------------------------ #
    async def _handle_update_checklist(
        self,
        intent_result: IntentResult,
        procedure_id: str,
        user: Optional[Dict[str, Any]],
        proc_context: Optional[ProcedureContext] = None,
    ) -> ActionResult:
        query = (intent_result.entity or "").strip()
        if not query:
            return ActionResult.rejected(
                message="I couldn't tell which item you meant.",
                threshold=self.confidence_threshold,
            )
        try:
            item = await self._checklist.complete_item(
                procedure_id,
                query,
                user_id=_user_field(user, "userId", "id"),
                user_name=_user_field(user, "name", "fullName"),
                user_role=_user_field(user, "role"),
                proc_context=proc_context,
            )
        except AmbiguousChecklistItemError as exc:
            return ActionResult.confirmation(
                message=(
                    f"Multiple items match '{query}'. Did you mean: "
                    f"{', '.join(exc.candidates)}?"
                ),
                threshold=self.confidence_threshold,
            )
        except ChecklistItemAlreadyCompleteError as exc:
            return ActionResult.not_applicable(
                message=exc.user_message,
                threshold=self.confidence_threshold,
            )
        except ChecklistItemNotFoundError as exc:
            return ActionResult.rejected(
                message=exc.user_message,
                threshold=self.confidence_threshold,
            )

        return ActionResult.executed(
            action=ActionPayload(
                type=ActionType.CHECKLIST_ITEM_COMPLETED,
                data={"item": item.to_public()},
            ),
            message=f"Marked '{item.text}' complete.",
            threshold=self.confidence_threshold,
        )

    async def _handle_add_note(
        self,
        intent_result: IntentResult,
        procedure_id: str,
        user: Optional[Dict[str, Any]],
    ) -> ActionResult:
        note_text = ""
        if isinstance(intent_result.parameters, dict):
            note_text = str(intent_result.parameters.get("note", "")).strip()
        if not note_text:
            # Fall back to the transcript if the LLM didn't separate the note.
            note_text = (intent_result.transcript or "").strip()
        if not note_text:
            return ActionResult.rejected(
                message="There was nothing to note.",
                threshold=self.confidence_threshold,
            )

        item_id: Optional[str] = None
        item_text: Optional[str] = None
        entity = (intent_result.entity or "").strip()
        if entity:
            # Best-effort: link the note to a checklist item if the entity
            # resolves cleanly. Failure to resolve is non-fatal.
            try:
                view = await self._checklist.get_checklist(procedure_id)
                match = ChecklistService._resolve_item(view, entity)  # noqa: SLF001
                item_id = match.item_id or None
                item_text = match.text
            except (
                ChecklistItemNotFoundError,
                AmbiguousChecklistItemError,
                ProcedureNotFoundError,
            ):
                item_id = None
                item_text = None

        try:
            note = await self._notes.add_note(
                procedure_id=procedure_id,
                text=note_text,
                item_id=item_id,
                item_text=item_text,
                author_id=_user_field(user, "userId", "id"),
                author_name=_user_field(user, "name", "fullName"),
            )
        except EmptyNoteError as exc:
            return ActionResult.rejected(
                message=exc.user_message,
                threshold=self.confidence_threshold,
            )

        return ActionResult.executed(
            action=ActionPayload(
                type=ActionType.NOTE_ADDED,
                data={"note": note.to_public()},
            ),
            message="Note added.",
            threshold=self.confidence_threshold,
        )

    async def _handle_read_next_step(self, procedure_id: str) -> ActionResult:
        view = await self._checklist.get_checklist(procedure_id)
        next_item = view.next_step()
        if not next_item:
            return ActionResult.executed(
                action=ActionPayload(
                    type=ActionType.NEXT_STEP_READ,
                    data={"item": None, "allComplete": True},
                ),
                message="All checklist items are complete.",
                threshold=self.confidence_threshold,
            )
        return ActionResult.executed(
            action=ActionPayload(
                type=ActionType.NEXT_STEP_READ,
                data={"item": next_item.to_public(), "allComplete": False},
            ),
            message=f"Next: {next_item.text}.",
            threshold=self.confidence_threshold,
        )

    async def _handle_repeat_step(self, procedure_id: str) -> ActionResult:
        view = await self._checklist.get_checklist(procedure_id)
        current = view.current_step()
        if not current:
            return ActionResult.executed(
                action=ActionPayload(
                    type=ActionType.CURRENT_STEP_REPEATED,
                    data={"item": None, "allComplete": True},
                ),
                message="All checklist items are complete.",
                threshold=self.confidence_threshold,
            )
        return ActionResult.executed(
            action=ActionPayload(
                type=ActionType.CURRENT_STEP_REPEATED,
                data={"item": current.to_public()},
            ),
            message=f"Current step: {current.text}.",
            threshold=self.confidence_threshold,
        )

    async def _handle_finish_procedure(
        self,
        procedure_id: str,
        user: Optional[Dict[str, Any]],
    ) -> ActionResult:
        try:
            result = await self._procedure.finish_procedure(
                procedure_id,
                user_id=_user_field(user, "userId", "id"),
                user_name=_user_field(user, "name", "fullName"),
            )
        except ProcedureValidationError as exc:
            return ActionResult.rejected(
                message=exc.user_message,
                threshold=self.confidence_threshold,
            )
        except ProcedureError as exc:
            return ActionResult.rejected(
                message=exc.user_message,
                threshold=self.confidence_threshold,
            )

        return ActionResult.executed(
            action=ActionPayload(
                type=ActionType.PROCEDURE_COMPLETED,
                data={"procedure": result.to_public()},
            ),
            message="Procedure marked complete.",
            threshold=self.confidence_threshold,
        )

    # ------------------------------------------------------------------ #
    # Message builders                                                    #
    # ------------------------------------------------------------------ #
    @staticmethod
    def _build_confirmation_message(intent_result: IntentResult) -> str:
        intent = intent_result.intent
        entity = (intent_result.entity or "").strip() or None
        if intent is IntentKind.UPDATE_CHECKLIST and entity:
            return f"Did you mean to mark '{entity}' complete?"
        if intent is IntentKind.UPDATE_CHECKLIST:
            return "Did you mean to mark the current step complete?"
        if intent is IntentKind.ADD_NOTE:
            return "Did you mean to add a note?"
        if intent is IntentKind.READ_NEXT_STEP:
            return "Did you want me to read the next step?"
        if intent is IntentKind.REPEAT_STEP:
            return "Did you want me to repeat the current step?"
        if intent is IntentKind.FINISH_PROCEDURE:
            return "Did you mean to finish this procedure?"
        return "I'm not sure I understood. Could you repeat that?"


def _user_field(
    user: Optional[Dict[str, Any]], *keys: str
) -> Optional[str]:
    if not user:
        return None
    for key in keys:
        value = user.get(key)
        if value:
            return str(value)
    return None
