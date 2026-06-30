"""NotesService — owns creation of voice-originated procedure notes.

Notes are stored in a dedicated `procedure_notes` collection so they
remain auditable and queryable independently of the case document.
The orchestrator never writes here directly.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


class NotesError(Exception):
    user_message: str = "Note operation failed."

    def __init__(self, message: str = "", user_message: Optional[str] = None):
        super().__init__(message or user_message or self.user_message)
        if user_message:
            self.user_message = user_message


class EmptyNoteError(NotesError):
    user_message = "Note text was empty."


@dataclass
class ProcedureNote:
    note_id: str
    procedure_id: str
    text: str
    created_at: str
    item_id: Optional[str] = None
    item_text: Optional[str] = None
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    source: str = "voice"

    def to_public(self) -> Dict[str, Any]:
        return {
            "noteId": self.note_id,
            "procedureId": self.procedure_id,
            "text": self.text,
            "createdAt": self.created_at,
            "itemId": self.item_id,
            "itemText": self.item_text,
            "authorId": self.author_id,
            "authorName": self.author_name,
            "source": self.source,
        }


class NotesService:
    """Owns the procedure_notes collection."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self._db = db
        self._notes = db.procedure_notes

    async def add_note(
        self,
        *,
        procedure_id: str,
        text: str,
        item_id: Optional[str] = None,
        item_text: Optional[str] = None,
        author_id: Optional[str] = None,
        author_name: Optional[str] = None,
    ) -> ProcedureNote:
        clean = (text or "").strip()
        if not clean:
            raise EmptyNoteError(user_message="Cannot add an empty note.")

        note = ProcedureNote(
            note_id=str(uuid.uuid4()),
            procedure_id=procedure_id,
            text=clean,
            created_at=datetime.now(timezone.utc).isoformat(),
            item_id=item_id,
            item_text=item_text,
            author_id=author_id,
            author_name=author_name,
            source="voice",
        )
        await self._notes.insert_one(
            {
                "id": note.note_id,
                "procedure_id": note.procedure_id,
                "text": note.text,
                "created_at": note.created_at,
                "item_id": note.item_id,
                "item_text": note.item_text,
                "author_id": note.author_id,
                "author_name": note.author_name,
                "source": note.source,
            }
        )
        return note

    async def ensure_indexes(self) -> None:
        await self._notes.create_index("id", unique=True)
        await self._notes.create_index("procedure_id")
        await self._notes.create_index("created_at")
