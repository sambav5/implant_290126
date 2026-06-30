"""Voice endpoints.

`POST /api/voice/transcribe`
    Step 2 - multipart `audio` field -> STT -> `{transcript}`.

`POST /api/voice/process`
    Step 3-5 - multipart `audio` + `procedureId` (+ optional JSON
    `context`) -> STT -> IntentEngine -> VoiceCommandOrchestrator ->
    domain services. AUTH REQUIRED (Step 5).

`POST /api/voice/confirm`
    Step 5 - confirmation endpoint for low-confidence commands. JSON body
    {procedureId, intent, entity, parameters?, transcript?} -> orchestrator
    is invoked with forced confidence 1.0, BYPASSING the gate. No STT or
    IntentEngine work is done. AUTH REQUIRED.

All three routes depend on stable abstractions
(`SpeechToTextProvider`, `IntentEngine`, `VoiceCommandOrchestrator`)
and contain no provider-specific imports. Audio is never persisted.
Every processed command is written to the `voice_command_audits`
collection via a fire-and-forget task.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, Field

from auth.security import get_current_user
from services.speech_to_text import (
    AudioTooLargeError,
    EmptyAudioError,
    ProviderConfigurationError,
    ProviderTimeoutError,
    ProviderUpstreamError,
    SpeechToTextError,
    SpeechToTextProvider,
    UnsupportedAudioFormatError,
    get_speech_to_text_provider,
)
from services.intent_engine import (
    IntentEngine,
    IntentEngineConfigurationError,
    IntentKind,
    IntentResult,
    ProcedureContext,
    get_intent_engine,
)
from services.voice_orchestrator import (
    ActionResult,
    VoiceCommandOrchestrator,
    get_voice_orchestrator,
)
from services.voice_audit_service import (
    VoiceAuditRecord,
    VoiceAuditService,
    get_voice_audit_service,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])

_IS_DEV = os.environ.get("APP_ENV", "development").lower() in {"dev", "development", "local"}


# --------------------------------------------------------------------------- #
# Response models                                                             #
# --------------------------------------------------------------------------- #
class TranscriptionMetrics(BaseModel):
    stt_ms: int
    server_total_ms: int
    upload_read_ms: int
    size_bytes: int


class TranscriptionResponse(BaseModel):
    success: bool
    transcript: str
    metrics: Optional[TranscriptionMetrics] = None


class ProcessVoiceMetrics(BaseModel):
    stt_ms: int
    intent_ms: int
    orchestrator_ms: int = 0
    server_total_ms: int
    upload_read_ms: int
    size_bytes: int


class VoiceActionPayload(BaseModel):
    type: str = "none"
    data: Dict[str, Any] = Field(default_factory=dict)


class ProcessVoiceResponse(BaseModel):
    # ----- legacy Step 3 fields (preserved verbatim) -----
    success: bool
    transcript: str
    intent: str
    confidence: float
    entity: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    metrics: Optional[ProcessVoiceMetrics] = None
    # ----- Step 4 additions (additive only) --------------
    requiresConfirmation: bool = False
    message: Optional[str] = None
    action: Optional[VoiceActionPayload] = None
    threshold: Optional[float] = None


# --------------------------------------------------------------------------- #
# Dependencies                                                                #
# --------------------------------------------------------------------------- #
def _stt_provider_dependency() -> SpeechToTextProvider:
    try:
        return get_speech_to_text_provider()
    except ProviderConfigurationError as exc:
        logger.error("Speech-to-Text not configured: %s", exc)
        raise HTTPException(status_code=503, detail=exc.user_message) from exc


def _intent_engine_dependency() -> IntentEngine:
    try:
        return get_intent_engine()
    except IntentEngineConfigurationError as exc:
        logger.error("Intent engine not configured: %s", exc)
        raise HTTPException(status_code=503, detail=exc.user_message) from exc


def _voice_orchestrator_dependency(request: Request) -> VoiceCommandOrchestrator:
    """Resolve the orchestrator using the Motor DB stored at app startup.

    The orchestrator owns NO state - it's a thin dispatcher over the
    three domain services. We never expose the DB to the route directly.
    """
    db = getattr(request.app.state, "db", None)
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Database is not available. Try again shortly.",
        )
    return get_voice_orchestrator(db)


def _current_user_optional(request: Request) -> Optional[Dict[str, Any]]:
    """Best-effort user resolution from the request state.

    Voice endpoints are intentionally open for MVP; if your auth
    middleware ever sets `request.state.user`, the orchestrator will
    pick it up and stamp writes with the user's identity.
    """
    user = getattr(request.state, "user", None)
    return user if isinstance(user, dict) else None


def _voice_audit_dependency(request: Request) -> VoiceAuditService:
    db = getattr(request.app.state, "db", None)
    if db is None:
        # Audit is best-effort; if the DB isn't available we use a NOOP.
        class _NullAudit:
            async def log(self, *_args, **_kwargs):
                return None
        return _NullAudit()  # type: ignore[return-value]
    return get_voice_audit_service(db)


async def _ensure_user_can_access_procedure(
    request: Request,
    procedure_id: str,
    current_user: Dict[str, Any],
) -> Dict[str, Any]:
    """Return the case document if the user is allowed to access it.

    Authorisation rules (Step 5):
      - 401 is already enforced by Depends(get_current_user).
      - 403 if the user's clinic does not own this case.
      - 404 if the case does not exist.

    The check resolves the user's clinic_id the same way the rest of
    the app does:  user.clinic_id  ->  user.id (clinic owner fallback).
    """
    db = request.app.state.db
    user_id = current_user.get("userId")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required.")

    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user_doc:
        # Token is valid but the user record is gone - treat as unauthed.
        raise HTTPException(status_code=401, detail="User not found.")
    clinic_id = user_doc.get("clinic_id") or user_doc.get("id")

    case = await db.cases.find_one({"id": procedure_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail=f"Procedure '{procedure_id}' not found.")

    case_clinic = case.get("clinic_id")
    if case_clinic and case_clinic != clinic_id:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to operate on this procedure.",
        )

    if case.get("case_status") == "completed":
        # Reads are allowed; writes are not. We surface 409 so the
        # frontend can show a friendly message. The orchestrator also
        # guards individual writes, but failing fast here saves a round
        # trip + LLM call.
        # NOTE: we DON'T raise here - reads (READ_NEXT_STEP, REPEAT_STEP)
        # are still meaningful. The orchestrator's individual handlers
        # raise on writes to already-completed procedures.
        pass

    return {
        "case": case,
        "user_doc": user_doc,
        "clinic_id": clinic_id,
    }


def _audit_user_fields(current_user: Optional[Dict[str, Any]], access: Optional[Dict[str, Any]]):
    user_id = (current_user or {}).get("userId") if current_user else None
    clinic_id = (access or {}).get("clinic_id") if access else None
    return user_id, clinic_id


def _user_for_orchestrator(
    current_user: Dict[str, Any],
    access: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    user_doc = (access or {}).get("user_doc") or {}
    return {
        "userId": current_user.get("userId"),
        "name": (
            user_doc.get("name")
            or current_user.get("clinicianName")
            or current_user.get("name")
        ),
        "role": user_doc.get("role"),
        "clinic_id": (access or {}).get("clinic_id"),
    }


def _schedule_audit(
    audit: VoiceAuditService,
    *,
    user_id: Optional[str],
    clinic_id: Optional[str],
    procedure_id: str,
    transcript: str,
    intent: str,
    confidence: float,
    entity: Optional[str],
    action: Dict[str, Any],
    success: bool,
    requires_confirmation: bool,
    execution_time_ms: int,
    source: str = "audio",
    error_code: Optional[str] = None,
    extras: Optional[Dict[str, Any]] = None,
) -> None:
    """Fire-and-forget audit write. NEVER raises, NEVER blocks the caller."""
    record = VoiceAuditRecord(
        user_id=user_id,
        clinic_id=clinic_id,
        procedure_id=procedure_id,
        transcript=transcript,
        intent=intent,
        confidence=confidence,
        entity=entity,
        action=action,
        success=success,
        requires_confirmation=requires_confirmation,
        execution_time_ms=execution_time_ms,
        source=source,
        error_code=error_code,
        extras=extras or {},
    )
    try:
        asyncio.create_task(audit.log(record))
    except RuntimeError:
        # No running loop (e.g. shutting down) - audit is best-effort.
        pass


# --------------------------------------------------------------------------- #
# Helpers                                                                     #
# --------------------------------------------------------------------------- #
async def _read_upload(audio: UploadFile) -> bytes:
    try:
        return await audio.read()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to read uploaded audio")
        raise HTTPException(status_code=400, detail="Unable to read uploaded audio.") from exc


async def _run_stt(
    provider: SpeechToTextProvider,
    audio_bytes: bytes,
    *,
    filename: str,
    content_type: Optional[str],
) -> str:
    """Delegate to the STT provider and map provider errors to HTTP errors."""
    try:
        result = await provider.transcribe(
            audio_bytes,
            filename=filename,
            content_type=content_type,
        )
    except EmptyAudioError as exc:
        raise HTTPException(status_code=400, detail=exc.user_message) from exc
    except AudioTooLargeError as exc:
        raise HTTPException(status_code=413, detail=exc.user_message) from exc
    except UnsupportedAudioFormatError as exc:
        raise HTTPException(status_code=415, detail=exc.user_message) from exc
    except ProviderTimeoutError as exc:
        raise HTTPException(status_code=504, detail=exc.user_message) from exc
    except ProviderConfigurationError as exc:
        raise HTTPException(status_code=503, detail=exc.user_message) from exc
    except ProviderUpstreamError as exc:
        raise HTTPException(status_code=502, detail=exc.user_message) from exc
    except SpeechToTextError as exc:
        raise HTTPException(status_code=500, detail=exc.user_message) from exc
    return (result.transcript or "").strip()


def _parse_context_field(
    procedure_id: str,
    context_json: Optional[str],
) -> ProcedureContext:
    """Parse the optional `context` form field into a ProcedureContext.

    The endpoint NEVER fetches context from the database. The frontend is
    the source of truth for what's currently on screen.
    """
    procedure_name: Optional[str] = None
    current_step: Optional[str] = None
    pending: List[str] = []
    completed: List[str] = []

    if context_json:
        try:
            parsed = json.loads(context_json)
        except Exception:  # noqa: BLE001
            parsed = None

        if isinstance(parsed, dict):
            procedure_name = _safe_str(parsed.get("procedureName"))
            current_step = _safe_str(parsed.get("currentStep"))
            pending = _safe_str_list(parsed.get("pendingItems"))
            completed = _safe_str_list(parsed.get("completedItems"))

    return ProcedureContext(
        procedure_id=procedure_id,
        procedure_name=procedure_name,
        current_step=current_step,
        pending_items=pending,
        completed_items=completed,
    )


def _safe_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    return s or None


def _safe_str_list(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    out: List[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
        elif item is not None:
            text = str(item).strip()
            if text:
                out.append(text)
    return out[:24]  # hard cap to keep prompts small


# --------------------------------------------------------------------------- #
# Endpoints                                                                   #
# --------------------------------------------------------------------------- #
@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_voice(
    audio: UploadFile = File(..., description="Audio blob (webm/mp3/m4a/wav/...)"),
    provider: SpeechToTextProvider = Depends(_stt_provider_dependency),
) -> TranscriptionResponse:
    """Transcribe an uploaded audio file. Audio is kept in memory only."""
    total_started = time.perf_counter()

    upload_started = time.perf_counter()
    audio_bytes = await _read_upload(audio)
    upload_ms = int((time.perf_counter() - upload_started) * 1000)

    if not audio_bytes:
        raise HTTPException(status_code=400, detail=EmptyAudioError.user_message)

    filename: str = audio.filename or "audio.webm"
    content_type: Optional[str] = audio.content_type
    size_bytes = len(audio_bytes)

    logger.info(
        "voice.transcribe upload_received provider=%s filename=%s content_type=%s size_bytes=%d upload_ms=%d",
        provider.name, filename, content_type, size_bytes, upload_ms,
    )

    stt_started = time.perf_counter()
    transcript = await _run_stt(
        provider, audio_bytes, filename=filename, content_type=content_type,
    )
    stt_ms = int((time.perf_counter() - stt_started) * 1000)
    total_ms = int((time.perf_counter() - total_started) * 1000)

    logger.info(
        "voice.transcribe completed provider=%s size_bytes=%d upload_ms=%d stt_ms=%d total_ms=%d transcript_chars=%d",
        provider.name, size_bytes, upload_ms, stt_ms, total_ms, len(transcript),
    )

    del audio_bytes  # never persist

    return TranscriptionResponse(
        success=True,
        transcript=transcript,
        metrics=TranscriptionMetrics(
            stt_ms=stt_ms,
            server_total_ms=total_ms,
            upload_read_ms=upload_ms,
            size_bytes=size_bytes,
        ),
    )


@router.post("/process", response_model=ProcessVoiceResponse)
async def process_voice(
    request: Request,
    audio: UploadFile = File(..., description="Audio blob (webm/mp3/m4a/wav/...)"),
    procedureId: str = Form(..., description="Identifier of the active procedure."),
    context: Optional[str] = Form(
        None,
        description=(
            "Optional JSON string with minimal procedure context (HINT ONLY - "
            "the orchestrator re-reads the canonical checklist from the DB): "
            '{"procedureName": str, "currentStep": str, '
            '"pendingItems": [str], "completedItems": [str]}.'
        ),
    ),
    stt_provider: SpeechToTextProvider = Depends(_stt_provider_dependency),
    intent_engine: IntentEngine = Depends(_intent_engine_dependency),
    orchestrator: VoiceCommandOrchestrator = Depends(_voice_orchestrator_dependency),
    audit: VoiceAuditService = Depends(_voice_audit_dependency),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ProcessVoiceResponse:
    """Transcribe -> classify intent -> orchestrate action -> return result.

    AUTH REQUIRED (Step 5). The caller must be authenticated AND their
    clinic must own the target procedure (HTTP 403 otherwise).

    Pipeline:
        upload bytes -> SpeechToText -> IntentEngine -> VoiceCommandOrchestrator
    The orchestrator delegates writes to ChecklistService / NotesService /
    ProcedureService. The controller itself performs NO DB I/O and contains
    NO business logic.

    The `context` form field is a HINT for the intent engine only (to help
    entity-name disambiguation). The orchestrator ignores it and re-reads
    the canonical checklist from MongoDB via ChecklistService - the
    backend is the source of truth.
    """
    total_started = time.perf_counter()

    # ---- 0) Authorise -------------------------------------------------
    try:
        access = await _ensure_user_can_access_procedure(
            request, procedureId, current_user,
        )
    except HTTPException as exc:
        # Audit-log the rejected attempt (best effort, no transcript).
        user_id, clinic_id = _audit_user_fields(current_user, None)
        _schedule_audit(
            audit,
            user_id=user_id, clinic_id=clinic_id,
            procedure_id=procedureId,
            transcript="", intent="UNKNOWN", confidence=0.0,
            entity=None,
            action={"type": "none", "status": "rejected", "requires_confirmation": False},
            success=False, requires_confirmation=False,
            execution_time_ms=int((time.perf_counter() - total_started) * 1000),
            error_code=str(exc.status_code),
        )
        raise

    # ---- 1) Read upload ------------------------------------------------
    upload_started = time.perf_counter()
    audio_bytes = await _read_upload(audio)
    upload_ms = int((time.perf_counter() - upload_started) * 1000)

    if not audio_bytes:
        raise HTTPException(status_code=400, detail=EmptyAudioError.user_message)

    filename: str = audio.filename or "audio.webm"
    content_type: Optional[str] = audio.content_type
    size_bytes = len(audio_bytes)

    if _IS_DEV:
        logger.info(
            "voice.process upload_received stt_provider=%s intent_engine=%s "
            "orchestrator=%s procedure_id=%s filename=%s content_type=%s "
            "size_bytes=%d upload_ms=%d user_id=%s",
            stt_provider.name, intent_engine.name, orchestrator.name,
            procedureId, filename, content_type, size_bytes, upload_ms,
            current_user.get("userId"),
        )

    # ---- 2) Speech to text --------------------------------------------
    stt_started = time.perf_counter()
    transcript = await _run_stt(
        stt_provider, audio_bytes, filename=filename, content_type=content_type,
    )
    stt_ms = int((time.perf_counter() - stt_started) * 1000)
    del audio_bytes  # never persist

    # If STT yielded nothing usable, short-circuit with UNKNOWN - do not
    # waste a model call.
    if not transcript:
        intent_result = IntentResult(
            transcript="",
            intent=IntentKind.UNKNOWN,
            confidence=0.0,
            parameters={"error": "empty_transcript"},
        )
        intent_ms = 0
    else:
        # ---- 3) Intent classification ---------------------------------
        proc_context = _parse_context_field(procedureId, context)
        intent_started = time.perf_counter()
        intent_result = await intent_engine.process(transcript, proc_context)
        intent_ms = int((time.perf_counter() - intent_started) * 1000)

    # ---- 4) Orchestration (confidence gate + dispatch) ----------------
    orch_started = time.perf_counter()
    action_result: ActionResult = await orchestrator.execute(
        intent_result,
        procedure_id=procedureId,
        user=_user_for_orchestrator(current_user, access),
    )
    orch_ms = int((time.perf_counter() - orch_started) * 1000)

    total_ms = int((time.perf_counter() - total_started) * 1000)

    # ---- 5) Audit (fire-and-forget; never blocks) ---------------------
    user_id, clinic_id = _audit_user_fields(current_user, access)
    _schedule_audit(
        audit,
        user_id=user_id, clinic_id=clinic_id,
        procedure_id=procedureId,
        transcript=intent_result.transcript,
        intent=intent_result.intent.value,
        confidence=intent_result.confidence,
        entity=intent_result.entity,
        action={
            "type": action_result.action.type.value,
            "status": action_result.status.value,
            "requires_confirmation": action_result.requires_confirmation,
        },
        success=action_result.success,
        requires_confirmation=action_result.requires_confirmation,
        execution_time_ms=total_ms,
        source="audio",
    )

    if _IS_DEV:
        logger.info(
            "voice.process completed stt_provider=%s intent_engine=%s "
            "orchestrator=%s procedure_id=%s size_bytes=%d upload_ms=%d "
            "stt_ms=%d intent_ms=%d orch_ms=%d total_ms=%d "
            "transcript_chars=%d intent=%s confidence=%.3f "
            "threshold=%.2f action_status=%s action_type=%s "
            "requires_confirmation=%s audit_scheduled=true user_id=%s",
            stt_provider.name, intent_engine.name, orchestrator.name,
            procedureId, size_bytes, upload_ms, stt_ms, intent_ms, orch_ms,
            total_ms, len(transcript),
            intent_result.intent.value, intent_result.confidence,
            action_result.threshold, action_result.status.value,
            action_result.action.type.value, action_result.requires_confirmation,
            current_user.get("userId"),
        )

    return ProcessVoiceResponse(
        success=action_result.success,
        transcript=intent_result.transcript,
        intent=intent_result.intent.value,
        confidence=round(intent_result.confidence, 4),
        entity=intent_result.entity,
        parameters=intent_result.parameters or {},
        metrics=ProcessVoiceMetrics(
            stt_ms=stt_ms,
            intent_ms=intent_ms,
            orchestrator_ms=orch_ms,
            server_total_ms=total_ms,
            upload_read_ms=upload_ms,
            size_bytes=size_bytes,
        ),
        requiresConfirmation=action_result.requires_confirmation,
        message=action_result.message,
        action=VoiceActionPayload(
            type=action_result.action.type.value,
            data=action_result.action.data,
        ),
        threshold=action_result.threshold,
    )


# --------------------------------------------------------------------------- #
# Confirmation endpoint (Step 5)                                              #
# --------------------------------------------------------------------------- #
class ConfirmVoiceRequest(BaseModel):
    procedureId: str = Field(..., min_length=1)
    intent: str = Field(..., description="One of the supported IntentKind values.")
    entity: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    transcript: Optional[str] = Field(
        default=None,
        description="Original transcript (audit only - not re-classified).",
    )


@router.post("/confirm", response_model=ProcessVoiceResponse)
async def confirm_voice_action(
    request: Request,
    body: ConfirmVoiceRequest,
    orchestrator: VoiceCommandOrchestrator = Depends(_voice_orchestrator_dependency),
    audit: VoiceAuditService = Depends(_voice_audit_dependency),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ProcessVoiceResponse:
    """Execute a previously-low-confidence intent that the user confirmed.

    No STT, no IntentEngine. The orchestrator is called with confidence
    1.0 so the gate is satisfied. AUTH + procedure-ownership rules are
    identical to /process. Every confirmation is audited.
    """
    total_started = time.perf_counter()

    access = await _ensure_user_can_access_procedure(
        request, body.procedureId, current_user,
    )

    # Coerce the intent label; default to UNKNOWN if the client sent garbage.
    try:
        intent_kind = IntentKind(body.intent)
    except ValueError:
        intent_kind = IntentKind.UNKNOWN

    forced = IntentResult(
        transcript=body.transcript or "",
        intent=intent_kind,
        confidence=1.0,
        entity=body.entity,
        parameters=body.parameters or {},
    )

    orch_started = time.perf_counter()
    action_result: ActionResult = await orchestrator.execute(
        forced,
        procedure_id=body.procedureId,
        user=_user_for_orchestrator(current_user, access),
    )
    orch_ms = int((time.perf_counter() - orch_started) * 1000)
    total_ms = int((time.perf_counter() - total_started) * 1000)

    user_id, clinic_id = _audit_user_fields(current_user, access)
    _schedule_audit(
        audit,
        user_id=user_id, clinic_id=clinic_id,
        procedure_id=body.procedureId,
        transcript=forced.transcript,
        intent=forced.intent.value,
        confidence=forced.confidence,
        entity=forced.entity,
        action={
            "type": action_result.action.type.value,
            "status": action_result.status.value,
            "requires_confirmation": action_result.requires_confirmation,
        },
        success=action_result.success,
        requires_confirmation=action_result.requires_confirmation,
        execution_time_ms=total_ms,
        source="confirm",
    )

    if _IS_DEV:
        logger.info(
            "voice.confirm completed orchestrator=%s procedure_id=%s "
            "orch_ms=%d total_ms=%d intent=%s entity=%r action_status=%s "
            "action_type=%s success=%s user_id=%s",
            orchestrator.name, body.procedureId, orch_ms, total_ms,
            forced.intent.value, forced.entity, action_result.status.value,
            action_result.action.type.value, action_result.success,
            current_user.get("userId"),
        )

    return ProcessVoiceResponse(
        success=action_result.success,
        transcript=forced.transcript,
        intent=forced.intent.value,
        confidence=round(forced.confidence, 4),
        entity=forced.entity,
        parameters=forced.parameters or {},
        metrics=ProcessVoiceMetrics(
            stt_ms=0, intent_ms=0, orchestrator_ms=orch_ms,
            server_total_ms=total_ms, upload_read_ms=0, size_bytes=0,
        ),
        requiresConfirmation=action_result.requires_confirmation,
        message=action_result.message,
        action=VoiceActionPayload(
            type=action_result.action.type.value,
            data=action_result.action.data,
        ),
        threshold=action_result.threshold,
    )
