import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic, Square, X, Loader2, Check, ArrowRight, Repeat as RepeatIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  VOICE_STAGES, FAILURE_MODES,
  buildSimulatedFailure, useVoiceDemo,
} from '@/contexts/VoiceDemoContext';

const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * VoiceAssistant -- PURE UI component (Step 5).
 *
 * Records audio, hands the blob to `processVoice` (provided by the
 * parent), and interprets the backend's ActionResult to produce
 * meaningful, contextual feedback:
 *
 *   - UPDATE_CHECKLIST       -> success toast + onAction (parent updates UI)
 *   - ADD_NOTE               -> "Note added." toast + onAction
 *   - READ_NEXT_STEP         -> in-place info card ("Next Step\n{itemText}")
 *   - REPEAT_STEP            -> in-place info card ("Current Step\n{itemText}")
 *   - FINISH_PROCEDURE       -> success toast + onAction
 *   - UNKNOWN / rejected     -> friendly error toast
 *   - requiresConfirmation   -> Yes/No card; Yes calls `confirmAction`
 *                               (no re-recording)
 *
 * Confidence, intent labels, JSON and transcripts are NEVER shown to
 * normal users; a small dev-only diagnostic strip appears at the
 * bottom when NODE_ENV === "development".
 *
 * Props:
 *   - processVoice?:    (blob, meta) => Promise<voiceResult>
 *   - confirmAction?:   ({intent,entity,parameters,transcript}) => Promise<voiceResult>
 *   - onAction?:        (voiceResult) => void   // fires on every executed action
 *   - onRecordingStarted?: () => void
 *   - onRecordingStopped?: (audioBlob) => void
 *   - onError?:         (Error) => void
 *   - className?: string
 *
 * voiceResult shape (returned by voiceService.processVoice / confirmVoiceAction):
 *   {
 *     success, transcript, intent, confidence, entity, parameters,
 *     requiresConfirmation, message, action: {type, data}, threshold,
 *     durations: {...}
 *   }
 */
