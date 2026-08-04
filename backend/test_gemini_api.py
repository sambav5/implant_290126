"""Interactive test script for Google Gemini API."""
import asyncio
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.intent_engine.gemini_intent_engine import GeminiIntentEngine
from services.intent_engine.base import ProcedureContext

async def main():
    print("=" * 60)
    print("      Interactive Google Gemini Intent Tester      ")
    print("=" * 60)
    
    intent_engine = GeminiIntentEngine()
    if not intent_engine._has_key:
        print("Error: GEMINI_API_KEY / GOOGLE_API_KEY is not configured in .env!")
        return

    context = ProcedureContext(
        procedure_id="test-case-123",
        procedure_name="Dental Implant Surgery",
        current_step="Consent obtained and signed",
        pending_items=["Consent obtained and signed", "CBCT scan reviewed", "Drill pilot hole"],
        completed_items=[],
    )

    print("\n[Procedure Context]")
    print(f"Current Step: '{context.current_step}'")
    print(f"Pending Items: {context.pending_items}")

    while True:
        try:
            cmd = input("\nEnter voice command to simulate (or press Enter to exit): ").strip()
            if not cmd:
                break
            
            res = await intent_engine.process(cmd, context)
            print("-" * 40)
            print(f"Transcript: '{res.transcript}'")
            print(f"Resolved Intent: {res.intent.value}")
            print(f"Confidence: {res.confidence * 100:.1f}%")
            print(f"Entity: {res.entity}")
            print(f"Parameters: {res.parameters}")
            print("-" * 40)
        except (KeyboardInterrupt, EOFError):
            break

    print("\nExiting tester.")

if __name__ == "__main__":
    asyncio.run(main())
