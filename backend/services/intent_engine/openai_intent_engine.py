"""OpenAI implementation of the IntentEngine interface.

Provider-specific concerns (SDK, prompts, JSON extraction) live ONLY here.
The controller never imports this module directly — it asks the factory for
an engine. Replace this implementation (or add a new one) by editing the
factory registry; the controller will not change.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
import uuid
from typing import Any, Dict, Optional

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
    "You are a strict command parser for a clinical procedure assistant.\n"
    "Map the dentist's voice transcript to one of these intents only:\n"
    f"{', '.join(_SUPPORTED_INTENTS)}.\n\n"
    "Reply with a SINGLE JSON object and NOTHING else. No prose, no\n"
    "markdown, no code fences. The object must have EXACTLY these fields:\n"
    "  - \"intent\": one of the values above\n"
    "  - \"confidence\": a number between 0.0 and 1.0\n"
    "  - \"entity\": a string naming the checklist item the user refers to,\n"
    "    or null when no item is implied\n"
    "  - \"parameters\": an object with command-specific fields, possibly\n"
    "    empty. For ADD_NOTE include {\"note\": \"<the note text>\"}.\n\n"
    "Intent semantics:\n"
    "- UPDATE_CHECKLIST: the user marks a step or item as complete or done.\n"
    "  `entity` MUST match a pending or completed item from the context\n"
    "  when one is clearly named or implied (e.g. 'next step' -> the\n"
    "  current step or first pending item). Use the item's exact name as\n"
    "  given in the context.\n"
    "- ADD_NOTE: the user wants to record a note. Put the actual note\n"
    "  content under parameters.note, stripping leading phrases like\n"
    "  'add note' or 'note that'. `entity` is null unless an item is named.\n"
    "- READ_NEXT_STEP: the user asks what comes next.\n"
    "- REPEAT_STEP: the user asks to repeat the current step.\n"
    "- FINISH_PROCEDURE: the user signals the procedure is complete.\n"
    "- UNKNOWN: anything else, or whenever you are unsure.\n\n"
    "If you cannot confidently match an intent, return\n"
    "{\"intent\":\"UNKNOWN\",\"confidence\":<your low score>,"
    "\"entity\":null,\"parameters\":{}}.\n"
    "Never invent checklist items that are not in the context.\n"
    "Return JSON only."
)

# Loose regex to find the first JSON object inside an LLM reply that may
# (against our wishes) include prose or markdown fences.
_JSON_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)
_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)


class OpenAIIntentEngine(IntentEngine):
    """Intent engine backed by emergentintegrations' OpenAI chat LLM.

    Environment:
        EMERGENT_LLM_KEY            - universal key (preferred)
        OPENAI_API_KEY              - direct OpenAI key
        INTENT_ENGINE_MODEL         - default 'gpt-5.4'
        INTENT_ENGINE_PROVIDER      - default 'openai'
        INTENT_ENGINE_TIMEOUT_SECONDS - default 15
    """

    name = "openai_intent_engine"

    def __init__(self) -> None:
        self._api_key = os.environ.get("EMERGENT_LLM_KEY") or os.environ.get("OPENAI_API_KEY")
        if not self._api_key:
            raise IntentEngineConfigurationError(
                "Neither EMERGENT_LLM_KEY nor OPENAI_API_KEY is set."
            )
        try:
            # Imported lazily so unit tests can stub it.
            from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: F401
        except Exception as exc:  # pragma: no cover
            raise IntentEngineConfigurationError(
                f"emergentintegrations is not installed correctly: {exc}"
            ) from exc

        self._provider = os.environ.get("INTENT_ENGINE_PROVIDER", "openai")
        self._model = os.environ.get("INTENT_ENGINE_MODEL", "gpt-5.4")
        self._timeout = float(os.environ.get("INTENT_ENGINE_TIMEOUT_SECONDS", "15"))

    # ------------------------------------------------------------------ #
    # IntentEngine interface                                              #
    # ------------------------------------------------------------------ #
    async def process(
        self,
        transcript: str,
        context: ProcedureContext,
    ) -> IntentResult:
        transcript = (transcript or "").strip()
        if not transcript:
            return IntentResult(transcript="", intent=IntentKind.UNKNOWN, confidence=0.0)

        user_prompt = self._build_user_prompt(transcript, context)
        started = time.perf_counter()
        try:
            raw_text = await asyncio.wait_for(
                self._invoke_llm(user_prompt),
                timeout=self._timeout,
            )
        except asyncio.TimeoutError:
            logger.warning("intent_engine timeout after %.1fs", self._timeout)
            return IntentResult(
                transcript=transcript,
                intent=IntentKind.UNKNOWN,
                confidence=0.0,
                parameters={"error": "timeout"},
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("intent_engine upstream failure: %s", exc)
            return IntentResult(
                transcript=transcript,
                intent=IntentKind.UNKNOWN,
                confidence=0.0,
                parameters={"error": "upstream"},
            )
        duration_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "intent_engine.process model=%s intent_ms=%d transcript_chars=%d",
            self._model,
            duration_ms,
            len(transcript),
        )

        return self.parse_response(transcript, raw_text)

    # ------------------------------------------------------------------ #
    # Prompt + parsing helpers (also used directly by unit tests)         #
    # ------------------------------------------------------------------ #
    @staticmethod
    def _build_user_prompt(transcript: str, context: ProcedureContext) -> str:
        return (
            f"{context.to_prompt_block()}\n\n"
            f"Transcript: \"{transcript}\"\n\n"
            "Return JSON only."
        )

    @staticmethod
    def parse_response(transcript: str, raw_text: Optional[str]) -> IntentResult:
        """Best-effort parse of an LLM reply into an IntentResult.

        Never raises. On any failure, returns UNKNOWN.
        """
        if not raw_text or not isinstance(raw_text, str):
            return IntentResult(transcript=transcript, intent=IntentKind.UNKNOWN, confidence=0.0)

        cleaned = _FENCE_RE.sub("", raw_text).strip()

        # Try direct JSON first; fall back to scanning for the first object.
        data: Optional[Dict[str, Any]] = None
        try:
            data = json.loads(cleaned)
        except Exception:
            match = _JSON_OBJECT_RE.search(cleaned)
            if match:
                try:
                    data = json.loads(match.group(0))
                except Exception:
                    data = None

        if not isinstance(data, dict):
            return IntentResult(transcript=transcript, intent=IntentKind.UNKNOWN, confidence=0.0)

        intent = IntentKind.coerce(data.get("intent"))
        confidence = data.get("confidence", 0.0)
        entity = data.get("entity")
        parameters = data.get("parameters") or {}
        if not isinstance(parameters, dict):
            parameters = {}

        return IntentResult(
            transcript=transcript,
            intent=intent,
            confidence=confidence,  # __post_init__ clamps
            entity=entity if isinstance(entity, str) and entity.strip() else None,
            parameters=parameters,
        )

    # ------------------------------------------------------------------ #
    # LLM call                                                            #
    # ------------------------------------------------------------------ #
    async def _invoke_llm(self, user_prompt: str) -> str:
        """Single-turn LLM call returning the raw assistant text.

        Intent classification is a one-shot structured-output task, so we
        use send_message (non-streaming) per the playbook's guidance.
        """
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        # Fresh session id per call: intent parsing is stateless.
        chat = LlmChat(
            api_key=self._api_key,
            session_id=f"intent-{uuid.uuid4()}",
            system_message=_SYSTEM_PROMPT,
        ).with_model(self._provider, self._model)

        response = await chat.send_message(UserMessage(text=user_prompt))
        return response or ""
