/**
 * VoiceService
 * -------------
 * Single source of truth for voice-related API calls. The React UI must
 * never call /api directly — it should depend on this module.
 *
 * Today: transcribe(audioBlob) → { transcript, ... }
 * Tomorrow: processVoice(audioBlob) → { transcript, intent, checklistUpdate }
 *
 * The UI calls a stable method (e.g. `transcribeAudio`) which can be remapped
 * to `processVoice` later without any UI changes.
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';

const DEFAULT_TIMEOUT_MS = 35_000; // a bit larger than backend's 30s STT timeout
const DEFAULT_RETRIES = 1;
const DEFAULT_FILENAME = 'recording.webm';

/**
 * Public error class. UI components can switch on `error.code` to render
 * messages without coupling to provider internals.
 */
export class VoiceServiceError extends Error {
  constructor(code, message, { status, cause } = {}) {
    super(message);
    this.name = 'VoiceServiceError';
    this.code = code;       // EMPTY_AUDIO | UPLOAD_FAILED | TIMEOUT | STT_FAILED | UNSUPPORTED | TOO_LARGE | NOT_CONFIGURED | UNKNOWN
    this.status = status;   // HTTP status if available
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
    // non-JSON response; we'll fall back to status-based error mapping
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
 * @returns {Promise<{ transcript: string, durations: { uploadMs: number, totalMs: number, recordingMs?: number } }>}
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

    // Allow external cancellation to also abort the in-flight request.
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

      const uploadMs = Math.round(performance.now() - attemptStart);
      const totalMs = Math.round(performance.now() - totalStart);

      // Logging hook for latency optimization (recording duration is added
      // by the caller — see `transcribeWithMetrics`).
       
      console.info('[voiceService.transcribe] success', {
        attempt: attempt + 1,
        sizeBytes: audioBlob.size,
        uploadMs,
        totalMs,
      });

      return {
        transcript: (payload.transcript || '').trim(),
        durations: { uploadMs, totalMs },
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

       
      console.warn('[voiceService.transcribe] attempt failed', {
        attempt: attempt + 1,
        code: error.code,
        status: error.status,
        message: error.message,
      });

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

  // Should never reach here, but keep TypeScript-style safety.
  throw lastError || new VoiceServiceError('UNKNOWN', ERROR_MESSAGES.UNKNOWN);
}

/**
 * Convenience wrapper used by callers that know how long the user recorded.
 * Logs recording + upload + total durations together for latency analysis.
 *
 * @param {Blob} audioBlob
 * @param {{ recordingMs?: number }} [meta]
 * @param {Object} [options] - forwarded to transcribe()
 */
export async function transcribeWithMetrics(audioBlob, meta = {}, options = {}) {
  const result = await transcribe(audioBlob, options);
   
  console.info('[voiceService.transcribeWithMetrics] timings', {
    recordingMs: meta.recordingMs ?? null,
    uploadMs: result.durations.uploadMs,
    totalMs: result.durations.totalMs,
  });
  return result;
}

/**
 * Future-compatible API.
 *
 * Today: equivalent to `transcribe`.
 * Tomorrow: this is the single entry-point that will run
 *   Speech-to-Text → Intent Detection → Checklist Update.
 *
 * Callers should prefer this name in new code; UI should depend on
 * `voiceService.processVoice` so we can grow the pipeline without churn.
 */
export async function processVoice(audioBlob, options = {}) {
  const { transcript, durations } = await transcribe(audioBlob, options);
  return {
    transcript,
    intent: null,             // placeholder — populated by future intent step
    checklistUpdate: null,    // placeholder — populated by future checklist step
    durations,
  };
}

const voiceService = {
  transcribe,
  transcribeWithMetrics,
  processVoice,
  VoiceServiceError,
  ERROR_MESSAGES,
};

export default voiceService;
