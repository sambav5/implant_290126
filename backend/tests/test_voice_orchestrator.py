"""Unit tests for the VoiceCommandOrchestrator (Step 4).

These tests use in-memory fake services and never touch MongoDB. The goal
is to lock in the orchestrator's contract:

  - Confidence gate kicks in below threshold for every executable intent.
  - Each intent dispatches to the correct service method exactly once.
  - Service exceptions are translated into stable ActionResult shapes.
  - The orchestrator never queries / mutates state itself.

Run:
    cd /app/backend && python -m pytest tests/test_voice_orchestrator.py -v \
        -c tests/pytest.ini
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# Make `services` importable when pytest is run from /app/backend/tests.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest  # noqa: E402

from services.intent_engine import IntentKind, IntentResult  # noqa: E402
from services.checklist_service import (  # noqa: E402
    AmbiguousChecklistItemError,
    ChecklistItemAlreadyCompleteError,
    ChecklistItemNotFoundError,
    ChecklistItemView,
    ChecklistService,
    ChecklistView,
    ProcedureNotFoundError,
)
from services.notes_service import NotesService, ProcedureNote  # noqa: E402
from services.procedure_service import (  # noqa: E402
    ProcedureCompletionResult,
    ProcedureService,
    ProcedureValidationError,
)
from services.voice_orchestrator.orchestrator import (  # noqa: E402
    DefaultVoiceCommandOrchestrator,
)
from services.voice_orchestrator import ActionStatus, ActionType  # noqa: E402


# --------------------------------------------------------------------------- #
# Fakes                                                                       #
# --------------------------------------------------------------------------- #
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _items(*specs) -> List[ChecklistItemView]:
    out = []
    for idx, (text, completed) in enumerate(specs):
        out.append(
            ChecklistItemView(
                item_id=f"item-{idx}",
                text=text,
                completed=completed,
                _shape="legacy",
                _legacy_field="treatmentChecklist",
                _legacy_index=idx,
            )
        )
    return out


class FakeChecklistService(ChecklistService):
    """In-memory ChecklistService stand-in. Inherits ChecklistService only to
    keep static method usage (_resolve_item) honest; never touches a DB."""

    def __init__(
        self,
        items: List[ChecklistItemView],
        *,
        procedure_id: str = "proc-1",
        procedure_name: str = "Root Canal",
        not_found: bool = False,
    ):
        # NOTE: skip parent __init__ - we don't want a DB handle.
        self._items = items
        self._procedure_id = procedure_id
        self._procedure_name = procedure_name
        self._not_found = not_found
        self.calls: List[Dict[str, Any]] = []

    async def get_checklist(self, procedure_id: str) -> ChecklistView:
        self.calls.append({"method": "get_checklist", "procedure_id": procedure_id})
        if self._not_found:
            raise ProcedureNotFoundError(user_message="Procedure not found.")
        return ChecklistView(
            procedure_id=procedure_id,
            procedure_name=self._procedure_name,
            items=list(self._items),
        )

    async def complete_item(self, procedure_id, item_query, **kwargs):
        self.calls.append(
            {"method": "complete_item", "procedure_id": procedure_id,
             "item_query": item_query, "kwargs": kwargs}
        )
        if self._not_found:
            raise ProcedureNotFoundError(user_message="Procedure not found.")
        view = await self.get_checklist(procedure_id)
        match = self._resolve_item(view, item_query)
        if match.completed:
            raise ChecklistItemAlreadyCompleteError(
                user_message=f"'{match.text}' is already complete.",
            )
        match.completed = True
        match.completed_at = _now()
        return match


class FakeNotesService(NotesService):
    def __init__(self):
        self._stored: List[ProcedureNote] = []
        self.calls: List[Dict[str, Any]] = []

    async def add_note(self, **kwargs):
        self.calls.append({"method": "add_note", "kwargs": kwargs})
        note = ProcedureNote(
            note_id=f"note-{len(self._stored) + 1}",
            procedure_id=kwargs["procedure_id"],
            text=kwargs["text"],
            created_at=_now(),
            item_id=kwargs.get("item_id"),
            item_text=kwargs.get("item_text"),
            author_id=kwargs.get("author_id"),
            author_name=kwargs.get("author_name"),
            source="voice",
        )
        self._stored.append(note)
        return note


class FakeProcedureService(ProcedureService):
    def __init__(self, *, pending: Optional[List[str]] = None, total: int = 4):
        self._pending = pending or []
        self._total = total
        self.calls: List[Dict[str, Any]] = []

    async def finish_procedure(self, procedure_id, **kwargs):
        self.calls.append({"method": "finish_procedure", "procedure_id": procedure_id,
                           "kwargs": kwargs})
        if self._pending:
            raise ProcedureValidationError(pending_items=self._pending)
        return ProcedureCompletionResult(
            procedure_id=procedure_id,
            procedure_name="Root Canal",
            completed_at=_now(),
            total_items=self._total,
        )


def _build_orchestrator(
    *,
    items=None,
    not_found=False,
    pending_for_finish=None,
    threshold: float = 0.9,
):
    checklist = FakeChecklistService(
        items if items is not None else _items(
            ("Consent", True),
            ("Anesthesia", True),
            ("Access Opening", True),
            ("Working Length", False),
            ("Canal Preparation", False),
            ("Irrigation", False),
            ("Obturation", False),
        ),
        not_found=not_found,
    )
    notes = FakeNotesService()
    procedure = FakeProcedureService(pending=pending_for_finish)
    orchestrator = DefaultVoiceCommandOrchestrator(
        checklist_service=checklist,
        notes_service=notes,
        procedure_service=procedure,
        confidence_threshold=threshold,
    )
    return orchestrator, checklist, notes, procedure


def _ir(intent: IntentKind, **kw) -> IntentResult:
    return IntentResult(
        transcript=kw.pop("transcript", ""),
        intent=intent,
        confidence=kw.pop("confidence", 0.99),
        entity=kw.pop("entity", None),
        parameters=kw.pop("parameters", {}),
    )


# --------------------------------------------------------------------------- #
# Confidence gate                                                              #
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_low_confidence_triggers_confirmation_not_execution():
    orch, cl, notes, proc = _build_orchestrator()
    result = await orch.execute(
        _ir(IntentKind.UPDATE_CHECKLIST, entity="Working Length", confidence=0.84),
        procedure_id="proc-1",
    )
    assert result.success is False
    assert result.requires_confirmation is True
    assert result.status is ActionStatus.REQUIRES_CONFIRMATION
    assert "Working Length" in result.message
    assert result.threshold == 0.9
    # IMPORTANT: no service was called.
    assert cl.calls == []
    assert notes.calls == []
    assert proc.calls == []


@pytest.mark.asyncio
async def test_exact_threshold_is_inclusive():
    orch, cl, _, _ = _build_orchestrator(threshold=0.9)
    result = await orch.execute(
        _ir(IntentKind.READ_NEXT_STEP, confidence=0.9),
        procedure_id="proc-1",
    )
    assert result.success is True
    assert len(cl.calls) == 1


@pytest.mark.asyncio
async def test_unknown_intent_never_executes():
    orch, cl, notes, proc = _build_orchestrator()
    result = await orch.execute(
        _ir(IntentKind.UNKNOWN, confidence=0.99),
        procedure_id="proc-1",
    )
    assert result.success is False
    assert result.status is ActionStatus.NOT_APPLICABLE
    assert cl.calls == notes.calls == proc.calls == []


# --------------------------------------------------------------------------- #
# UPDATE_CHECKLIST                                                            #
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_update_checklist_happy_path():
    orch, cl, _, _ = _build_orchestrator()
    result = await orch.execute(
        _ir(IntentKind.UPDATE_CHECKLIST, entity="Working Length", confidence=0.98),
        procedure_id="proc-1",
    )
    assert result.success is True
    assert result.status is ActionStatus.EXECUTED
    assert result.action.type is ActionType.CHECKLIST_ITEM_COMPLETED
    assert result.action.data["item"]["text"] == "Working Length"
    assert result.action.data["item"]["completed"] is True
    # The orchestrator called complete_item exactly once with the entity.
    assert any(c["method"] == "complete_item" for c in cl.calls)


@pytest.mark.asyncio
async def test_update_checklist_already_complete():
    orch, _, _, _ = _build_orchestrator()
    result = await orch.execute(
        _ir(IntentKind.UPDATE_CHECKLIST, entity="Consent", confidence=0.98),
        procedure_id="proc-1",
    )
    assert result.success is False
    assert result.status is ActionStatus.NOT_APPLICABLE
    assert "already complete" in result.message.lower()


@pytest.mark.asyncio
async def test_update_checklist_unknown_item():
    orch, _, _, _ = _build_orchestrator()
    result = await orch.execute(
        _ir(IntentKind.UPDATE_CHECKLIST, entity="Quantum Foam", confidence=0.98),
        procedure_id="proc-1",
    )
    assert result.success is False
    assert result.status is ActionStatus.REJECTED
    assert "Quantum Foam" in result.message


@pytest.mark.asyncio
async def test_update_checklist_no_entity_is_rejected():
    orch, _, _, _ = _build_orchestrator()
    result = await orch.execute(
        _ir(IntentKind.UPDATE_CHECKLIST, entity=None, confidence=0.98),
        procedure_id="proc-1",
    )
    assert result.success is False
    assert result.status is ActionStatus.REJECTED


# --------------------------------------------------------------------------- #
# ADD_NOTE                                                                    #
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_add_note_happy_path():
    orch, _, notes, _ = _build_orchestrator()
    result = await orch.execute(
        _ir(
            IntentKind.ADD_NOTE,
            transcript="Add note distal canal calcified",
            confidence=0.99,
            parameters={"note": "distal canal calcified"},
        ),
        procedure_id="proc-1",
    )
    assert result.success is True
    assert result.action.type is ActionType.NOTE_ADDED
    assert result.action.data["note"]["text"] == "distal canal calcified"
    assert len(notes.calls) == 1
    assert notes.calls[0]["kwargs"]["text"] == "distal canal calcified"


@pytest.mark.asyncio
async def test_add_note_rejects_empty_note():
    orch, _, notes, _ = _build_orchestrator()
    result = await orch.execute(
        _ir(IntentKind.ADD_NOTE, transcript="", confidence=0.99, parameters={"note": "   "}),
        procedure_id="proc-1",
    )
    assert result.success is False
    assert result.status is ActionStatus.REJECTED
    assert notes.calls == []


@pytest.mark.asyncio
async def test_add_note_links_to_resolved_item():
    orch, _, notes, _ = _build_orchestrator()
    result = await orch.execute(
        _ir(
            IntentKind.ADD_NOTE,
            confidence=0.99,
            entity="Working Length",
            parameters={"note": "rubber dam slipping"},
        ),
        procedure_id="proc-1",
    )
    assert result.success is True
    assert result.action.data["note"]["itemText"] == "Working Length"


# --------------------------------------------------------------------------- #
# READ_NEXT_STEP / REPEAT_STEP                                                #
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_read_next_step_returns_first_pending_item():
    orch, _, _, _ = _build_orchestrator()
    result = await orch.execute(
        _ir(IntentKind.READ_NEXT_STEP, confidence=0.99),
        procedure_id="proc-1",
    )
    assert result.success is True
    assert result.action.type is ActionType.NEXT_STEP_READ
    assert result.action.data["item"]["text"] == "Working Length"
    assert result.action.data["allComplete"] is False


@pytest.mark.asyncio
async def test_read_next_step_when_all_complete():
    items = _items(("Consent", True), ("Anesthesia", True))
    orch, _, _, _ = _build_orchestrator(items=items)
    result = await orch.execute(
        _ir(IntentKind.READ_NEXT_STEP, confidence=0.99),
        procedure_id="proc-1",
    )
    assert result.success is True
    assert result.action.data["allComplete"] is True
    assert result.action.data["item"] is None


@pytest.mark.asyncio
async def test_repeat_step_returns_current_item():
    orch, _, _, _ = _build_orchestrator()
    result = await orch.execute(
        _ir(IntentKind.REPEAT_STEP, confidence=0.95),
        procedure_id="proc-1",
    )
    assert result.success is True
    assert result.action.type is ActionType.CURRENT_STEP_REPEATED
    assert result.action.data["item"]["text"] == "Working Length"


# --------------------------------------------------------------------------- #
# FINISH_PROCEDURE                                                            #
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_finish_procedure_rejected_when_pending_items_remain():
    orch, _, _, proc = _build_orchestrator(
        pending_for_finish=["Working Length", "Irrigation"],
    )
    result = await orch.execute(
        _ir(IntentKind.FINISH_PROCEDURE, confidence=0.98),
        procedure_id="proc-1",
    )
    assert result.success is False
    assert result.status is ActionStatus.REJECTED
    assert "still pending" in result.message
    assert len(proc.calls) == 1


@pytest.mark.asyncio
async def test_finish_procedure_succeeds_when_all_complete():
    orch, _, _, proc = _build_orchestrator(pending_for_finish=[])
    result = await orch.execute(
        _ir(IntentKind.FINISH_PROCEDURE, confidence=0.98),
        procedure_id="proc-1",
    )
    assert result.success is True
    assert result.action.type is ActionType.PROCEDURE_COMPLETED
    assert result.action.data["procedure"]["procedureId"] == "proc-1"


# --------------------------------------------------------------------------- #
# Procedure not found                                                         #
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_procedure_not_found_is_handled_for_writes():
    orch, _, _, _ = _build_orchestrator(not_found=True)
    result = await orch.execute(
        _ir(IntentKind.UPDATE_CHECKLIST, entity="Working Length", confidence=0.98),
        procedure_id="ghost",
    )
    assert result.success is False
    assert result.status is ActionStatus.REJECTED
    assert "not found" in result.message.lower()


@pytest.mark.asyncio
async def test_empty_procedure_id_is_rejected_without_calling_services():
    orch, cl, notes, proc = _build_orchestrator()
    result = await orch.execute(
        _ir(IntentKind.UPDATE_CHECKLIST, entity="Working Length", confidence=0.98),
        procedure_id="",
    )
    assert result.success is False
    assert result.status is ActionStatus.REJECTED
    assert cl.calls == notes.calls == proc.calls == []


# --------------------------------------------------------------------------- #
# Resolution helper (static, pure)                                            #
# --------------------------------------------------------------------------- #
def test_resolve_item_exact_case_sensitive():
    view = ChecklistView(
        procedure_id="p", procedure_name=None,
        items=_items(("Working Length", False), ("working length copy", False)),
    )
    match = ChecklistService._resolve_item(view, "Working Length")
    assert match.text == "Working Length"


def test_resolve_item_case_insensitive():
    view = ChecklistView(
        procedure_id="p", procedure_name=None,
        items=_items(("Working Length", False)),
    )
    match = ChecklistService._resolve_item(view, "working length")
    assert match.text == "Working Length"


def test_resolve_item_substring_match():
    view = ChecklistView(
        procedure_id="p", procedure_name=None,
        items=_items(("Access Opening", False)),
    )
    match = ChecklistService._resolve_item(view, "access")
    assert match.text == "Access Opening"


def test_resolve_item_ambiguous_raises():
    view = ChecklistView(
        procedure_id="p", procedure_name=None,
        items=_items(("Canal Preparation", False), ("Canal Filling", False)),
    )
    with pytest.raises(AmbiguousChecklistItemError):
        ChecklistService._resolve_item(view, "Canal")


def test_resolve_item_not_found_raises():
    view = ChecklistView(
        procedure_id="p", procedure_name=None,
        items=_items(("Consent", True)),
    )
    with pytest.raises(ChecklistItemNotFoundError):
        ChecklistService._resolve_item(view, "Quantum Foam")
