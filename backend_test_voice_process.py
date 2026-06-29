#!/usr/bin/env python3
"""
Backend test for POST /api/voice/process endpoint (Step 3 - Intent Engine).

Tests all scenarios:
1. Happy path with audio + procedureId + context
2. Missing procedureId
3. Missing audio
4. Empty audio (0 bytes)
5. Unsupported format (.txt)
6. Too large file (>25MB)
7. context omitted
8. Malformed context JSON
9. No persistence verification
10. Logs verification
11. Abstraction check (code review)
12. Unit tests (pytest)
"""
import io
import os
import sys
import wave
import json
import requests
import subprocess
from pathlib import Path

# Read backend URL from frontend .env
def get_backend_url():
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    return "http://localhost:8001"

BASE_URL = get_backend_url()
ENDPOINT = f"{BASE_URL}/api/voice/process"

print(f"Testing endpoint: {ENDPOINT}")
print("=" * 80)

# Track test results
results = {
    "passed": [],
    "failed": [],
    "warnings": []
}

def test_result(name, passed, message=""):
    if passed:
        results["passed"].append(name)
        print(f"✅ {name}: PASSED")
    else:
        results["failed"].append(name)
        print(f"❌ {name}: FAILED - {message}")
    if message and passed:
        print(f"   {message}")
    print()

def create_silent_wav(duration_seconds=0.5, sample_rate=16000):
    """Create a small silent WAV file in memory."""
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)  # mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        # Write silent frames (zeros)
        num_frames = int(duration_seconds * sample_rate)
        wav_file.writeframes(b'\x00\x00' * num_frames)
    buffer.seek(0)
    return buffer.getvalue()

# Valid context for testing
VALID_CONTEXT = {
    "procedureName": "Root Canal",
    "currentStep": "Working Length",
    "pendingItems": ["Working Length", "Canal Preparation", "Irrigation", "Obturation"],
    "completedItems": ["Consent", "Anesthesia", "Access Opening"]
}

VALID_INTENTS = [
    "UPDATE_CHECKLIST", "ADD_NOTE", "READ_NEXT_STEP", 
    "REPEAT_STEP", "FINISH_PROCEDURE", "UNKNOWN"
]

# ============================================================================
# TEST 1: HAPPY PATH - Valid audio + procedureId + context
# ============================================================================
print("TEST 1: Happy path with audio + procedureId + context")
try:
    # Use existing /tmp/silence.wav or create one
    if os.path.exists("/tmp/silence.wav"):
        with open("/tmp/silence.wav", "rb") as f:
            audio_data = f.read()
    else:
        audio_data = create_silent_wav(duration_seconds=0.5)
    
    files = {'audio': ('test_audio.wav', audio_data, 'audio/wav')}
    data = {
        'procedureId': 'case-123',
        'context': json.dumps(VALID_CONTEXT)
    }
    response = requests.post(ENDPOINT, files=files, data=data, timeout=60)
    
    if response.status_code == 200:
        resp_data = response.json()
        
        # Validate response structure
        required_fields = ['success', 'transcript', 'intent', 'confidence', 'entity', 'parameters', 'metrics']
        missing_fields = [f for f in required_fields if f not in resp_data]
        
        if missing_fields:
            test_result("Happy path", False, f"Missing fields: {missing_fields}")
        elif resp_data.get("success") != True:
            test_result("Happy path", False, f"success is not True: {resp_data.get('success')}")
        elif resp_data.get("intent") not in VALID_INTENTS:
            test_result("Happy path", False, f"Invalid intent: {resp_data.get('intent')}")
        elif not isinstance(resp_data.get("confidence"), (int, float)):
            test_result("Happy path", False, f"confidence is not a number: {resp_data.get('confidence')}")
        elif not (0 <= resp_data.get("confidence") <= 1):
            test_result("Happy path", False, f"confidence out of range [0,1]: {resp_data.get('confidence')}")
        else:
            # Check metrics structure
            metrics = resp_data.get("metrics", {})
            required_metrics = ['stt_ms', 'intent_ms', 'server_total_ms', 'upload_read_ms', 'size_bytes']
            missing_metrics = [m for m in required_metrics if m not in metrics]
            
            if missing_metrics:
                test_result("Happy path", False, f"Missing metrics: {missing_metrics}")
            else:
                test_result(
                    "Happy path",
                    True,
                    f"Status: 200, Intent: {resp_data['intent']}, Confidence: {resp_data['confidence']:.3f}, "
                    f"Transcript: '{resp_data['transcript'][:50]}...'"
                )
    else:
        test_result(
            "Happy path",
            False,
            f"Expected 200, got {response.status_code}: {response.text[:200]}"
        )
