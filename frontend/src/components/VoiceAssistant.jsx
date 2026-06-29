import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * VoiceAssistant — PURE UI component.
 *
 * Records audio with MediaRecorder and manages local UI state
 * (idle / starting / recording / transcribing). All network/provider work is
 * delegated to the parent via the `transcribeAudio` callback. No API calls,
 * no provider-specific code, no checklist logic lives here.
 *
 * Props:
 *   - transcribeAudio?: (audioBlob: Blob, meta: { recordingMs: number }) =>
 *       Promise<{ transcript: string } | string>
 *   - onRecordingStarted?: () => void
 *   - onRecordingStopped?: (audioBlob: Blob) => void
 *   - onTranscriptReady?: (transcript: string, audioBlob: Blob) => void
 *   - onError?: (error: Error) => void
 *   - className?: string
 */
export default function VoiceAssistant({
  transcribeAudio,
  onRecordingStarted,
  onRecordingStopped,
  onTranscriptReady,
  onError,
  className,
}) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'starting' | 'recording' | 'transcribing'
  const [transcript, setTranscript] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const recordingStartedAtRef = useRef(null);
  const cancelRequestedRef = useRef(false);
  const isUnmountedRef = useRef(false);

  // ----- Resource management -------------------------------------------------
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
        // Detach event handlers BEFORE stopping so a late onstop callback
        // can't touch unmounted-component state.
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

  // Always release resources on unmount.
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      disposeRecorder();
      releaseMediaStream();
    };
  }, [disposeRecorder, releaseMediaStream]);

  // Safety: also release if the page becomes hidden during a long recording.
  // The browser will release the mic on unload, but explicit cleanup avoids
  // lingering active tracks during background tab transitions.
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

  // ----- Transcription delegate ---------------------------------------------
  const runTranscription = useCallback(
    async (audioBlob, recordingMs) => {
      if (typeof transcribeAudio !== 'function') {
        // Recording works on its own; transcription is optional.
        return;
      }
      setStatus('transcribing');
      try {
        const result = await transcribeAudio(audioBlob, { recordingMs });
        if (isUnmountedRef.current) return;

        const text =
          typeof result === 'string' ? result : (result?.transcript || '').trim();

        if (!text) {
          toast.message('No speech detected. Please try again.');
          setStatus('idle');
          return;
        }

        setTranscript(text);
        setStatus('idle');
        if (typeof onTranscriptReady === 'function') {
          onTranscriptReady(text, audioBlob);
        }
      } catch (error) {
        if (isUnmountedRef.current) return;
        setStatus('idle');
        const message =
          error?.message || 'We couldn\u2019t transcribe that recording. Please try again.';
        toast.error(message);
        if (typeof onError === 'function') {
          onError(error);
        }
      }
    },
    [onError, onTranscriptReady, transcribeAudio],
  );

  // ----- Recording lifecycle ------------------------------------------------
  const startRecording = useCallback(async () => {
    if (status !== 'idle') return;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Microphone is not supported in this browser.');
      return;
    }

    setStatus('starting');
    setTranscript(null);
    cancelRequestedRef.current = false;

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (isUnmountedRef.current) {
        // Component went away while the permission prompt was open.
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
        // Free chunk references promptly so the GC can reclaim memory.
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

        runTranscription(audioBlob, recordingMs);
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
      // Always free a partial stream on failure.
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
  }, [onRecordingStarted, onRecordingStopped, releaseMediaStream, runTranscription, status]);

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

  // ----- Render --------------------------------------------------------------
  const isRecording = status === 'recording';
  const isTranscribing = status === 'transcribing';
  const isStarting = status === 'starting';
  const isBusy = isStarting || isTranscribing;

  const buttonAriaLabel = isRecording
    ? 'Stop voice recording'
    : isTranscribing
      ? 'Transcribing audio'
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
      {transcript && (
        <div
          role="region"
          aria-label="Transcript"
          className="w-[min(360px,calc(100vw-3rem))] rounded-[2px] border border-divider bg-champagne p-4 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.12em] text-warm-gray">
              Transcript
            </span>
            <button
              type="button"
              aria-label="Dismiss transcript"
              onClick={() => setTranscript(null)}
              className="rounded-[2px] p-1 text-warm-gray hover:bg-divider hover:text-charcoal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-forest"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-sm leading-relaxed text-charcoal whitespace-pre-wrap">
            {transcript}
          </p>
        </div>
      )}

      {(isRecording || isTranscribing) && (
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
                Transcribing…
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
        aria-busy={isTranscribing}
        aria-label={buttonAriaLabel}
        title={
          isRecording
            ? 'Stop recording'
            : isTranscribing
              ? 'Transcribing…'
              : 'Start voice recording'
        }
        className={cn(
          'group relative inline-flex h-14 w-14 items-center justify-center rounded-full',
          'shadow-lg transition-all duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-forest',
          'disabled:cursor-not-allowed',
          isRecording
            ? 'bg-red-600 text-white hover:bg-red-700'
            : isTranscribing
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
          ) : isTranscribing ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </span>
      </button>
    </div>
  );
}
