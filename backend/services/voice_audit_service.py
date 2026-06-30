"""VoiceAuditService - fire-and-forget logger for every voice command.

Writes one row per processed command into the `voice_command_audits`
collection. The service exposes a single `log(...)` coroutine that is
ALWAYS safe to await - it swallows ALL exceptions internally so audit
failures cannot break the voice workflow.

Fields stored (per row):
  id                 UUID
  timestamp          ISO-8601 UTC
  userId             from current_user["id"] (None if endpoint runs unauthed)
  clinicId           from current_user["clinic_id"]
  procedureId        procedureId from the request
  source             "audio" | "confirm"
  transcript         the STT transcript (may be empty)
  intent             IntentKind.value
  confidence         float in [0,1]
  entity             matched entity (or None)
  action             {type, status, requires_confirmation}
  success            boolean (orchestrator's final success)
  requiresConfirmation  boolean (mirrors action.requires_confirmation)
  executionTimeMs    total server-side time
  errorCode          optional - set when the workflow failed BEFORE
                     reaching the orchestrator (e.g. 401, 403, 400)

Raw audio bytes are NEVER persisted. Only metadata.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


@dataclass
class VoiceAuditRecord:
    user_id: Optional[str]
    clinic_id: Optional[str]
    procedure_id: str
    transcript: str
    intent: str
    confidence: float
    entity: Optional[str]
    action: Dict[str, Any]
    success: bool
    requires_confirmation: bool
    execution_time_ms: int
    source: str = "audio"            # "audio" or "confirm"
    error_code: Optional[str] = None
    extras: Dict[str, Any] = field(default_factory=dict)

    def to_doc(self) -> Dict[str, Any]:
        return {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": self.user_id,
            "clinic_id": self.clinic_id,
            "procedure_id": self.procedure_id,
            "source": self.source,
            "transcript": self.transcript,
            "intent": self.intent,
            "confidence": float(self.confidence),
            "entity": self.entity,
            "action": self.action,
            "success": bool(self.success),
            "requires_confirmation": bool(self.requires_confirmation),
            "execution_time_ms": int(self.execution_time_ms),
            "error_code": self.error_code,
            "extras": self.extras,
        }


class VoiceAuditService:
    """Owns the voice_command_audits collection."""

    COLLECTION = "voice_command_audits"

    def __init__(self, db: AsyncIOMotorDatabase):
        self._db = db
        self._coll = db[self.COLLECTION]

    async def log(self, record: VoiceAuditRecord) -> None:
        """Persist one audit row. NEVER raises."""
        try:
            await self._coll.insert_one(record.to_doc())
        except Exception:  # noqa: BLE001  - audit is best-effort
            # We log at WARNING (not ERROR) because audit failures must
            # never look like real errors to ops; they're recoverable.
            logger.warning(
                "voice_audit insert failed (suppressed) "
                "procedure_id=%s intent=%s success=%s",
                record.procedure_id, record.intent, record.success,
                exc_info=True,
            )

    async def ensure_indexes(self) -> None:
        try:
            await self._coll.create_index("id", unique=True)
            await self._coll.create_index("procedure_id")
            await self._coll.create_index("user_id")
            await self._coll.create_index([("timestamp", -1)])
        except Exception:  # noqa: BLE001
            logger.warning("voice_audit index creation failed", exc_info=True)


# --------------------------------------------------------------------------- #
# Module-level singleton (one per process)                                    #
# --------------------------------------------------------------------------- #
_singleton: Optional[VoiceAuditService] = None


def get_voice_audit_service(db: AsyncIOMotorDatabase) -> VoiceAuditService:
    global _singleton
    if _singleton is None:
        _singleton = VoiceAuditService(db)
    return _singleton


def reset_voice_audit_service_cache() -> None:
    global _singleton
    _singleton = None
