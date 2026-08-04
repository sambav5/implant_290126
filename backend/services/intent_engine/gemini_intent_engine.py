"""Google Gemini implementation of the IntentEngine interface.

Uses Gemini API with JSON schema mode to parse transcripts into structured clinical intents.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, Optional

import requests

from .base import (
    IntentEngine,
    IntentEngineConfigurationError,
    IntentKind,
    IntentResult,
    ProcedureContext,
)

logger = logging.getLogger(__name__)

_SUPPORTED_INTENTS = [k.value for k in IntentKind]

_SYSTEM_PROMPT = (
    "You are a strict clinical command parser for a dental procedure assistant.\n"
    "Your job: map the user's transcript to EXACTLY ONE of these intent labels:\n"
    f"{', '.join(_SUPPORTED_INTENTS)}.\n"
    "Output MUST be valid JSON with fields: intent, confidence (0.0-1.0), entity, parameters.\n"
    "If user marks a step complete: intent = UPDATE_CHECKLIST.\n"
    "If user asks for next step: intent = READ_NEXT_STEP.\n"
    "If user asks to repeat: intent = REPEAT_STEP.\n"
    "If user adds a note: intent = ADD_NOTE, with parameters.note.\n"
    "If user finishes procedure: intent = FINISH_PROCEDURE.\n"
    "Otherwise: intent = UNKNOWN."
)


class GeminiIntentEngine(IntentEngine):
    """Intent engine backed by Google Gemini API."""

    name = "gemini_intent_engine"

    def __init__(self) -> None:
        self.api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        self.model = os.environ.get("GEMINI_INTENT_MODEL", "gemini-2.5-flash")

        if not self.api_key or "mock" in str(self.api_key).lower():
            logger.warning("GEMINI_API_KEY / GOOGLE_API_KEY missing or mock. Gemini IntentEngine running in mock mode.")
            self._has_key = False
        else:
            self._has_key = True

    async def process(
        self,
        transcript: str,
        context: ProcedureContext,
    ) -> IntentResult:
        transcript = (transcript or "").strip()
        if not transcript:
            return IntentResult(transcript="", intent=IntentKind.UNKNOWN, confidence=0.0)

        if not self._has_key:
            lowered = transcript.lower()
            entity = context.current_step if context and context.current_step else None
            if "done" in lowered or "complete" in lowered or "mark" in lowered:
                return IntentResult(transcript=transcript, intent=IntentKind.UPDATE_CHECKLIST, confidence=0.95, entity=entity)
            elif "next" in lowered or "proceed" in lowered or "ahead" in lowered:
                return IntentResult(transcript=transcript, intent=IntentKind.READ_NEXT_STEP, confidence=0.95)
            elif "repeat" in lowered:
                return IntentResult(transcript=transcript, intent=IntentKind.REPEAT_STEP, confidence=0.95, entity=entity)
            elif "note" in lowered:
                return IntentResult(transcript=transcript, intent=IntentKind.ADD_NOTE, confidence=0.95, parameters={"note": transcript})
            else:
                return IntentResult(transcript=transcript, intent=IntentKind.UPDATE_CHECKLIST, confidence=0.90, entity=entity)

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

        prompt_text = f"{_SYSTEM_PROMPT}\n\nContext:\n{context.to_prompt_block()}\n\nTranscript: \"{transcript}\""

        payload = {
            "contents": [{"parts": [{"text": prompt_text}]}],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1,
            }
        }

        started = time.perf_counter()
        try:
            res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=15)
            if not res.ok:
                logger.error(f"Gemini Intent Engine error ({res.status_code}): {res.text}")
                if res.status_code == 429:
                    logger.warning("Gemini API Rate Limit / Quota Exceeded (429). Falling back to offline rule parser.")
                    return self._local_fallback_parse(transcript, context)
                return IntentResult(transcript=transcript, intent=IntentKind.UNKNOWN, confidence=0.0)

            data = res.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return IntentResult(transcript=transcript, intent=IntentKind.UNKNOWN, confidence=0.0)

            parts = candidates[0].get("content", {}).get("parts", [])
            raw_json_str = "".join(p.get("text", "") for p in parts).strip()
            
            parsed = json.loads(raw_json_str)
            raw_intent = parsed.get("intent", "UNKNOWN")
            intent = IntentKind.coerce(raw_intent)
            confidence = float(parsed.get("confidence", 0.9))
            entity = parsed.get("entity")
            parameters = parsed.get("parameters", {})

            # Default to active current step if updating checklist with empty entity
            if intent == IntentKind.UPDATE_CHECKLIST and not entity:
                entity = context.current_step if context else None

            # Smart fallback for clinical voice commands if model returned UNKNOWN
            if intent == IntentKind.UNKNOWN and transcript:
                lowered = transcript.lower()
                entity = entity or (context.current_step if context and context.current_step else None)
                if any(w in lowered for w in ["done", "complete", "mark", "finish", "yes", "ok", "completed"]):
                    intent = IntentKind.UPDATE_CHECKLIST
                    confidence = 0.92
                elif any(w in lowered for w in ["next", "proceed", "ahead", "continue"]):
                    intent = IntentKind.READ_NEXT_STEP
                    confidence = 0.92
                elif "repeat" in lowered:
                    intent = IntentKind.REPEAT_STEP
                    confidence = 0.92
                elif "note" in lowered:
                    intent = IntentKind.ADD_NOTE
                    confidence = 0.92
                    parameters = {"note": transcript}

            logger.info("Gemini Intent Engine resolved intent: %s (confidence: %.2f, entity: %s)", intent.value, confidence, entity)

            return IntentResult(
                transcript=transcript,
                intent=intent,
                confidence=confidence,
                entity=entity,
                parameters=parameters if isinstance(parameters, dict) else {},
            )
        except Exception as exc:
            logger.exception(f"Gemini Intent Engine processing failed: {exc}")
            return IntentResult(transcript=transcript, intent=IntentKind.UNKNOWN, confidence=0.0)

    def _local_fallback_parse(self, transcript: str, context: ProcedureContext) -> IntentResult:
        lowered = transcript.lower()
        entity = context.current_step if context and context.current_step else None
        if any(w in lowered for w in ["done", "complete", "mark", "finish", "yes", "ok", "completed"]):
            return IntentResult(transcript=transcript, intent=IntentKind.UPDATE_CHECKLIST, confidence=0.95, entity=entity)
        elif any(w in lowered for w in ["next", "proceed", "ahead", "continue"]):
            return IntentResult(transcript=transcript, intent=IntentKind.READ_NEXT_STEP, confidence=0.95)
        elif "repeat" in lowered:
            return IntentResult(transcript=transcript, intent=IntentKind.REPEAT_STEP, confidence=0.95, entity=entity)
        elif "note" in lowered:
            return IntentResult(transcript=transcript, intent=IntentKind.ADD_NOTE, confidence=0.95, parameters={"note": transcript})
        else:
            return IntentResult(transcript=transcript, intent=IntentKind.UPDATE_CHECKLIST, confidence=0.90, entity=entity)
