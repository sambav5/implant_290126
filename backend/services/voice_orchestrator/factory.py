"""Factory that wires the orchestrator with its three domain services.

Called once per process via FastAPI Depends; the result is cached for the
lifetime of the application.
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from services.checklist_service import ChecklistService
from services.notes_service import NotesService
from services.procedure_service import ProcedureService

from .base import VoiceCommandOrchestrator
from .orchestrator import DefaultVoiceCommandOrchestrator

logger = logging.getLogger(__name__)

_DEFAULT_THRESHOLD = 0.90

_singleton: Optional[VoiceCommandOrchestrator] = None


def _read_threshold() -> float:
    raw = os.environ.get("VOICE_CONFIDENCE_THRESHOLD")
    if raw is None or raw.strip() == "":
        return _DEFAULT_THRESHOLD
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return _DEFAULT_THRESHOLD
    return max(0.0, min(1.0, value))


def get_voice_orchestrator(db: AsyncIOMotorDatabase) -> VoiceCommandOrchestrator:
    """Return the process-wide orchestrator singleton.

    `db` is captured on first construction.  This is intentional: the
    Motor client/db is created once at server startup, so caching by
    identity is safe. If you ever swap DBs at runtime (tests), call
    `reset_voice_orchestrator_cache()` first.
    """
    global _singleton
    if _singleton is not None:
        return _singleton

    checklist_service = ChecklistService(db)
    notes_service = NotesService(db)
    procedure_service = ProcedureService(
        db, checklist_service=checklist_service,
    )
    threshold = _read_threshold()
    orchestrator = DefaultVoiceCommandOrchestrator(
        checklist_service=checklist_service,
        notes_service=notes_service,
        procedure_service=procedure_service,
        confidence_threshold=threshold,
    )
    logger.info(
        "VoiceCommandOrchestrator initialised: name=%s threshold=%.2f",
        orchestrator.name, threshold,
    )
    _singleton = orchestrator
    return _singleton


def reset_voice_orchestrator_cache() -> None:
    """Test helper — forget the cached singleton."""
    global _singleton
    _singleton = None
