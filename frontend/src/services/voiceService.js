/**
 * VoiceService
 * -------------
 * Single source of truth for voice-related API calls. The React UI must
 * never call /api directly — it should depend on this module.
 *
 * Today: transcribe(audioBlob) → { transcript, durations, ... }
 * Tomorrow: processVoice(audioBlob) → { transcript, intent, checklistUpdate }
 *
 * The UI calls a stable method (e.g. `transcribeAudio` prop) which can be
 * remapped to `processVoice` later without any UI changes.
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';

const DEFAULT_TIMEOUT_MS = 35_000; // > backend's 30s STT timeout
const DEFAULT_RETRIES = 1;
const DEFAULT_FILENAME = 'recording.webm';
const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Public error class. UI components switch on `error.code` to render
 * messages without coupling to provider internals.
 */
export class VoiceServiceError extends Error {
  constructor(code, message, { status, cause } = {}) {
    super(message);
    this.name = 'VoiceServiceError';
    this.code = code;
    this.status = status;
    if (cause) this.cause = cause;
  }
}

const ERROR_MESSAGES = {
  EMPTY_AUDIO: 'No audio was captured. Please try recording again.',
  UPLOAD_FAILED: 'Could not send the recording. Check your connection and try again.',
  TIMEOUT: 'Transcription is taking too long. Please try again.',
  STT_FAILED: 'We couldn\u2019t transcribe that recording. Please try again.',
  UNSUPPORTED: 'That audio format isn\u2019t supported.',
  TOO_LARGE: 'Recording is too long. Please record a shorter clip.',
  NOT_CONFIGURED: 'Voice transcription is not available right now.',
  UNKNOWN: 'Something went wrong while transcribing. Please try again.',
};

function statusToCode(status) {
  if (status === 400) return 'EMPTY_AUDIO';
  if (status === 413) return 'TOO_LARGE';
  if (status === 415) return 'UNSUPPORTED';
  if (status === 503) return 'NOT_CONFIGURED';
  if (status === 504) return 'TIMEOUT';
  if (status === 502) return 'STT_FAILED';
  if (status >= 500) return 'STT_FAILED';
  return 'UNKNOWN';
}

function getAuthHeader() {
  try {
    const sessionData = localStorage.getItem('clinician_auth_session');
    if (!sessionData) return null;
    const { token } = JSON.parse(sessionData);
    return token ? `Bearer ${token}` : null;
  } catch {
    return null;
  }
}

function pickFilename(blob) {
  if (!blob || !blob.type) return DEFAULT_FILENAME;
  const type = blob.type.toLowerCase();
  if (type.includes('webm')) return 'recording.webm';
  if (type.includes('ogg')) return 'recording.ogg';
  if (type.includes('mp4') || type.includes('m4a')) return 'recording.m4a';
  if (type.includes('mpeg') || type.includes('mp3')) return 'recording.mp3';
  if (type.includes('wav')) return 'recording.wav';
  return DEFAULT_FILENAME;
}

/**
 * Format a millisecond number for log lines: "145ms" or "2.80s" or "1.05s".
 */