except Exception as e:
    test_result("Happy path", False, f"Exception: {e}")

# ============================================================================
# TEST 2: MISSING procedureId
# ============================================================================
print("TEST 2: Missing procedureId")
try:
    audio_data = create_silent_wav(duration_seconds=0.3)
    files = {'audio': ('test.wav', audio_data, 'audio/wav')}
    # No procedureId in data
    response = requests.post(ENDPOINT, files=files, timeout=10)
    
    if response.status_code == 422:
        test_result(
            "Missing procedureId",
            True,
            f"Status: {response.status_code} (FastAPI validation)"
        )
    else:
        test_result(
            "Missing procedureId",
            False,
            f"Expected 422, got {response.status_code}: {response.text[:200]}"
        )
except Exception as e:
    test_result("Missing procedureId", False, f"Exception: {e}")

# ============================================================================
# TEST 3: MISSING audio
# ============================================================================
print("TEST 3: Missing audio")
try:
    data = {'procedureId': 'case-123'}
    # No audio file
    response = requests.post(ENDPOINT, data=data, timeout=10)
    
    if response.status_code == 422:
        test_result(
            "Missing audio",
            True,
            f"Status: {response.status_code} (FastAPI validation)"
        )
    else:
        test_result(
            "Missing audio",
            False,
            f"Expected 422, got {response.status_code}: {response.text[:200]}"
        )
except Exception as e:
    test_result("Missing audio", False, f"Exception: {e}")

# ============================================================================
# TEST 4: EMPTY audio (0 bytes)
# ============================================================================
print("TEST 4: Empty audio (0 bytes)")
try:
    files = {'audio': ('empty.wav', b'', 'audio/wav')}
    data = {'procedureId': 'case-123'}
    response = requests.post(ENDPOINT, files=files, data=data, timeout=10)
    
    if response.status_code == 400:
        test_result(
            "Empty audio",
            True,
            f"Status: {response.status_code}, Message: {response.text[:100]}"
        )
    else:
        test_result(
            "Empty audio",
            False,
            f"Expected 400, got {response.status_code}: {response.text[:200]}"
        )
except Exception as e:
    test_result("Empty audio", False, f"Exception: {e}")

# ============================================================================
# TEST 5: UNSUPPORTED format (.txt)
# ============================================================================
print("TEST 5: Unsupported format (.txt file)")
try:
    files = {'audio': ('hello.txt', b'hello world', 'text/plain')}
    data = {'procedureId': 'case-123'}
    response = requests.post(ENDPOINT, files=files, data=data, timeout=10)
    
    if response.status_code == 415:
        test_result(
            "Unsupported format",
            True,
            f"Status: {response.status_code} (format rejected)"
        )
    else:
        test_result(
            "Unsupported format",
            False,
            f"Expected 415, got {response.status_code}: {response.text[:200]}"
        )
except Exception as e:
    test_result("Unsupported format", False, f"Exception: {e}")

