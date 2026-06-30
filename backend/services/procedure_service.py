"""ProcedureService — owns procedure-level state transitions.

For voice MVP this is narrow: only `finish_procedure` is exposed. The
service enforces validation rules; it refuses to finish a procedure if
any checklist item is still pending.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from .checklist_service import (
    ChecklistService,
    ProcedureNotFoundError,
)

logger = logging.getLogger(__name__)


class ProcedureError(Exception):
    user_message: str = "Procedure operation failed."

    def __init__(self, message: str = "", user_message: Optional[str] = None):
        super().__init__(message or user_message or self.user_message)
        if user_message:
            self.user_message = user_message


class ProcedureValidationError(ProcedureError):
    user_message = "Procedure cannot be finished yet."

    def __init__(
        self,
        *,
        pending_items: List[str],
        message: str = "",
    ):
        self.pending_items = pending_items
        if pending_items:
            count = len(pending_items)
            user_msg = (
                f"Cannot finish: {count} item{'s' if count != 1 else ''} "
                f"still pending."
            )
        else:
            user_msg = "Procedure cannot be finished."
        super().__init__(message=message, user_message=user_msg)


@dataclass
class ProcedureCompletionResult:
    procedure_id: str
    procedure_name: Optional[str]
    completed_at: str
    total_items: int

    def to_public(self) -> Dict[str, Any]:
        return {
            "procedureId": self.procedure_id,
            "procedureName": self.procedure_name,
            "completedAt": self.completed_at,
            "totalItems": self.total_items,
        }


class ProcedureService:
    """Owns procedure-level mutations (start / finish / status).

    Currently only `finish_procedure` is implemented for voice MVP.
    """

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        *,
        checklist_service: ChecklistService,
    ):
        self._db = db
        self._cases = db.cases
        self._checklist = checklist_service

    async def finish_procedure(
        self,
        procedure_id: str,
        *,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
    ) -> ProcedureCompletionResult:
        view = await self._checklist.get_checklist(procedure_id)
        pending = [i.text for i in view.pending]
        if pending:
            raise ProcedureValidationError(pending_items=pending)

        completed_at = datetime.now(timezone.utc).isoformat()
        update = {
            "case_status": "completed",
            "completedAt": completed_at,
            "updatedAt": completed_at,
        }
        if user_name:
            update["completedByName"] = user_name
        if user_id:
            update["completedById"] = user_id
        result = await self._cases.update_one({"id": procedure_id}, {"$set": update})
        if result.matched_count == 0:
            raise ProcedureNotFoundError(
                user_message="Procedure not found.",
            )

        return ProcedureCompletionResult(
            procedure_id=procedure_id,
            procedure_name=view.procedure_name,
            completed_at=completed_at,
            total_items=len(view.items),
        )
