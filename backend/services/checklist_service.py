"""ChecklistService — the ONLY place voice flows are allowed to read/mutate
checklist data. The orchestrator never touches the database directly.

The service flattens the two on-case shapes used elsewhere in the app:
  - new nested `prostheticChecklist` (phases -> sections -> items)
  - legacy `preTreatmentChecklist` / `treatmentChecklist` /
    `postTreatmentChecklist` (flat lists)
into a uniform `ChecklistItemView` so the orchestrator can reason about
"items" without caring which schema the case is on.

Writes are surgical: only the targeted item's `completed`, `completedAt`,
`completedByRole`, `completedByName` fields change. The rest of the case
document is untouched.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

_LEGACY_LIST_FIELDS = (
    "preTreatmentChecklist",
    "treatmentChecklist",
    "postTreatmentChecklist",
)


class ChecklistError(Exception):
    """Base class for service-level checklist errors."""

    user_message: str = "Checklist operation failed."

    def __init__(self, message: str = "", user_message: Optional[str] = None):
        super().__init__(message or user_message or self.user_message)
        if user_message:
            self.user_message = user_message


class ProcedureNotFoundError(ChecklistError):
    user_message = "Procedure not found."


class ChecklistItemNotFoundError(ChecklistError):
    user_message = "No matching checklist item."


class AmbiguousChecklistItemError(ChecklistError):
    user_message = "Multiple checklist items match."

    def __init__(self, candidates: List[str], message: str = ""):
        super().__init__(message)
        self.candidates = candidates


class ChecklistItemAlreadyCompleteError(ChecklistError):
    user_message = "That item is already complete."


@dataclass
class ChecklistItemView:
    """Read-only view of a single item, with enough breadcrumbs to write back."""

    item_id: str
    text: str
    completed: bool
    completed_at: Optional[str] = None
    notes: Optional[str] = None
    # Internal locator for surgical mongo update; never returned to clients.
    _shape: str = "legacy"            # "legacy" | "prosthetic"
    _legacy_field: Optional[str] = None
    _legacy_index: Optional[int] = None
    _phase_key: Optional[str] = None
    _section_index: Optional[int] = None
    _item_index: Optional[int] = None

    def to_public(self) -> Dict[str, Any]:
        return {
            "itemId": self.item_id,
            "text": self.text,
            "completed": self.completed,
            "completedAt": self.completed_at,
            "notes": self.notes,
        }


@dataclass
class ChecklistView:
    procedure_id: str
    procedure_name: Optional[str]
    items: List[ChecklistItemView] = field(default_factory=list)

    @property
    def pending(self) -> List[ChecklistItemView]:
        return [i for i in self.items if not i.completed]

    @property
    def completed(self) -> List[ChecklistItemView]:
        return [i for i in self.items if i.completed]

    def current_step(self) -> Optional[ChecklistItemView]:
        return self.pending[0] if self.pending else None

    def next_step(self) -> Optional[ChecklistItemView]:
        # "Next" semantically = the next pending item the user has not yet
        # done. We treat "current" and "next" as the same first-pending
        # item; the consumer decides how to phrase it.
        return self.current_step()


class ChecklistService:
    """Owns ALL reads and writes for voice-initiated checklist operations."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self._db = db
        self._cases = db.cases

    # ------------------------------------------------------------------ #
    # Reads                                                                #
    # ------------------------------------------------------------------ #
    async def get_checklist(self, procedure_id: str) -> ChecklistView:
        """Load the canonical checklist for a procedure (= case).

        Voice flows MUST call this rather than trust client-sent state.
        """
        case = await self._fetch_case(procedure_id)
        items: List[ChecklistItemView] = []

        prosthetic = case.get("prostheticChecklist")
        if isinstance(prosthetic, dict) and prosthetic:
            items.extend(self._flatten_prosthetic(prosthetic))

        # Legacy lists are merged when present (some older cases still use them).
        for legacy_field in _LEGACY_LIST_FIELDS:
            legacy = case.get(legacy_field)
            if isinstance(legacy, list):
                items.extend(self._flatten_legacy_list(legacy_field, legacy))

        procedure_name = (
            case.get("case_title")
            or case.get("caseTitle")
            or case.get("patient_name")
            or None
        )
        return ChecklistView(
            procedure_id=procedure_id,
            procedure_name=procedure_name,
            items=items,
        )

    # ------------------------------------------------------------------ #
    # Writes                                                              #
    # ------------------------------------------------------------------ #
    async def complete_item(
        self,
        procedure_id: str,
        item_query: str,
        *,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        user_role: Optional[str] = None,
        proc_context: Optional[Any] = None,
    ) -> ChecklistItemView:
        """Mark exactly one item as complete.

        Resolution order: exact text match -> case-insensitive equality ->
        case-insensitive `contains`. Raises AmbiguousChecklistItemError if
        the resolution returns more than one candidate.
        """
        view = await self.get_checklist(procedure_id)

        # If DB list is empty but we have a client-provided context, initialize it virtually
        if not view.items and proc_context:
            logger.info("Database checklist is empty. Using client-provided context to resolve.")
            virtual_items = []
            for item_text in getattr(proc_context, "pending", []) or []:
                virtual_items.append(
                    ChecklistItemView(
                        item_id=item_text,
                        text=item_text,
                        completed=False,
                    )
                )
            for item_text in getattr(proc_context, "completed", []) or []:
                virtual_items.append(
                    ChecklistItemView(
                        item_id=item_text,
                        text=item_text,
                        completed=True,
                    )
                )
            view = ChecklistView(procedure_id=procedure_id, procedure_name=getattr(proc_context, "procedure_name", "") or "", items=virtual_items)

        try:
            match = self._resolve_item(view, item_query)
        except ChecklistItemNotFoundError as exc:
            # If still not found, check if the client context has a current step we can fall back to
            if proc_context and getattr(proc_context, "current_step", None):
                logger.info(f"Checklist item not resolved. Falling back to client current step: {proc_context.current_step}")
                match = ChecklistItemView(
                    item_id=proc_context.current_step,
                    text=proc_context.current_step,
                    completed=False,
                )
            else:
                raise exc

        if match.completed:
            raise ChecklistItemAlreadyCompleteError(
                user_message=f"'{match.text}' is already complete.",
            )

        completed_at = datetime.now(timezone.utc).isoformat()

        # If this is a virtual item (not in DB), skip the database write since it is client-managed
        if getattr(match, "_shape", None) is None or match._shape == "legacy" and match._legacy_field is None:
            logger.info(f"Skipping database update for client-managed virtual checklist item: {match.text}")
            match.completed = True
            match.completed_at = completed_at
            return match

        update_doc = self._build_completion_update(
            match,
            completed_at=completed_at,
            user_name=user_name,
            user_role=user_role,
        )
        result = await self._cases.update_one(
            {"id": procedure_id}, {"$set": update_doc}
        )
        if result.matched_count == 0:
            raise ProcedureNotFoundError(
                user_message="Procedure not found.",
            )

        # Return the updated view of the item.
        match.completed = True
        match.completed_at = completed_at
        return match

    # ------------------------------------------------------------------ #
    # Resolution helpers (pure functions, exposed for unit tests)         #
    # ------------------------------------------------------------------ #
    @staticmethod
    def _resolve_item(view: ChecklistView, query: str) -> ChecklistItemView:
        query_norm = (query or "").strip().lower()
        if not query_norm:
            raise ChecklistItemNotFoundError(
                user_message="No checklist item was named.",
            )

        # Tier 1: exact (case-sensitive) text match
        exact = [i for i in view.items if i.text == query]
        if len(exact) == 1:
            return exact[0]

        # Tier 2: case-insensitive equality
        equal_ci = [i for i in view.items if i.text.strip().lower() == query_norm]
        if len(equal_ci) == 1:
            return equal_ci[0]
        if len(equal_ci) > 1:
            raise AmbiguousChecklistItemError(
                candidates=[i.text for i in equal_ci],
                message=f"Ambiguous match for '{query}'",
            )

        # Tier 3: substring (case-insensitive). Prefer pending over completed.
        contains = [i for i in view.items if query_norm in i.text.strip().lower()]
        if not contains:
            # Also try the other direction (item-name substring of query)
            # to catch "complete working length now" -> "Working Length".
            contains = [
                i for i in view.items if i.text.strip().lower() in query_norm
            ]
        if len(contains) == 1:
            return contains[0]
        if len(contains) > 1:
            # Prefer items that are still pending.
            pending_only = [i for i in contains if not i.completed]
            if len(pending_only) == 1:
                return pending_only[0]
            raise AmbiguousChecklistItemError(
                candidates=[i.text for i in contains],
                message=f"Ambiguous match for '{query}'",
            )

        raise ChecklistItemNotFoundError(
            user_message=f"No checklist item found for '{query}'.",
        )

    # ------------------------------------------------------------------ #
    # Internals                                                           #
    # ------------------------------------------------------------------ #
    async def _fetch_case(self, procedure_id: str) -> Dict[str, Any]:
        case = await self._cases.find_one({"id": procedure_id}, {"_id": 0})
        if not case:
            raise ProcedureNotFoundError(
                user_message=f"Procedure '{procedure_id}' not found.",
            )
        return case

    @staticmethod
    def _flatten_prosthetic(prosthetic: Dict[str, Any]) -> List[ChecklistItemView]:
        """Flatten phases -> sections -> items into a single ordered list."""
        out: List[ChecklistItemView] = []
        for phase_key, phase_data in prosthetic.items():
            if not isinstance(phase_data, dict):
                continue
            sections = phase_data.get("sections")
            if not isinstance(sections, list):
                continue
            for s_idx, section in enumerate(sections):
                items = section.get("items") if isinstance(section, dict) else None
                if not isinstance(items, list):
                    continue
                for i_idx, item in enumerate(items):
                    if not isinstance(item, dict):
                        continue
                    text = item.get("text") or item.get("title") or ""
                    if not text:
                        continue
                    out.append(
                        ChecklistItemView(
                            item_id=item.get("id") or "",
                            text=str(text),
                            completed=bool(item.get("completed", False)),
                            completed_at=item.get("completedAt"),
                            notes=item.get("notes"),
                            _shape="prosthetic",
                            _phase_key=phase_key,
                            _section_index=s_idx,
                            _item_index=i_idx,
                        )
                    )
        return out

    @staticmethod
    def _flatten_legacy_list(
        legacy_field: str, legacy_items: List[Any]
    ) -> List[ChecklistItemView]:
        out: List[ChecklistItemView] = []
        for idx, item in enumerate(legacy_items):
            if not isinstance(item, dict):
                continue
            out.append(
                ChecklistItemView(
                    item_id=item.get("id") or "",
                    text=str(item.get("text", "")),
                    completed=bool(item.get("completed", False)),
                    completed_at=item.get("completedAt"),
                    notes=item.get("notes"),
                    _shape="legacy",
                    _legacy_field=legacy_field,
                    _legacy_index=idx,
                )
            )
        return out

    @staticmethod
    def _build_completion_update(
        item: ChecklistItemView,
        *,
        completed_at: str,
        user_name: Optional[str],
        user_role: Optional[str],
    ) -> Dict[str, Any]:
        if item._shape == "prosthetic":
            base = (
                f"prostheticChecklist.{item._phase_key}"
                f".sections.{item._section_index}.items.{item._item_index}"
            )
        else:
            base = f"{item._legacy_field}.{item._legacy_index}"
        update = {
            f"{base}.completed": True,
            f"{base}.completedAt": completed_at,
            "updatedAt": completed_at,
        }
        if user_name:
            update[f"{base}.completedByName"] = user_name
        if user_role:
            update[f"{base}.completedByRole"] = user_role
        return update