export function formatDuration(ms) {
  if (ms == null || Number.isNaN(ms)) return 'n/a';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Print the formatted "Voice Metrics" block in DEV mode only.
 * Safe to call with partial data — missing fields render as "n/a".
 */
export function logVoiceMetrics(metrics = {}) {
  if (!IS_DEV) return;
  const { recordingMs, uploadMs, sttMs, intentMs, totalMs, intent, confidence } =
    metrics;
  const lines = [
    'Voice Metrics',
    '-------------',
    `Recording:      ${formatDuration(recordingMs)}`,
    `Upload:         ${formatDuration(uploadMs)}`,
    `Speech-to-Text: ${formatDuration(sttMs)}`,
  ];
  if (intentMs != null) {
    lines.push(`Intent Engine:  ${formatDuration(intentMs)}`);
  }
  lines.push(`Total:          ${formatDuration(totalMs)}`);
  if (intent) {
    const conf =
      typeof confidence === 'number' ? ` (${Math.round(confidence * 100)}%)` : '';
    lines.push(`Intent:         ${intent}${conf}`);
  }
  console.log(lines.join('\n'));
}

/**
 * Low-level upload with timeout. Single attempt; retry handled by caller.
 */
async function uploadOnce(audioBlob, { signal, filename }) {
  const form = new FormData();
  form.append('audio', audioBlob, filename);

  const headers = {};
  const auth = getAuthHeader();
  if (auth) headers.Authorization = auth;

  const response = await fetch(`${API_BASE}/voice/transcribe`, {
    method: 'POST',
    body: form,
    headers,
    signal,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // non-JSON response; fall back to status-based error mapping
  }

  if (!response.ok) {
    const code = statusToCode(response.status);
    const detail =
      (payload && (payload.detail || payload.error || payload.message)) ||
      ERROR_MESSAGES[code];
    throw new VoiceServiceError(code, detail, { status: response.status });
  }

  if (!payload || typeof payload.transcript !== 'string') {
    throw new VoiceServiceError('STT_FAILED', ERROR_MESSAGES.STT_FAILED, {
      status: response.status,
    });
  }

  return payload;
}

function shouldRetry(error) {
  if (!(error instanceof VoiceServiceError)) return true; // network/abort-class
  return error.code === 'STT_FAILED' || error.code === 'TIMEOUT';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Transcribe an audio Blob.
 *
 * @param {Blob} audioBlob
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=35000]
 * @param {number} [options.retries=1]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{
 *   transcript: string,
 *   durations: {
 *     uploadMs: number,    // network + server overhead (excludes STT compute)
 *     sttMs: number|null,  // provider-reported speech-to-text time
 *     totalMs: number,     // request fired → response received
 *   }
 * }>}
 */
export async function transcribe(audioBlob, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = Math.max(0, options.retries ?? DEFAULT_RETRIES);

  if (!audioBlob || !(audioBlob instanceof Blob) || audioBlob.size === 0) {
    throw new VoiceServiceError('EMPTY_AUDIO', ERROR_MESSAGES.EMPTY_AUDIO);
  }

  const filename = pickFilename(audioBlob);
  const totalStart = performance.now();
  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    const attemptStart = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const onExternalAbort = () => controller.abort();
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const payload = await uploadOnce(audioBlob, {
        signal: controller.signal,
        filename,
      });

      const roundTripMs = Math.round(performance.now() - attemptStart);
      const totalMs = Math.round(performance.now() - totalStart);
      const sttMs =
        typeof payload?.metrics?.stt_ms === 'number' ? payload.metrics.stt_ms : null;
      // "Upload" = everything that isn't STT compute (network + server overhead).
      const uploadMs =
        sttMs != null ? Math.max(0, roundTripMs - sttMs) : roundTripMs;

      if (IS_DEV) {
         
        console.debug('[voiceService.transcribe] success', {
          attempt: attempt + 1,
          sizeBytes: audioBlob.size,
          roundTripMs,
          uploadMs,
          sttMs,
          totalMs,
        });
      }

      return {
        transcript: (payload.transcript || '').trim(),
        durations: { uploadMs, sttMs, totalMs },
      };
    } catch (rawError) {
      clearTimeout(timeoutId);
      if (options.signal) {
        options.signal.removeEventListener('abort', onExternalAbort);
      }

      let error = rawError;
      if (rawError?.name === 'AbortError') {
        if (options.signal?.aborted) {
          throw new VoiceServiceError('UNKNOWN', 'Recording cancelled.', { cause: rawError });
        }
        error = new VoiceServiceError('TIMEOUT', ERROR_MESSAGES.TIMEOUT, { cause: rawError });
      } else if (!(rawError instanceof VoiceServiceError)) {
        error = new VoiceServiceError('UPLOAD_FAILED', ERROR_MESSAGES.UPLOAD_FAILED, {
          cause: rawError,
        });
      }
      lastError = error;

      if (IS_DEV) {
         
        console.warn('[voiceService.transcribe] attempt failed', {
          attempt: attempt + 1,
          code: error.code,
          status: error.status,
          message: error.message,
        });
      }

      if (attempt < retries && shouldRetry(error)) {
        await delay(400 * (attempt + 1));
        attempt += 1;
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || new VoiceServiceError('UNKNOWN', ERROR_MESSAGES.UNKNOWN);
}

/**
 * Convenience wrapper used by callers that know how long the user recorded.
 * Emits a single formatted dev-only metrics block.
 *
 * @param {Blob} audioBlob
 * @param {{ recordingMs?: number }} [meta]
 * @param {Object} [options]
 */
export async function transcribeWithMetrics(audioBlob, meta = {}, options = {}) {
  const result = await transcribe(audioBlob, options);
  logVoiceMetrics({
    recordingMs: meta.recordingMs,
    uploadMs: result.durations.uploadMs,
    sttMs: result.durations.sttMs,
    totalMs: result.durations.totalMs,
  });
  return result;
}

/**
 * Future-compatible API — Step 3 implementation.
 *
 * Calls POST /api/voice/process to perform STT → Intent classification
 * server-side and returns an `IntentResult` plus latency metrics.
 *
 * In Step 4 the backend will additionally apply checklist actions, but
 * this signature stays the same: the UI never has to change.
 *
 * @param {Blob} audioBlob
 * @param {Object} args
 * @param {string} args.procedureId            - identifier of the active procedure
 * @param {Object} [args.context]              - minimal procedure context (NOT a patient record)
 * @param {string} [args.context.procedureName]
 * @param {string} [args.context.currentStep]
 * @param {string[]} [args.context.pendingItems]
 * @param {string[]} [args.context.completedItems]
 * @param {number} [args.recordingMs]          - for dev-mode metrics block
 * @param {Object} [options]                   - { timeoutMs, retries, signal }
 * @returns {Promise<{
 *   transcript: string,
 *   intent: string,
 *   confidence: number,
 *   entity: string|null,
 *   parameters: Object,
 *   durations: { uploadMs:number, sttMs:number|null, intentMs:number|null, totalMs:number }
 * }>}
 */
export async function processVoice(audioBlob, args = {}, options = {}) {
  const procedureId = args.procedureId;
  if (!procedureId) {
    throw new VoiceServiceError('UNKNOWN', 'processVoice requires a procedureId.');
  }
  if (!audioBlob || !(audioBlob instanceof Blob) || audioBlob.size === 0) {
    throw new VoiceServiceError('EMPTY_AUDIO', ERROR_MESSAGES.EMPTY_AUDIO);
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = Math.max(0, options.retries ?? DEFAULT_RETRIES);
  const filename = pickFilename(audioBlob);
  const totalStart = performance.now();

  // Build the multipart body once per call (we re-create FormData per
  // attempt because some browsers consume the body on the first try).
  const buildForm = () => {
    const form = new FormData();
    form.append('audio', audioBlob, filename);
    form.append('procedureId', procedureId);
    if (args.context && typeof args.context === 'object') {
      form.append('context', JSON.stringify(args.context));
    }
    return form;
  };

  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    const attemptStart = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const onExternalAbort = () => controller.abort();
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const headers = {};
      const auth = getAuthHeader();
      if (auth) headers.Authorization = auth;

      const response = await fetch(`${API_BASE}/voice/process`, {
        method: 'POST',
        body: buildForm(),
        headers,
        signal: controller.signal,
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        /* non-JSON */
      }

      if (!response.ok) {
        const code = statusToCode(response.status);
        const detail =
          (payload && (payload.detail || payload.error || payload.message)) ||
          ERROR_MESSAGES[code];
        throw new VoiceServiceError(code, detail, { status: response.status });
      }

      // Defensive shape validation. The endpoint should always return these
      // fields, but if it doesn't we degrade to UNKNOWN rather than crash.
      const transcript = typeof payload?.transcript === 'string' ? payload.transcript : '';
      const intent = typeof payload?.intent === 'string' ? payload.intent : 'UNKNOWN';
      const confidence =
        typeof payload?.confidence === 'number'
          ? Math.max(0, Math.min(1, payload.confidence))
          : 0;
      const entity = typeof payload?.entity === 'string' ? payload.entity : null;
      const parameters =
        payload?.parameters && typeof payload.parameters === 'object'
          ? payload.parameters
          : {};

      const roundTripMs = Math.round(performance.now() - attemptStart);
      const totalMs = Math.round(performance.now() - totalStart);
      const sttMs =
        typeof payload?.metrics?.stt_ms === 'number' ? payload.metrics.stt_ms : null;
      const intentMs =
        typeof payload?.metrics?.intent_ms === 'number' ? payload.metrics.intent_ms : null;
      const serverMs = (sttMs ?? 0) + (intentMs ?? 0);
      const uploadMs =
        sttMs != null || intentMs != null
          ? Math.max(0, roundTripMs - serverMs)
          : roundTripMs;

      logVoiceMetrics({
        recordingMs: args.recordingMs,
        uploadMs,
        sttMs,
        intentMs,
        totalMs,
        intent,
        confidence,
      });

      return {
        transcript,
        intent,
        confidence,
        entity,
        parameters,
        // Step 5: action result fields from the backend orchestrator.
        success: typeof payload?.success === 'boolean' ? payload.success : true,
        requiresConfirmation:
          typeof payload?.requiresConfirmation === 'boolean'
            ? payload.requiresConfirmation
            : false,
        message: typeof payload?.message === 'string' ? payload.message : null,
        action:
          payload?.action && typeof payload.action === 'object'
            ? {
                type:
                  typeof payload.action.type === 'string' ? payload.action.type : 'none',
                data:
                  payload.action.data && typeof payload.action.data === 'object'
                    ? payload.action.data
                    : {},
              }
            : { type: 'none', data: {} },
        threshold:
          typeof payload?.threshold === 'number' ? payload.threshold : null,
        durations: { uploadMs, sttMs, intentMs, totalMs },
      };
    } catch (rawError) {
      clearTimeout(timeoutId);
      if (options.signal) {
        options.signal.removeEventListener('abort', onExternalAbort);
      }

      let error = rawError;
      if (rawError?.name === 'AbortError') {
        if (options.signal?.aborted) {
          throw new VoiceServiceError('UNKNOWN', 'Recording cancelled.', { cause: rawError });
        }
        error = new VoiceServiceError('TIMEOUT', ERROR_MESSAGES.TIMEOUT, { cause: rawError });
      } else if (!(rawError instanceof VoiceServiceError)) {
        error = new VoiceServiceError('UPLOAD_FAILED', ERROR_MESSAGES.UPLOAD_FAILED, {
          cause: rawError,
        });
      }
      lastError = error;

      if (IS_DEV) {
        console.warn('[voiceService.processVoice] attempt failed', {
          attempt: attempt + 1,
          code: error.code,
          status: error.status,
          message: error.message,
        });
      }

      if (attempt < retries && shouldRetry(error)) {
        await delay(400 * (attempt + 1));
        attempt += 1;
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || new VoiceServiceError('UNKNOWN', ERROR_MESSAGES.UNKNOWN);
}

/**
 * Confirm a previously low-confidence intent and request execution
 * (Step 5). Bypasses STT and the IntentEngine: the backend forces
 * confidence=1.0 and runs the orchestrator directly.
 *
 * @param {Object} args
 * @param {string} args.procedureId
 * @param {string} args.intent      - e.g. "UPDATE_CHECKLIST"
 * @param {string|null} [args.entity]
 * @param {Object} [args.parameters]
 * @param {string} [args.transcript] - original transcript (audit only)
 * @param {Object} [options]
 * @returns {Promise<Object>} processVoice-shaped response
 */
export async function confirmVoiceAction(args = {}, options = {}) {
  const { procedureId, intent, entity = null, parameters = {}, transcript = '' } = args;
  if (!procedureId) {
    throw new VoiceServiceError('UNKNOWN', 'confirmVoiceAction requires a procedureId.');
  }
  if (!intent) {
    throw new VoiceServiceError('UNKNOWN', 'confirmVoiceAction requires an intent.');
  }

  const timeoutMs = options.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = { 'Content-Type': 'application/json' };
    const auth = getAuthHeader();
    if (auth) headers.Authorization = auth;

    const response = await fetch(`${API_BASE}/voice/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ procedureId, intent, entity, parameters, transcript }),
      signal: controller.signal,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      /* non-JSON */
    }

    if (!response.ok) {
      const code = statusToCode(response.status);
      const detail =
        (payload && (payload.detail || payload.error || payload.message)) ||
        ERROR_MESSAGES[code];
      throw new VoiceServiceError(code, detail, { status: response.status });
    }
    return payload;
  } catch (rawError) {
    if (rawError instanceof VoiceServiceError) throw rawError;
    if (rawError?.name === 'AbortError') {
      throw new VoiceServiceError('TIMEOUT', ERROR_MESSAGES.TIMEOUT, { cause: rawError });
    }
    throw new VoiceServiceError('UPLOAD_FAILED', ERROR_MESSAGES.UPLOAD_FAILED, { cause: rawError });
  } finally {
    clearTimeout(timeoutId);
  }
}

const voiceService = {
  transcribe,
  transcribeWithMetrics,
  processVoice,
  confirmVoiceAction,
  logVoiceMetrics,
  formatDuration,
  VoiceServiceError,
  ERROR_MESSAGES,
};

export default voiceService;
