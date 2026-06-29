"""Unit tests for the Intent Engine abstraction (Step 3).

These tests focus on the parsing/validation surface — they DO NOT call
OpenAI. We stub the LLM transport with a `FakeIntentEngine` and verify:

- All six supported intents are returned correctly.
- Malformed provider responses gracefully degrade to UNKNOWN.
- Confidence is always clamped to [0.0, 1.0].
- Markdown-fenced JSON is unwrapped.
- The OpenAIIntentEngine's prompt builder includes the minimal context.

These are pure unit tests; no network calls.
"""
from __future__ import annotations

import sys
import os

# Make `services` importable when pytest is run from /app/backend/tests.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest  # noqa: E402

from services.intent_engine import (  # noqa: E402
    IntentEngine,
    IntentKind,
    IntentResult,
    ProcedureContext,
)
from services.intent_engine.openai_intent_engine import OpenAIIntentEngine  # noqa: E402


# --------------------------------------------------------------------------- #
# Fixtures / helpers                                                          #
# --------------------------------------------------------------------------- #
ROOT_CANAL_CONTEXT = ProcedureContext(
    procedure_id="case-123",
    procedure_name="Root Canal",
    current_step="Working Length",
    pending_items=["Working Length", "Canal Preparation", "Irrigation", "Obturation"],
    completed_items=["Consent", "Anesthesia", "Access Opening"],
)


class FakeIntentEngine(IntentEngine):
    """Drives the real `OpenAIIntentEngine.parse_response` with canned text.

    This is the same code path the production engine uses to interpret
    LLM output, so testing through it covers the production parser too.
    """

    name = "fake_intent_engine"

    def __init__(self, canned_response: str):
        self._canned = canned_response

    async def process(self, transcript, context):  # type: ignore[override]
        return OpenAIIntentEngine.parse_response(transcript, self._canned)


# --------------------------------------------------------------------------- #
# Happy-path: each supported intent                                           #
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_update_checklist_intent():
    engine = FakeIntentEngine(
        '{"intent":"UPDATE_CHECKLIST","entity":"Working Length",'
        '"confidence":0.98,"parameters":{}}'
    )
    result = await engine.process("Mark working length complete", ROOT_CANAL_CONTEXT)
    assert result.intent is IntentKind.UPDATE_CHECKLIST
    assert result.entity == "Working Length"
    assert result.confidence == pytest.approx(0.98)
    assert result.parameters == {}


@pytest.mark.asyncio
async def test_add_note_intent():
    engine = FakeIntentEngine(
        '{"intent":"ADD_NOTE","entity":null,"confidence":0.99,'
        '"parameters":{"note":"Distal canal calcified"}}'
    )
    result = await engine.process(
        "Add note distal canal calcified", ROOT_CANAL_CONTEXT
    )
    assert result.intent is IntentKind.ADD_NOTE
    assert result.entity is None
    assert result.parameters == {"note": "Distal canal calcified"}
    assert result.confidence == pytest.approx(0.99)


@pytest.mark.asyncio
async def test_read_next_step_intent():
    engine = FakeIntentEngine(
        '{"intent":"READ_NEXT_STEP","entity":null,'
        '"confidence":0.9,"parameters":{}}'
    )
    result = await engine.process("What is the next step?", ROOT_CANAL_CONTEXT)
    assert result.intent is IntentKind.READ_NEXT_STEP
    assert result.confidence == pytest.approx(0.9)
    assert result.entity is None


@pytest.mark.asyncio
async def test_repeat_step_intent():
    engine = FakeIntentEngine(
        '{"intent":"REPEAT_STEP","entity":"Working Length",'
        '"confidence":0.88,"parameters":{}}'
    )
    result = await engine.process("Repeat that", ROOT_CANAL_CONTEXT)
    assert result.intent is IntentKind.REPEAT_STEP
    assert result.entity == "Working Length"


@pytest.mark.asyncio
async def test_finish_procedure_intent():
    engine = FakeIntentEngine(
        '{"intent":"FINISH_PROCEDURE","entity":null,'
        '"confidence":0.95,"parameters":{}}'
    )
    result = await engine.process("We are done with this procedure", ROOT_CANAL_CONTEXT)
    assert result.intent is IntentKind.FINISH_PROCEDURE
    assert result.confidence == pytest.approx(0.95)


@pytest.mark.asyncio
async def test_unknown_intent():
    engine = FakeIntentEngine(
        '{"intent":"UNKNOWN","entity":null,"confidence":0.4,"parameters":{}}'
    )
    result = await engine.process("Order me a pizza", ROOT_CANAL_CONTEXT)
    assert result.intent is IntentKind.UNKNOWN
    assert result.confidence == pytest.approx(0.4)


# --------------------------------------------------------------------------- #
# Malformed / edge-case LLM responses                                         #
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_markdown_fenced_json_is_unwrapped():
    engine = FakeIntentEngine(
        '```json\n{"intent":"REPEAT_STEP","entity":null,'
        '"confidence":0.7,"parameters":{}}\n```'
    )
    result = await engine.process("repeat", ROOT_CANAL_CONTEXT)
    assert result.intent is IntentKind.REPEAT_STEP
    assert result.confidence == pytest.approx(0.7)


@pytest.mark.asyncio
async def test_json_with_leading_prose():
    engine = FakeIntentEngine(
        "Here you go: "
        '{"intent":"READ_NEXT_STEP","entity":null,"confidence":0.85}'
    )
    result = await engine.process("next", ROOT_CANAL_CONTEXT)
    assert result.intent is IntentKind.READ_NEXT_STEP
    assert result.confidence == pytest.approx(0.85)