export default function VoiceAssistant({
  processVoice,
  confirmAction,
  onAction,
  onRecordingStarted,
  onRecordingStopped,
  onError,
  className,
}) {
  const [status, setStatus] = useState('idle');
  // 'idle' | 'starting' | 'recording' | 'processing' | 'confirming'
  const [feedback, setFeedback] = useState(null);
  // feedback shapes:
  //   { kind: 'confirm', intent, entity, parameters, transcript, message }
  //   { kind: 'info',    title, body }
  //   { kind: 'devtrace', intent, confidence, action }  (dev only)
  const [devTrace, setDevTrace] = useState(null);

  // Demo / diagnostics context. When demoMode is off ALL of these are
  // no-ops, so production behaviour matches Step 5 exactly.
  const {
    demoMode, setStage, addInteraction, failureMode, replayHandlerRef,
  } = useVoiceDemo();

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const recordingStartedAtRef = useRef(null);
  const cancelRequestedRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const infoCardTimerRef = useRef(null);
  const stageTimersRef = useRef([]);
  // Hold the recording duration of the just-finished blob so that we can
  // attach it to the interaction record (durations.recordingMs is not in
  // the server response).
  const lastRecordingMsRef = useRef(0);

  // ----- Resource management ------------------------------------------------
  const releaseMediaStream = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (stream) {
      try { stream.getTracks().forEach((t) => t.stop()); } catch { /* no-op */ }
      mediaStreamRef.current = null;
    }
  }, []);

  const disposeRecorder = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* no-op */ }
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      disposeRecorder();
      releaseMediaStream();
      if (infoCardTimerRef.current) clearTimeout(infoCardTimerRef.current);
      stageTimersRef.current.forEach((id) => clearTimeout(id));
      stageTimersRef.current = [];
    };
  }, [disposeRecorder, releaseMediaStream]);

  useEffect(() => {
    const onPageHide = () => {
      disposeRecorder();
      releaseMediaStream();
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [disposeRecorder, releaseMediaStream]);

  // ----- Helpers ------------------------------------------------------------
  const clearStageTimers = useCallback(() => {
    stageTimersRef.current.forEach((id) => clearTimeout(id));
    stageTimersRef.current = [];
  }, []);

  const beginStageProgression = useCallback(() => {
    // After recording stops we don't know which sub-phase the server is
    // actually in (the network call is a single round-trip). To match
    // the requested UX progression we advance through the stages with
    // best-effort timings. The Performance panel has the real numbers.
    clearStageTimers();
    setStage(VOICE_STAGES.TRANSCRIBING);
    stageTimersRef.current.push(setTimeout(() => {
      if (!isUnmountedRef.current) setStage(VOICE_STAGES.UNDERSTANDING);
    }, 750));
    stageTimersRef.current.push(setTimeout(() => {
      if (!isUnmountedRef.current) setStage(VOICE_STAGES.EXECUTING);
    }, 1600));
  }, [clearStageTimers, setStage]);

  const finishStage = useCallback((nextStage, holdMs = 1200) => {
    clearStageTimers();
    setStage(nextStage);
    stageTimersRef.current.push(setTimeout(() => {
      if (!isUnmountedRef.current) setStage(VOICE_STAGES.READY);
    }, holdMs));
  }, [clearStageTimers, setStage]);

  const scheduleInfoCardDismiss = useCallback((ms = 8000) => {
    if (infoCardTimerRef.current) clearTimeout(infoCardTimerRef.current);
    infoCardTimerRef.current = setTimeout(() => {
      if (!isUnmountedRef.current) setFeedback(null);
    }, ms);
  }, []);

  const showInfoCard = useCallback((title, body) => {
    if (infoCardTimerRef.current) clearTimeout(infoCardTimerRef.current);
    setFeedback({ kind: 'info', title, body });
    scheduleInfoCardDismiss();
  }, [scheduleInfoCardDismiss]);

  const friendlyErrorMessage = useCallback((error) => {
    const status = error?.status;
    const code = error?.code;
    if (status === 401) return 'Please sign in to use voice commands.';
    if (status === 403) return 'You do not have permission to use voice on this procedure.';
    if (status === 404) return 'Procedure not found.';
    if (status === 409) return 'This procedure is already completed.';
    if (code === 'TIMEOUT') return 'Voice processing timed out. Please try again.';
    if (code === 'UPLOAD_FAILED' || code === 'NETWORK')
      return 'Network problem. Check your connection and try again.';
    if (code === 'NOT_CONFIGURED') return 'Voice is not available right now.';
    if (code === 'TOO_LARGE') return 'Recording is too long.';
    if (code === 'EMPTY_AUDIO') return 'No audio was captured. Please try again.';
    if (status === 500 || status === 502 || status === 503)
      return 'Voice service is unavailable. Please try again shortly.';
    return error?.message || 'Voice command failed. Please try again.';
  }, []);

  // Translate an ActionResult into UI side-effects. Returns true if the
  // assistant should remain idle (no persistent UI). Persistent UI
  // (confirm card or info card) is set via setFeedback inside.
  const handleActionResult = useCallback((result, opts = {}) => {
    if (!result || typeof result !== 'object') return;

    if (IS_DEV) {
      setDevTrace({
        intent: result.intent,
        confidence: result.confidence,
        action: result.action?.type,
        requiresConfirmation: !!result.requiresConfirmation,
      });
    }

    // 1) CONFIRMATION REQUIRED  ----------------------------------------------
    if (result.requiresConfirmation) {
      finishStage(VOICE_STAGES.CONFIRMATION_NEEDED, 9999_000);
      setFeedback({
        kind: 'confirm',
        intent: result.intent,
        entity: result.entity,
        parameters: result.parameters || {},
        transcript: result.transcript || '',
        message: result.message,
      });
      return;
    }

    const actionType = result.action?.type || 'none';
    const data = result.action?.data || {};

    // 2) EXECUTED WRITES  ----------------------------------------------------
    if (result.success && actionType === 'checklist_item_completed') {
      const itemText = data?.item?.text || result.entity || 'Step';
      toast.success(`${itemText} marked complete.${opts.replay ? ' (replay)' : ''}`);
      setFeedback(null);
      finishStage(VOICE_STAGES.COMPLETED);
      if (!opts.replay) onAction?.(result);
      return;
    }
    if (result.success && actionType === 'note_added') {
      toast.success(`Note added.${opts.replay ? ' (replay)' : ''}`);
      setFeedback(null);
      finishStage(VOICE_STAGES.COMPLETED);
      if (!opts.replay) onAction?.(result);
      return;
    }
    if (result.success && actionType === 'procedure_completed') {
      toast.success(`Procedure completed successfully.${opts.replay ? ' (replay)' : ''}`);
      setFeedback(null);
      finishStage(VOICE_STAGES.COMPLETED);
      if (!opts.replay) onAction?.(result);
      return;
    }

    // 3) READ-ONLY RESPONSES  ------------------------------------------------
    if (result.success && actionType === 'next_step_read') {
      if (data?.allComplete || !data?.item) {
        showInfoCard('Next Step', 'All steps complete.');
      } else {
        showInfoCard('Next Step', data.item.text || 'No upcoming step.');
      }
      finishStage(VOICE_STAGES.COMPLETED);
      if (!opts.replay) onAction?.(result);
      return;
    }
    if (result.success && actionType === 'current_step_repeated') {
      if (data?.allComplete || !data?.item) {
        showInfoCard('Current Step', 'All steps complete.');
      } else {
        showInfoCard('Current Step', data.item.text || 'No current step.');
      }
      finishStage(VOICE_STAGES.COMPLETED);
      if (!opts.replay) onAction?.(result);
      return;
    }

    // 4) UNKNOWN / REJECTED / NOT-APPLICABLE  -------------------------------
    if (result.intent === 'UNKNOWN') {
      toast.message("I couldn't understand that command.");
      setFeedback(null);
      finishStage(VOICE_STAGES.ERROR);
      return;
    }
    // Anything else: use the backend's message if present.
    toast.message(result.message || "I couldn't complete that.");
    setFeedback(null);
    finishStage(VOICE_STAGES.ERROR);
  }, [finishStage, onAction, showInfoCard]);

  // Expose the handler to the demo context for Replay support.
  useEffect(() => {
    replayHandlerRef.current = handleActionResult;
    return () => {
      if (replayHandlerRef.current === handleActionResult) {
        replayHandlerRef.current = null;
      }
    };
  }, [handleActionResult, replayHandlerRef]);

  // ----- Voice processing delegate ------------------------------------------
  const runProcessing = useCallback(async (audioBlob, recordingMs) => {
    if (typeof processVoice !== 'function') return;
    setStatus('processing');
    setFeedback(null);
    beginStageProgression();
    lastRecordingMsRef.current = recordingMs || 0;

    // Demo-mode failure simulation: short-circuit the network entirely.
    if (demoMode && failureMode && failureMode !== FAILURE_MODES.NONE) {
      const sim = buildSimulatedFailure(failureMode);
      // Add a small fake delay so the stage progression is visible.
      await new Promise((r) => setTimeout(r, 600));
      if (isUnmountedRef.current) return;
      setStatus('idle');
      if (sim?.__throw) {
        const err = sim.__throw;
        finishStage(VOICE_STAGES.ERROR);
        addInteraction({
          transcript: '(simulated)', intent: 'UNKNOWN', confidence: 0,
          entity: null, action: { type: 'none' }, success: false,
          requiresConfirmation: false,
          durations: { recordingMs: lastRecordingMsRef.current, totalMs: 600 },
          error: err.message || 'simulated error',
          simulated: true,
        });
        toast.error(friendlyErrorMessage(err));
        onError?.(err);
        return;
      }
      if (sim) {
        const enriched = {
          ...sim,
          durations: { ...sim.durations, recordingMs: lastRecordingMsRef.current },
        };
        addInteraction({
          transcript: enriched.transcript,
          intent: enriched.intent,
          confidence: enriched.confidence,
          entity: enriched.entity,
          action: enriched.action,
          success: enriched.success,
          requiresConfirmation: enriched.requiresConfirmation,
          threshold: enriched.threshold,
          durations: enriched.durations,
          result: enriched,
          simulated: true,
        });
        handleActionResult(enriched);
        return;
      }
    }

    try {
      const result = await processVoice(audioBlob, { recordingMs });
      if (isUnmountedRef.current) return;
      setStatus('idle');
      const enriched = {
        ...result,
        durations: { ...(result?.durations || {}), recordingMs },
      };
      // Capture this interaction in the demo timeline (no-op if demoMode off
      // because addInteraction only mutates state read by the panel/badge).
      addInteraction({
        transcript: enriched.transcript || '',
        intent: enriched.intent,
        confidence: enriched.confidence,
        entity: enriched.entity,
        action: enriched.action,
        success: enriched.success,
        requiresConfirmation: enriched.requiresConfirmation,
        threshold: enriched.threshold,
        durations: enriched.durations,
        result: enriched,
      });
      handleActionResult(enriched);
    } catch (error) {
      if (isUnmountedRef.current) return;
      setStatus('idle');
      finishStage(VOICE_STAGES.ERROR);
      addInteraction({
        transcript: '', intent: 'UNKNOWN', confidence: 0, entity: null,
        action: { type: 'none' }, success: false, requiresConfirmation: false,
        durations: { recordingMs: lastRecordingMsRef.current },
        error: error?.message || 'unknown error',
      });
      toast.error(friendlyErrorMessage(error));
      onError?.(error);
    }
  }, [
    addInteraction, beginStageProgression, demoMode, failureMode,
    finishStage, friendlyErrorMessage, handleActionResult,
    onError, processVoice,
  ]);

  // ----- Recording lifecycle ------------------------------------------------
  const startRecording = useCallback(async () => {
    if (status !== 'idle') return;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Microphone is not supported in this browser.');
      return;
    }

    setStatus('starting');
    setFeedback(null);
    setDevTrace(null);
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
        onRecordingStopped?.(audioBlob);

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
      setStage(VOICE_STAGES.LISTENING);
      onRecordingStarted?.();
    } catch (error) {
      if (stream) {
        try { stream.getTracks().forEach((t) => t.stop()); } catch { /* no-op */ }
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
      try { recorder.stop(); } catch {
        releaseMediaStream();
        setStatus('idle');
      }
    } else {
      releaseMediaStream();
      setStatus('idle');
    }
  }, [releaseMediaStream]);

  const handleToggle = useCallback(() => {
    if (status === 'recording') stopRecording();
    else if (status === 'idle') startRecording();
  }, [status, startRecording, stopRecording]);

  // ----- Confirmation flow --------------------------------------------------
  const handleConfirmYes = useCallback(async () => {
    if (feedback?.kind !== 'confirm') return;
    if (typeof confirmAction !== 'function') {
      toast.error('Confirmation is not available right now.');
      setFeedback(null);
      return;
    }
    const { intent, entity, parameters, transcript } = feedback;
    setStatus('confirming');
    setStage(VOICE_STAGES.CONFIRMING);
    try {
      const result = await confirmAction({ intent, entity, parameters, transcript });
      if (isUnmountedRef.current) return;
      setStatus('idle');
      addInteraction({
        transcript: transcript || '',
        intent: result?.intent || intent,
        confidence: result?.confidence ?? 1.0,
        entity: result?.entity ?? entity,
        action: result?.action,
        success: !!result?.success,
        requiresConfirmation: !!result?.requiresConfirmation,
        threshold: result?.threshold,
        durations: result?.durations,
        result,
        confirmed: true,
      });
      handleActionResult(result);
    } catch (error) {
      if (isUnmountedRef.current) return;
      setStatus('idle');
      finishStage(VOICE_STAGES.ERROR);
      toast.error(friendlyErrorMessage(error));
      onError?.(error);
    }
  }, [
    addInteraction, confirmAction, feedback, finishStage,
    friendlyErrorMessage, handleActionResult, onError, setStage,
  ]);

  const handleConfirmNo = useCallback(() => {
    setFeedback(null);
    finishStage(VOICE_STAGES.READY, 0);
  }, [finishStage]);

  // ----- Render -------------------------------------------------------------
  const isRecording = status === 'recording';
  const isProcessing = status === 'processing' || status === 'confirming';
  const isStarting = status === 'starting';
  const isBusy = isStarting || isProcessing;

  const buttonAriaLabel = isRecording
    ? 'Stop voice recording'
    : isProcessing
      ? 'Processing'
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
      {feedback?.kind === 'confirm' && (
        <ConfirmCard
          intent={feedback.intent}
          entity={feedback.entity}
          message={feedback.message}
          submitting={status === 'confirming'}
          onYes={handleConfirmYes}
          onNo={handleConfirmNo}
        />
      )}

      {feedback?.kind === 'info' && (
        <InfoCard
          title={feedback.title}
          body={feedback.body}
          onDismiss={() => setFeedback(null)}
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
                {status === 'confirming' ? 'Confirming…' : 'Processing…'}
              </span>
            </>
          )}
        </div>
      )}

      {IS_DEV && devTrace && (
        <DevTraceStrip trace={devTrace} onDismiss={() => setDevTrace(null)} />
      )}

      <button
        type="button"
        onClick={handleToggle}
        disabled={isBusy}
        aria-pressed={isRecording}
        aria-busy={isProcessing}
        aria-label={buttonAriaLabel}
        title={
          isRecording ? 'Stop recording' : isProcessing ? 'Processing' : 'Start voice recording'
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

// --------------------------------------------------------------------------- //
// Sub-components                                                              //
// --------------------------------------------------------------------------- //

function ConfirmCard({ intent, entity, message, submitting, onYes, onNo }) {
  // Choose a clear question per intent. Falls back to the backend message.
  const title = intent === 'UPDATE_CHECKLIST'
    ? 'Mark this step complete?'
    : intent === 'ADD_NOTE'
      ? 'Add this note?'
      : intent === 'READ_NEXT_STEP'
        ? 'Read the next step?'
        : intent === 'REPEAT_STEP'
          ? 'Repeat the current step?'
          : intent === 'FINISH_PROCEDURE'
            ? 'Finish this procedure?'
            : 'Did you mean…';
  const subject = entity || message || '';
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Confirm voice command"
      className="w-[min(360px,calc(100vw-3rem))] rounded-[2px] border border-divider bg-champagne p-4 shadow-lg"
    >
      <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-warm-gray">
        Did you mean
      </div>
      <div className="mb-3 text-[15px] font-medium text-charcoal">{title}</div>
      {subject && (
        <div className="mb-4 rounded-[2px] border border-divider bg-white px-3 py-2 text-[15px] font-semibold text-charcoal">
          {subject}
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onNo}
          disabled={submitting}
          className="rounded-[2px] border border-divider bg-white px-3 py-1.5 text-sm text-charcoal hover:bg-divider disabled:opacity-60"
        >
          No
        </button>
        <button
          type="button"
          onClick={onYes}
          disabled={submitting}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[2px] bg-forest px-3 py-1.5 text-sm text-champagne hover:bg-[#142A22]',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Yes
        </button>
      </div>
    </div>
  );
}

function InfoCard({ title, body, onDismiss }) {
  const Icon = title === 'Next Step' ? ArrowRight : RepeatIcon;
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-[min(360px,calc(100vw-3rem))] rounded-[2px] border border-divider bg-champagne p-4 shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-forest" />
          <span className="text-[11px] uppercase tracking-[0.12em] text-warm-gray">
            {title}
          </span>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="rounded-[2px] p-1 text-warm-gray hover:bg-divider hover:text-charcoal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-forest"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="text-[17px] font-semibold leading-snug text-charcoal">{body}</div>
    </div>
  );
}

function DevTraceStrip({ trace, onDismiss }) {
  const pct =
    typeof trace.confidence === 'number'
      ? `${Math.round(Math.max(0, Math.min(1, trace.confidence)) * 100)}%`
      : 'n/a';
  return (
    <div
      role="note"
      aria-label="Developer diagnostics"
      className="flex items-center gap-1.5 rounded-[2px] border border-dashed border-warm-gray/40 bg-white/80 px-2 py-1 text-[10px] font-mono text-warm-gray shadow-sm"
    >
      <span>dev:</span>
      <span className="text-charcoal">{trace.intent || '?'}</span>
      <span>·</span>
      <span className="text-charcoal">{pct}</span>
      <span>·</span>
      <span className="text-charcoal">{trace.action || 'none'}</span>
      {trace.requiresConfirmation && (
        <>
          <span>·</span>
          <span className="text-amber-700">confirm</span>
        </>
      )}
      <button
        type="button"
        aria-label="Hide dev trace"
        onClick={onDismiss}
        className="ml-1 rounded p-0.5 text-warm-gray hover:bg-divider hover:text-charcoal"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
