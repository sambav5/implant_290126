import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * VoiceAssistant — PURE UI component.
 *
 * It records audio with MediaRecorder, manages local UI state (idle /
 * listening / transcribing / showing transcript), and delegates the actual
 * transcription work to the parent through the `transcribeAudio` callback.
 *
 * No API calls, no provider-specific logic, no network code lives here.
 *
 * Props:
 *   - transcribeAudio?: (audioBlob: Blob, meta: { recordingMs: number }) => Promise<{ transcript: string }>
 *       Provided by the parent. Returns the transcribed text. If omitted,
 *       the component still records but won't show a transcript card.
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
  // Mutually-exclusive UI status drives all visuals.
  const [status, setStatus] = useState('idle'); // 'idle' | 'starting' | 'recording' | 'transcribing'
  const [transcript, setTranscript] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const recordingStartedAtRef = useRef(null);
  const cancelRequestedRef = useRef(false);

  const stopMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      stopMediaStream();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          /* no-op */
        }
      }
    };
  }, [stopMediaStream]);

  const runTranscription = useCallback(
    async (audioBlob, recordingMs) => {
      if (typeof transcribeAudio !== 'function') {
        // Recording works on its own; transcription is optional.
        return;
      }
      setStatus('transcribing');
      try {
        const result = await transcribeAudio(audioBlob, { recordingMs });
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

  const startRecording = useCallback(async () => {
    if (status !== 'idle') return;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Microphone is not supported in this browser.');
      return;
    }

    setStatus('starting');
    setTranscript(null);
    cancelRequestedRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        stopMediaStream();

        const startedAt = recordingStartedAtRef.current;
        const recordingMs =
          typeof startedAt === 'number' ? Math.round(performance.now() - startedAt) : 0;
        recordingStartedAtRef.current = null;

        if (typeof onRecordingStopped === 'function') {
          onRecordingStopped(audioBlob);
        }
         
        console.info('[VoiceAssistant] recording stopped', {
          sizeBytes: audioBlob.size,
          recordingMs,
          mimeType,
        });

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
        stopMediaStream();
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
      stopMediaStream();
      setStatus('idle');
      const message =
        error?.name === 'NotAllowedError'
          ? 'Microphone permission denied.'
          : 'Unable to access microphone.';
      toast.error(message);
    }
  }, [onRecordingStarted, onRecordingStopped, runTranscription, status, stopMediaStream]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        stopMediaStream();
        setStatus('idle');
      }
    } else {
      stopMediaStream();
      setStatus('idle');
    }
  }, [stopMediaStream]);

  const handleToggle = useCallback(() => {
    if (status === 'recording') {
      stopRecording();
    } else if (status === 'idle') {
      startRecording();
    }
  }, [status, startRecording, stopRecording]);

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
      {/* Transcript floating card (shown after a successful transcription) */}
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

      {/* Status card: Listening / Transcribing */}
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

      {/* Mic button */}
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
