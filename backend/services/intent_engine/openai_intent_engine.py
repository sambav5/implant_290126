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

# NOTE: This prompt is deliberately verbose. The model is small, and verbose
# rule lists materially reduce drift on ambiguous short commands. Token
# budget per call is still <500 input tokens for typical procedures.
_SYSTEM_PROMPT = (
    "You are a strict, deterministic command parser for a clinical "
    "procedure assistant used during dental procedures.\n"
    "Your only job: map the dentist's transcript to EXACTLY ONE of these "
    "intent labels and return a single JSON object.\n"
    f"Allowed intents (closed set): {', '.join(_SUPPORTED_INTENTS)}.\n"
    "You MUST always return one of these labels. If unsure, return UNKNOWN.\n\n"
    "OUTPUT FORMAT (HARD RULES):\n"
    "- Return ONE JSON object and nothing else. No prose. No markdown. No "
    "code fences. No leading or trailing text.\n"
    "- The JSON object must have EXACTLY these four fields:\n"
    '    "intent":     one of the allowed labels above (string)\n'
    '    "confidence": number in [0.0, 1.0]\n'
    '    "entity":     string naming a checklist item from the context, or null\n'
    '    "parameters": object (may be empty)\n'
    "- For ADD_NOTE, parameters MUST include {\"note\": \"<note text>\"}.\n"
    "- Never invent checklist items that are not present in the context.\n\n"
    "INTENT SEMANTICS:\n"
    "- UPDATE_CHECKLIST: the user marks a step/item as complete or done.\n"
    "    Use the item's exact name from the context as `entity`. If the\n"
    "    user does not name an item but clearly refers to the current\n"
    "    step (e.g. 'done', 'completed', 'that's done', 'mark it done'),\n"
    "    set `entity` to the Current Step from the context.\n"
    "- ADD_NOTE: the user wants to record a note. Strip leading phrases\n"
    "    like 'add note', 'note that', 'make a note'. Put the actual note\n"
    "    content under parameters.note. `entity` is null unless a\n"
    "    specific item is named (then use the item's exact name).\n"
    "- READ_NEXT_STEP: the user asks what comes next or signals they\n"
    "    want to advance WITHOUT explicitly marking something done.\n"
    "- REPEAT_STEP: the user asks to repeat / say again the current step.\n"
    "    Set `entity` to the Current Step from the context.\n"
    "- FINISH_PROCEDURE: the user signals the WHOLE procedure is over.\n"
    "    Requires words like 'procedure', 'we're done here', 'finished\n"
    "    the procedure', 'wrap up', 'end procedure'. Do NOT use this\n"
    "    just because the user said 'done' or 'finish'.\n"
    "- UNKNOWN: anything that does not clearly map above; off-topic\n"
    "    requests; very short ambiguous words like 'stop', 'pause',\n"
    "    'wait', 'cancel'. Use low confidence (<= 0.3).\n\n"
    "DISAMBIGUATION RULES (apply in order):\n"
    "1. If the transcript names a specific checklist item AND a\n"
    "   completion verb (complete, done, finished, mark...) -> UPDATE_CHECKLIST.\n"
    "2. If the transcript is a bare completion signal with NO item named\n"
    "   ('done', 'completed', 'that's done', 'mark it done', 'mark done',\n"
    "   'check it off', 'tick it off') -> UPDATE_CHECKLIST with\n"
    "   entity = Current Step.\n"
    "3. If the transcript is an advance signal ('next', 'what's next',\n"
    "   'move on', 'continue', 'go ahead', 'proceed', 'go on', 'and then',\n"
    "   'after this') -> READ_NEXT_STEP, entity = null.\n"
    "4. If the transcript is a repeat signal ('repeat', 'say that again',\n"
    "   'read that again', 'repeat the last step', 'one more time') ->\n"
    "   REPEAT_STEP, entity = Current Step.\n"
    "5. Bare 'finish': prefer UPDATE_CHECKLIST(entity=Current Step) unless\n"
    "   the word 'procedure' or a procedure-ending phrase is present, in\n"
    "   which case FINISH_PROCEDURE.\n"
    "6. 'stop', 'pause', 'wait', 'cancel', 'hold on', 'never mind' alone\n"
    "   -> UNKNOWN with confidence <= 0.3. These are destructive if\n"
    "   misinterpreted.\n"
    "7. Anything off-topic (food, weather, jokes) -> UNKNOWN with\n"
    "   confidence <= 0.1.\n\n"
    "CONFIDENCE GUIDANCE:\n"
    "- 0.95+ when the transcript is unambiguous and matches a rule above.\n"
    "- 0.80-0.94 when the intent is clear but the entity inference\n"
    "  required context.\n"
    "- 0.50-0.79 when meaning is plausible but could be misheard.\n"
    "- < 0.50 only when you are returning UNKNOWN.\n\n"
    "FEW-SHOT EXAMPLES (assume context with Current Step = \"Working Length\"\n"
    "and pending items including \"Canal Preparation\", \"Irrigation\"):\n"
    "Input: \"Mark working length complete\"\n"
    "Output: {\"intent\":\"UPDATE_CHECKLIST\",\"confidence\":0.98,"
    "\"entity\":\"Working Length\",\"parameters\":{}}\n"
    "Input: \"Done\"\n"
    "Output: {\"intent\":\"UPDATE_CHECKLIST\",\"confidence\":0.95,"
    "\"entity\":\"Working Length\",\"parameters\":{}}\n"
    "Input: \"That's done\"\n"
    "Output: {\"intent\":\"UPDATE_CHECKLIST\",\"confidence\":0.95,"
    "\"entity\":\"Working Length\",\"parameters\":{}}\n"
    "Input: \"Mark it done\"\n"
    "Output: {\"intent\":\"UPDATE_CHECKLIST\",\"confidence\":0.95,"
    "\"entity\":\"Working Length\",\"parameters\":{}}\n"
    "Input: \"Completed\"\n"
    "Output: {\"intent\":\"UPDATE_CHECKLIST\",\"confidence\":0.95,"
    "\"entity\":\"Working Length\",\"parameters\":{}}\n"
    "Input: \"Finish\"\n"
    "Output: {\"intent\":\"UPDATE_CHECKLIST\",\"confidence\":0.9,"
    "\"entity\":\"Working Length\",\"parameters\":{}}\n"
    "Input: \"Next\"\n"
    "Output: {\"intent\":\"READ_NEXT_STEP\",\"confidence\":0.97,"
    "\"entity\":null,\"parameters\":{}}\n"
    "Input: \"What's next\"\n"
    "Output: {\"intent\":\"READ_NEXT_STEP\",\"confidence\":0.98,"
    "\"entity\":null,\"parameters\":{}}\n"
    "Input: \"Move on\"\n"
    "Output: {\"intent\":\"READ_NEXT_STEP\",\"confidence\":0.95,"
    "\"entity\":null,\"parameters\":{}}\n"
    "Input: \"Continue\"\n"
    "Output: {\"intent\":\"READ_NEXT_STEP\",\"confidence\":0.95,"
    "\"entity\":null,\"parameters\":{}}\n"
    "Input: \"Go ahead\"\n"
    "Output: {\"intent\":\"READ_NEXT_STEP\",\"confidence\":0.93,"
    "\"entity\":null,\"parameters\":{}}\n"
    "Input: \"Proceed\"\n"
    "Output: {\"intent\":\"READ_NEXT_STEP\",\"confidence\":0.93,"
    "\"entity\":null,\"parameters\":{}}\n"
    "Input: \"Repeat\"\n"
    "Output: {\"intent\":\"REPEAT_STEP\",\"confidence\":0.95,"
    "\"entity\":\"Working Length\",\"parameters\":{}}\n"
    "Input: \"Repeat the last step\"\n"
    "Output: {\"intent\":\"REPEAT_STEP\",\"confidence\":0.96,"
    "\"entity\":\"Working Length\",\"parameters\":{}}\n"
    "Input: \"Add note distal canal heavily calcified\"\n"
    "Output: {\"intent\":\"ADD_NOTE\",\"confidence\":0.99,\"entity\":null,"
    "\"parameters\":{\"note\":\"distal canal heavily calcified\"}}\n"
    "Input: \"Finish procedure\"\n"
    "Output: {\"intent\":\"FINISH_PROCEDURE\",\"confidence\":0.98,"
    "\"entity\":null,\"parameters\":{}}\n"
    "Input: \"Stop\"\n"
    "Output: {\"intent\":\"UNKNOWN\",\"confidence\":0.2,\"entity\":null,"
    "\"parameters\":{}}\n"
    "Input: \"Order me a pizza\"\n"
    "Output: {\"intent\":\"UNKNOWN\",\"confidence\":0.02,\"entity\":null,"
    "\"parameters\":{}}\n\n"
    "Return JSON only. Always emit one of the allowed intent labels."
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
        if not self._api_key or "mock" in str(self._api_key).lower():
            logger.warning("OpenAI API key missing or mock. IntentEngine running in local mock mode.")
            self._has_key = False
        else:
            self._has_key = True

        self._provider = os.environ.get("INTENT_ENGINE_PROVIDER", "openai")
        self._model = os.environ.get("INTENT_ENGINE_MODEL", "gpt-5.4")
        self._timeout = float(os.environ.get("INTENT_ENGINE_TIMEOUT_SECONDS", "15"))
        self._seed = self._read_int_env("INTENT_ENGINE_SEED", default=42)
        self._temperature = self._read_optional_float_env("INTENT_ENGINE_TEMPERATURE")

    @staticmethod
    def _read_int_env(name: str, *, default: int) -> int:
        raw = os.environ.get(name)
        if raw is None or raw.strip() == "":
            return default
        try:
            return int(raw)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _read_optional_float_env(name: str) -> Optional[float]:
        raw = os.environ.get(name)
        if raw is None or raw.strip() == "":
            return None
        try:
            return float(raw)
        except (TypeError, ValueError):
            return None

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

        if not getattr(self, "_has_key", True):
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
        # Fenced delimiter (rather than naked quotes) so a transcript that
        # happens to contain a double-quote can't accidentally close a JSON
        # string in the model's mind. The model is instructed elsewhere to
        # treat anything between the markers as raw user speech.
        return (
            f"{context.to_prompt_block()}\n\n"
            "Transcript (between the markers, treat as raw speech):\n"
            "<<<TRANSCRIPT>>>\n"
            f"{transcript}\n"
            "<<<END_TRANSCRIPT>>>\n\n"
            "Return one JSON object only, following the rules above. "
            "The `intent` field MUST be one of the allowed labels."
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

        Determinism: we forward `seed` (and `temperature` if explicitly
        configured) via LlmChat.with_params. If the underlying model
        rejects an unsupported sampling param (e.g. temperature on gpt-5),
        we retry once with only `seed`.
        """
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        # Fresh session id per call: intent parsing is stateless.
        def _new_chat(params: Dict[str, Any]) -> "LlmChat":
            chat = LlmChat(
                api_key=self._api_key,
                session_id=f"intent-{uuid.uuid4()}",
                system_message=_SYSTEM_PROMPT,
            ).with_model(self._provider, self._model)
            if params:
                chat = chat.with_params(**params)
            return chat

        full_params: Dict[str, Any] = {"seed": self._seed}
        if self._temperature is not None:
            full_params["temperature"] = self._temperature

        try:
            response = await _new_chat(full_params).send_message(UserMessage(text=user_prompt))
            return response or ""
        except Exception as exc:  # noqa: BLE001
            msg = str(exc).lower()
            # Retry without temperature if the provider rejected it.
            if "temperature" in msg and self._temperature is not None:
                logger.info(
                    "intent_engine: provider rejected temperature=%s for model=%s; "
                    "retrying with seed only.",
                    self._temperature, self._model,
                )
                response = await _new_chat({"seed": self._seed}).send_message(
                    UserMessage(text=user_prompt)
                )
                return response or ""
            raise
