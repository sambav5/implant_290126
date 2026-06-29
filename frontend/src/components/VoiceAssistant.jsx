import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * VoiceAssistant — PURE UI component.
 *
 * Records audio with MediaRecorder and manages local UI state
 * (idle / starting / recording / processing). All network/provider work is
 * delegated to the parent via the `processVoice` callback. No API calls,
 * no provider-specific code, no business logic lives here.
 *
 * Props:
 *   - processVoice?: (audioBlob: Blob, meta: { recordingMs: number })
 *       => Promise<{
 *            transcript: string,
 *            intent: string,
 *            confidence: number,
 *            entity: string|null,
 *            parameters: Object,
 *          }>
 *   - onRecordingStarted?: () => void
 *   - onRecordingStopped?: (audioBlob: Blob) => void
 *   - onIntentReady?: (result, audioBlob) => void
 *   - onError?: (error: Error) => void
 *   - className?: string
 */
export default function VoiceAssistant({
  processVoice,
  onRecordingStarted,
  onRecordingStopped,
  onIntentReady,
  onError,
  className,
}) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'starting' | 'recording' | 'processing'
  const [intentResult, setIntentResult] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const recordingStartedAtRef = useRef(null);
  const cancelRequestedRef = useRef(false);
  const isUnmountedRef = useRef(false);

  // ----- Resource management ------------------------------------------------
  const releaseMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            /* no-op */
          }
        });
      } finally {
        mediaStreamRef.current = null;
      }
    }
  }, []);

  const disposeRecorder = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      try {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      } catch {
        /* no-op */
      }
      mediaRecorderRef.current = null;
    }
    audioChunksRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      disposeRecorder();
      releaseMediaStream();
    };
  }, [disposeRecorder, releaseMediaStream]);

  useEffect(() => {
    const onPageHide = () => {
      try {
        disposeRecorder();
        releaseMediaStream();
      } catch {
        /* no-op */
      }
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [disposeRecorder, releaseMediaStream]);

  // ----- Voice processing delegate ------------------------------------------
  const runProcessing = useCallback(
    async (audioBlob, recordingMs) => {
      if (typeof processVoice !== 'function') {
        // Recording works on its own; intent processing is optional.
        return;
      }
      setStatus('processing');
      try {
        const result = await processVoice(audioBlob, { recordingMs });
        if (isUnmountedRef.current) return;

        // Defensive: result must at least have a transcript & intent string.
        const transcript = (result?.transcript || '').trim();
        const intent =
          typeof result?.intent === 'string' && result.intent ? result.intent : 'UNKNOWN';
        const confidence =
          typeof result?.confidence === 'number'
            ? Math.max(0, Math.min(1, result.confidence))
            : 0;
        const entity = typeof result?.entity === 'string' ? result.entity : null;
        const parameters =
          result?.parameters && typeof result.parameters === 'object'
            ? result.parameters
            : {};

        if (!transcript && intent === 'UNKNOWN') {
          toast.message('No speech detected. Please try again.');
          setStatus('idle');
          return;
        }

        const normalised = { transcript, intent, confidence, entity, parameters };
        setIntentResult(normalised);
        setStatus('idle');

        if (typeof onIntentReady === 'function') {
          onIntentReady(normalised, audioBlob);
        }
      } catch (error) {
        if (isUnmountedRef.current) return;
        setStatus('idle');
        const message =
          error?.message || 'We couldn\u2019t process that recording. Please try again.';
        toast.error(message);
        if (typeof onError === 'function') {
          onError(error);
        }
      }
    },
    [onError, onIntentReady, processVoice],
  );

  // ----- Recording lifecycle ------------------------------------------------
  const startRecording = useCallback(async () => {
    if (status !== 'idle') return;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Microphone is not supported in this browser.');
      return;
    }

    setStatus('starting');
    setIntentResult(null);
    cancelRequestedRef.current = false;

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (isUnmountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];
        releaseMediaStream();

        const startedAt = recordingStartedAtRef.current;
        const recordingMs =
          typeof startedAt === 'number' ? Math.round(performance.now() - startedAt) : 0;
        recordingStartedAtRef.current = null;

        if (isUnmountedRef.current) return;

        if (typeof onRecordingStopped === 'function') {
          onRecordingStopped(audioBlob);
        }

        if (IS_DEV) {
          console.debug('[VoiceAssistant] recording stopped', {
            sizeBytes: audioBlob.size,
            recordingMs,
            mimeType,
          });
        }

        if (cancelRequestedRef.current) {
          cancelRequestedRef.current = false;
          setStatus('idle');
          return;
        }

        if (!audioBlob.size) {
          toast.error('No audio was captured. Please try again.');
          setStatus('idle');
          return;
        }

        runProcessing(audioBlob, recordingMs);
      };

      recorder.onerror = () => {
        releaseMediaStream();
        if (isUnmountedRef.current) return;
        setStatus('idle');
        toast.error('Recording failed. Please try again.');
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      recordingStartedAtRef.current = performance.now();
      setStatus('recording');

      if (typeof onRecordingStarted === 'function') {
        onRecordingStarted();
      }
    } catch (error) {
      if (stream) {
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch {
          /* no-op */
        }
      }
      releaseMediaStream();
      if (isUnmountedRef.current) return;
      setStatus('idle');
      const message =
        error?.name === 'NotAllowedError'
          ? 'Microphone permission denied. Enable mic access in your browser to use voice.'
          : error?.name === 'NotFoundError'
            ? 'No microphone was found on this device.'
            : 'Unable to access microphone.';
      toast.error(message);
    }
  }, [onRecordingStarted, onRecordingStopped, releaseMediaStream, runProcessing, status]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        releaseMediaStream();
        setStatus('idle');
      }
    } else {
      releaseMediaStream();
      setStatus('idle');
    }
  }, [releaseMediaStream]);

  const handleToggle = useCallback(() => {
    if (status === 'recording') {
      stopRecording();
    } else if (status === 'idle') {
      startRecording();
    }
  }, [status, startRecording, stopRecording]);

  // ----- Render -------------------------------------------------------------
  const isRecording = status === 'recording';
  const isProcessing = status === 'processing';
  const isStarting = status === 'starting';
  const isBusy = isStarting || isProcessing;

  const buttonAriaLabel = isRecording
    ? 'Stop voice recording'
    : isProcessing
      ? 'Processing audio'
      : 'Start voice recording';

  return (
    <div
      className={cn(
        'fixed z-[120] flex flex-col items-end gap-2',
        'bottom-6 right-6 sm:bottom-8 sm:right-8',
        className,
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {intentResult && (
        <IntentPanel
          result={intentResult}
          onDismiss={() => setIntentResult(null)}
        />
      )}

      {(isRecording || isProcessing) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-[2px] border border-divider bg-champagne px-3 py-2 shadow-md"
        >
          {isRecording ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
              </span>
              <span className="text-[12px] uppercase tracking-[0.12em] text-charcoal">
                Listening…
              </span>
            </>
          ) : (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-forest" />
              <span className="text-[12px] uppercase tracking-[0.12em] text-charcoal">
                Processing…
              </span>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        disabled={isBusy}
        aria-pressed={isRecording}
        aria-busy={isProcessing}
        aria-label={buttonAriaLabel}
        title={
          isRecording
            ? 'Stop recording'
            : isProcessing
              ? 'Processing…'
              : 'Start voice recording'
        }
        className={cn(
          'group relative inline-flex h-14 w-14 items-center justify-center rounded-full',
          'shadow-lg transition-all duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-forest',
          'disabled:cursor-not-allowed',
          isRecording
            ? 'bg-red-600 text-white hover:bg-red-700'
            : isProcessing
              ? 'bg-forest text-champagne opacity-80'
              : 'bg-forest text-champagne hover:bg-[#142A22]',
        )}
      >
        {isRecording && (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-red-500 opacity-60 animate-ping"
          />
        )}
        <span className="relative flex items-center justify-center">
          {isRecording ? (
            <Square className="h-5 w-5" fill="currentColor" />
          ) : isProcessing ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </span>
      </button>
    </div>
  );
}

/**
 * Temporary diagnostic panel used during Step 3.
 * Will be removed once Step 4 wires up real checklist actions.
 */
function IntentPanel({ result, onDismiss }) {
  const { transcript, intent, confidence, entity, parameters } = result;
  const confidencePct = `${Math.round((confidence || 0) * 100)}%`;
  const noteText =
    parameters && typeof parameters.note === 'string' ? parameters.note : null;
  const otherParamKeys = parameters
    ? Object.keys(parameters).filter((k) => k !== 'note' && k !== 'error')
    : [];

  return (
    <div
      role="region"
      aria-label="Detected intent"
      className="w-[min(360px,calc(100vw-3rem))] rounded-[2px] border border-divider bg-champagne p-4 shadow-lg"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.12em] text-warm-gray">
          Voice Intent
        </span>
        <button
          type="button"
          aria-label="Dismiss intent panel"
          onClick={onDismiss}
          className="rounded-[2px] p-1 text-warm-gray hover:bg-divider hover:text-charcoal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-forest"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <dl className="space-y-2 text-sm text-charcoal">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-warm-gray">
            Transcript
          </dt>
          <dd className="mt-0.5 whitespace-pre-wrap">
            {transcript || <span className="text-warm-gray italic">(empty)</span>}
          </dd>
        </div>

        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-warm-gray">
            Intent
          </dt>
          <dd className="mt-0.5 font-medium">{intent}</dd>
        </div>

        {entity && (
          <div>
            <dt className="text-[11px] uppercase tracking-[0.12em] text-warm-gray">
              Entity
            </dt>
            <dd className="mt-0.5">{entity}</dd>
          </div>
        )}

        {noteText && (
          <div>
            <dt className="text-[11px] uppercase tracking-[0.12em] text-warm-gray">
              Note
            </dt>
            <dd className="mt-0.5 whitespace-pre-wrap">{noteText}</dd>
          </div>
        )}

        {otherParamKeys.length > 0 && (
          <div>
            <dt className="text-[11px] uppercase tracking-[0.12em] text-warm-gray">
              Parameters
            </dt>
            <dd className="mt-0.5 font-mono text-xs">
              {JSON.stringify(
                otherParamKeys.reduce((acc, key) => {
                  acc[key] = parameters[key];
                  return acc;
                }, {}),
              )}
            </dd>
          </div>
        )}

        <div>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-warm-gray">
            Confidence
          </dt>
          <dd className="mt-0.5">
            <ConfidenceBar value={confidence} label={confidencePct} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

function ConfidenceBar({ value, label }) {
  const pct = Math.max(0, Math.min(1, value || 0)) * 100;
  const tone = pct >= 75 ? 'bg-forest' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-[2px] bg-divider">
        <div
          className={cn('h-full transition-all', tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-charcoal">{label}</span>
    </div>
  );
}
