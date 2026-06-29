import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * VoiceAssistant
 * ---------------
 * Floating microphone control that records audio from the user's microphone
 * using the browser's MediaRecorder API. Audio is kept in memory only — it is
 * never persisted or sent to any backend. The component is intentionally
 * isolated so it can be reused on any screen.
 *
 * Props:
 *   - onRecordingStarted?: () => void
 *       Called once recording successfully starts.
 *   - onRecordingStopped?: (audioBlob: Blob) => void
 *       Called when recording stops, with the captured audio Blob.
 *   - className?: string
 *       Optional extra classes for the floating wrapper.
 */
export default function VoiceAssistant({
  onRecordingStarted,
  onRecordingStopped,
  className,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);

  // Always release the mic stream on unmount.
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
  }, []);

  const stopMediaStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const startRecording = useCallback(async () => {
    if (isRecording || isStarting) return;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Microphone is not supported in this browser.');
      return;
    }

    setIsStarting(true);
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
        setIsRecording(false);

        if (typeof onRecordingStopped === 'function') {
          onRecordingStopped(audioBlob);
        }
        toast.success('Voice recording captured.');
      };

      recorder.onerror = () => {
        stopMediaStream();
        setIsRecording(false);
        toast.error('Recording failed. Please try again.');
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);

      if (typeof onRecordingStarted === 'function') {
        onRecordingStarted();
      }
    } catch (error) {
      stopMediaStream();
      const message =
        error?.name === 'NotAllowedError'
          ? 'Microphone permission denied.'
          : 'Unable to access microphone.';
      toast.error(message);
    } finally {
      setIsStarting(false);
    }
  }, [isRecording, isStarting, onRecordingStarted, onRecordingStopped]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        stopMediaStream();
        setIsRecording(false);
      }
    } else {
      stopMediaStream();
      setIsRecording(false);
    }
  }, []);

  const handleToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return (
    <div
      className={cn(
        'fixed z-[120] flex flex-col items-end gap-2',
        'bottom-6 right-6 sm:bottom-8 sm:right-8',
        className,
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {isRecording && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-[2px] border border-divider bg-champagne px-3 py-2 shadow-md"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
          </span>
          <span className="text-[12px] uppercase tracking-[0.12em] text-charcoal">
            Listening…
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        disabled={isStarting}
        aria-pressed={isRecording}
        aria-label={isRecording ? 'Stop voice recording' : 'Start voice recording'}
        title={isRecording ? 'Stop recording' : 'Start voice recording'}
        className={cn(
          'group relative inline-flex h-14 w-14 items-center justify-center rounded-full',
          'shadow-lg transition-all duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-forest',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          isRecording
            ? 'bg-red-600 text-white hover:bg-red-700'
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
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </span>
      </button>
    </div>
  );
}