# ============================================================================
# TEST 6: TOO LARGE (>25MB)
# ============================================================================
print("TEST 6: Too large file (>25MB)")
try:
    # Create a 26MB dummy file
    large_file_path = "/tmp/big.wav"
    subprocess.run(
        ["dd", "if=/dev/zero", f"of={large_file_path}", "bs=1M", "count=26"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True
    )
    
    with open(large_file_path, 'rb') as f:
        files = {'audio': ('big.wav', f, 'audio/wav')}
        data = {'procedureId': 'case-123'}
        response = requests.post(ENDPOINT, files=files, data=data, timeout=10)
    
    # Clean up
    os.remove(large_file_path)
    
    if response.status_code == 413:
        test_result(
            "Too large file",
            True,
            f"Status: {response.status_code}, Message: {response.text[:100]}"
        )
    else:
        test_result(
            "Too large file",
            False,
            f"Expected 413, got {response.status_code}: {response.text[:200]}"
        )
except Exception as e:
    test_result("Too large file", False, f"Exception: {e}")

# ============================================================================
# TEST 7: context OMITTED
# ============================================================================
print("TEST 7: context omitted (audio + procedureId only)")
try:
    audio_data = create_silent_wav(duration_seconds=0.3)
    files = {'audio': ('test.wav', audio_data, 'audio/wav')}
    data = {'procedureId': 'case-456'}
    # No context field
    response = requests.post(ENDPOINT, files=files, data=data, timeout=60)
    
    if response.status_code == 200:
        resp_data = response.json()
        if resp_data.get("success") == True and "intent" in resp_data:
            test_result(
                "context omitted",
                True,
                f"Status: 200, Intent: {resp_data['intent']}, engine handled missing context"
            )
        else:
            test_result(
                "context omitted",
                False,
                f"Invalid response: {resp_data}"
            )
    else:
        test_result(
            "context omitted",
            False,
            f"Expected 200, got {response.status_code}: {response.text[:200]}"
        )
except Exception as e:
    test_result("context omitted", False, f"Exception: {e}")

# ============================================================================
# TEST 8: MALFORMED context
# ============================================================================
print("TEST 8: Malformed context JSON")
try:
    audio_data = create_silent_wav(duration_seconds=0.3)
    files = {'audio': ('test.wav', audio_data, 'audio/wav')}
    data = {
        'procedureId': 'case-789',
        'context': 'not-a-json{'  # Invalid JSON
    }
    response = requests.post(ENDPOINT, files=files, data=data, timeout=60)
    
    if response.status_code == 200:
        resp_data = response.json()
        if resp_data.get("success") == True:
            test_result(
                "Malformed context",
                True,
                f"Status: 200, engine tolerated bad context, Intent: {resp_data['intent']}"
            )
        else:
            test_result(
                "Malformed context",
                False,
                f"success is not True: {resp_data}"
            )
    else:
        test_result(
            "Malformed context",
            False,
            f"Expected 200 (tolerant), got {response.status_code}: {response.text[:200]}"
        )
except Exception as e:
    test_result("Malformed context", False, f"Exception: {e}")

# ============================================================================
# TEST 9: NO PERSISTENCE
# ============================================================================
print("TEST 9: No persistence verification")
try:
    # Check uploads directory
    uploads_dir = Path("/app/backend/uploads")
    files_before = []
    if uploads_dir.exists():
        files_before = list(uploads_dir.rglob("*"))
        files_before = [f for f in files_before if f.is_file()]
    
    # Make a request
    audio_data = create_silent_wav(duration_seconds=0.3)
    files = {'audio': ('persistence_test.wav', audio_data, 'audio/wav')}
    data = {'procedureId': 'case-persist-test'}
    response = requests.post(ENDPOINT, files=files, data=data, timeout=60)
    
    # Check uploads directory after
    files_after = []
    if uploads_dir.exists():
        files_after = list(uploads_dir.rglob("*"))
        files_after = [f for f in files_after if f.is_file()]
    
    # Check MongoDB for any new audio-related documents
    from pymongo import MongoClient
    client = MongoClient("mongodb://localhost:27017")
    db = client["test_database"]
    
    # Check if any documents reference audio files or voice processing
    audio_docs = list(db.cases.find({"$or": [
        {"audio": {"$exists": True}},
        {"transcript": {"$exists": True}},
        {"voiceRecording": {"$exists": True}},
        {"intent": {"$exists": True}}
    ]}))
    
    if len(files_after) == len(files_before) and len(audio_docs) == 0:
        test_result(
            "No persistence",
            True,
            f"No files created in uploads/, no audio/intent docs in DB"
        )
    else:
        test_result(
            "No persistence",
            False,
            f"Files before: {len(files_before)}, after: {len(files_after)}, audio docs: {len(audio_docs)}"
        )
except Exception as e:
    test_result("No persistence", False, f"Exception: {e}")

# ============================================================================
# TEST 10: LOGS VERIFICATION
# ============================================================================
print("TEST 10: Logs verification")
try:
    # Make a successful request
    audio_data = create_silent_wav(duration_seconds=0.3)
    files = {'audio': ('log_test.wav', audio_data, 'audio/wav')}
    data = {
        'procedureId': 'case-log-test',
        'context': json.dumps(VALID_CONTEXT)
    }
    response = requests.post(ENDPOINT, files=files, data=data, timeout=60)
    
    # Check backend logs
    logs = ""
    for log_file in ["/var/log/supervisor/backend.out.log", "/var/log/supervisor/backend.err.log"]:
        try:
            with open(log_file, 'r') as f:
                logs += f.read()
        except:
            pass
    
    # Look for the completion log with all required fields
    required_log_parts = [
        "voice.process completed",
        "stt_provider=",
        "intent_engine=",
        "intent=",
        "confidence="
    ]
    
    all_parts_found = all(part in logs for part in required_log_parts)
    
    if all_parts_found:
        test_result(
            "Logs verification",
            True,
            "Found expected log line with stt_provider, intent_engine, intent, confidence"
        )
    else:
        missing = [part for part in required_log_parts if part not in logs]
        test_result(
            "Logs verification",
            False,
            f"Missing log parts: {missing}"
        )
except Exception as e:
    test_result("Logs verification", False, f"Exception: {e}")

# ============================================================================
# TEST 11: ABSTRACTION CHECK
# ============================================================================
print("TEST 11: Abstraction check (code review)")
try:
    voice_routes_path = Path("/app/backend/routes/voice_routes.py")
    with open(voice_routes_path, 'r') as f:
        content = f.read()
    
    # Check that the route only imports from services.speech_to_text and services.intent_engine
    # and NOT from emergentintegrations, openai, whisper, LlmChat, OpenAISpeechToText
    has_stt_import = "from services.speech_to_text import" in content
    has_intent_import = "from services.intent_engine import" in content
    
    forbidden_imports = [
        "emergentintegrations",
        "import openai",
        "from openai",
        "import whisper",
        "from whisper",
        "LlmChat",
        "OpenAISpeechToText"
    ]
    
    violations = [imp for imp in forbidden_imports if imp in content]
    
    if has_stt_import and has_intent_import and not violations:
        test_result(
            "Abstraction check",
            True,
            "Route only imports from services.speech_to_text and services.intent_engine"
        )
    else:
        test_result(
            "Abstraction check",
            False,
            f"Abstraction violated: stt_import={has_stt_import}, intent_import={has_intent_import}, "
            f"violations={violations}"
        )
except Exception as e:
    test_result("Abstraction check", False, f"Exception: {e}")

# ============================================================================
# SUMMARY
# ============================================================================
print("=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"✅ Passed: {len(results['passed'])}")
for test in results['passed']:
    print(f"   - {test}")
print()
print(f"❌ Failed: {len(results['failed'])}")
for test in results['failed']:
    print(f"   - {test}")
print()

if results['warnings']:
    print(f"⚠️  Warnings: {len(results['warnings'])}")
    for warning in results['warnings']:
        print(f"   - {warning}")
    print()

# Exit with appropriate code
sys.exit(0 if len(results['failed']) == 0 else 1)
