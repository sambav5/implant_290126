"""Voice endpoints.

`POST /api/voice/transcribe`
    Step 2 — multipart `audio` field → STT → `{transcript}`.

`POST /api/voice/process`
    Step 3 — multipart `audio` + `procedureId` (+ optional JSON `context`) →
    STT → IntentEngine → structured `IntentResult` JSON.

Both routes depend ONLY on the `SpeechToTextProvider` abstraction
(Step 2) and the `IntentEngine` abstraction (Step 3). They have no
provider-specific imports and never touch the database, the checklist
service, or any business state.

Non-goals (explicitly excluded for Step 3):
- Persisting audio or transcripts
- Updating checklists / saving notes / mutating any DB collection
- Conversational LLM behaviour beyond strict JSON command parsing
"""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

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
) -> ProcessVoiceResponse:
    """Transcribe -> classify intent -> orchestrate action -> return result.

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
            "size_bytes=%d upload_ms=%d",
            stt_provider.name, intent_engine.name, orchestrator.name,
            procedureId, filename, content_type, size_bytes, upload_ms,
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
    user = _current_user_optional(request)
    orch_started = time.perf_counter()
    action_result: ActionResult = await orchestrator.execute(
        intent_result,
        procedure_id=procedureId,
        user=user,
    )
    orch_ms = int((time.perf_counter() - orch_started) * 1000)

    total_ms = int((time.perf_counter() - total_started) * 1000)

    if _IS_DEV:
        logger.info(
            "voice.process completed stt_provider=%s intent_engine=%s "
            "orchestrator=%s procedure_id=%s size_bytes=%d upload_ms=%d "
            "stt_ms=%d intent_ms=%d orch_ms=%d total_ms=%d "
            "transcript_chars=%d intent=%s confidence=%.3f "
            "threshold=%.2f action_status=%s action_type=%s "
            "requires_confirmation=%s",
            stt_provider.name, intent_engine.name, orchestrator.name,
            procedureId, size_bytes, upload_ms, stt_ms, intent_ms, orch_ms,
            total_ms, len(transcript),
            intent_result.intent.value, intent_result.confidence,
            action_result.threshold, action_result.status.value,
            action_result.action.type.value, action_result.requires_confirmation,
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