@pytest.mark.asyncio
async def test_garbage_response_returns_unknown():
    engine = FakeIntentEngine("???")
    result = await engine.process("anything", ROOT_CANAL_CONTEXT)
    assert result.intent is IntentKind.UNKNOWN
    assert result.confidence == 0.0
    assert result.parameters == {}


@pytest.mark.asyncio
async def test_empty_response_returns_unknown():
    engine = FakeIntentEngine("")
    result = await engine.process("anything", ROOT_CANAL_CONTEXT)
    assert result.intent is IntentKind.UNKNOWN
    assert result.confidence == 0.0


@pytest.mark.asyncio
async def test_missing_fields_default_to_unknown():
    engine = FakeIntentEngine('{"foo": "bar"}')
    result = await engine.process("anything", ROOT_CANAL_CONTEXT)
    assert result.intent is IntentKind.UNKNOWN
    assert result.confidence == 0.0
    assert result.entity is None
    assert result.parameters == {}


@pytest.mark.asyncio
async def test_unknown_intent_value_coerced():
    engine = FakeIntentEngine(
        '{"intent":"SOMETHING_ELSE","confidence":0.9,"parameters":{}}'
    )
    result = await engine.process("anything", ROOT_CANAL_CONTEXT)
    assert result.intent is IntentKind.UNKNOWN


@pytest.mark.asyncio
async def test_confidence_above_one_is_clamped():
    engine = FakeIntentEngine(
        '{"intent":"UPDATE_CHECKLIST","entity":"Irrigation",'
        '"confidence":1.7,"parameters":{}}'
    )
    result = await engine.process("Irrigation done", ROOT_CANAL_CONTEXT)
    assert result.confidence == 1.0


@pytest.mark.asyncio
async def test_confidence_below_zero_is_clamped():
    engine = FakeIntentEngine(
        '{"intent":"UPDATE_CHECKLIST","entity":"Irrigation",'
        '"confidence":-0.3,"parameters":{}}'
    )
    result = await engine.process("Irrigation done", ROOT_CANAL_CONTEXT)
    assert result.confidence == 0.0


@pytest.mark.asyncio
async def test_non_numeric_confidence_becomes_zero():
    engine = FakeIntentEngine(
        '{"intent":"UPDATE_CHECKLIST","entity":"Irrigation",'
        '"confidence":"high","parameters":{}}'
    )
    result = await engine.process("Irrigation done", ROOT_CANAL_CONTEXT)
    assert result.confidence == 0.0


@pytest.mark.asyncio
async def test_parameters_must_be_dict():
    engine = FakeIntentEngine(
        '{"intent":"ADD_NOTE","entity":null,"confidence":0.5,'
        '"parameters":"not-a-dict"}'
    )
    result = await engine.process("note something", ROOT_CANAL_CONTEXT)
    assert result.parameters == {}


@pytest.mark.asyncio
async def test_empty_string_entity_becomes_none():
    engine = FakeIntentEngine(
        '{"intent":"UPDATE_CHECKLIST","entity":"   ",'
        '"confidence":0.8,"parameters":{}}'
    )
    result = await engine.process("done", ROOT_CANAL_CONTEXT)
    assert result.entity is None


# --------------------------------------------------------------------------- #
# IntentResult invariants                                                     #
# --------------------------------------------------------------------------- #
def test_intent_result_to_dict_shape():
    result = IntentResult(
        transcript="hello",
        intent=IntentKind.ADD_NOTE,
        confidence=0.42,
        entity=None,
        parameters={"note": "x"},
    )
    payload = result.to_dict()
    assert set(payload.keys()) == {"transcript", "intent", "confidence", "entity", "parameters"}
    assert payload["intent"] == "ADD_NOTE"
    assert payload["confidence"] == pytest.approx(0.42)
    assert payload["entity"] is None
    assert payload["parameters"] == {"note": "x"}


def test_intent_kind_coerce_normalises_case_and_spaces():
    assert IntentKind.coerce("update_checklist") is IntentKind.UPDATE_CHECKLIST
    assert IntentKind.coerce("ADD NOTE") is IntentKind.ADD_NOTE
    assert IntentKind.coerce("Finish-Procedure") is IntentKind.FINISH_PROCEDURE
    assert IntentKind.coerce("nonsense") is IntentKind.UNKNOWN
    assert IntentKind.coerce(None) is IntentKind.UNKNOWN


# --------------------------------------------------------------------------- #
# Prompt construction                                                         #
# --------------------------------------------------------------------------- #
def test_user_prompt_includes_minimal_context_only():
    prompt = OpenAIIntentEngine._build_user_prompt(
        "Mark working length complete", ROOT_CANAL_CONTEXT
    )
    # Must contain the procedure name, current step, both lists, and the transcript.
    assert "Root Canal" in prompt
    assert "Working Length" in prompt
    assert "Pending Items" in prompt
    assert "Completed Steps" in prompt
    assert "Mark working length complete" in prompt
    # Must NOT contain any patient-record-like fields the engine should never see.
    for forbidden in ("patient", "DOB", "address", "phone", "email"):
        assert forbidden.lower() not in prompt.lower()


def test_procedure_context_truncates_long_lists():
    ctx = ProcedureContext(
        procedure_id="x",
        pending_items=[f"item{i}" for i in range(50)],
    )
    block = ctx.to_prompt_block(max_items=5)
    # Only 5 of the items should appear.
    assert block.count("item") == 5
