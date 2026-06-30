/**
 * VoiceDemoContext
 * -----------------
 * Single source of truth for everything "voice demo / diagnostics".
 *
 * NOTHING here changes the production voice architecture. All hooks
 * collapse to harmless no-ops when `demoMode === false`, which is the
 * default. When demo mode is OFF the app behaves identically to Step 5.
 *
 * Demo mode is enabled when EITHER:
 *   - process.env.REACT_APP_DEMO_MODE === "true"   (build-time)
 *   - localStorage.seamless_demo_mode === "true"   (runtime toggle)
 *
 * The runtime toggle lets us flip demo mode for a single browser
 * session without a rebuild.
 *
 * Public surface (via `useVoiceDemo()`):
 *   demoMode, setDemoMode, isDevMode
 *   stage, setStage
 *   interactions, addInteraction, clearHistory
 *   failureMode, setFailureMode
 *   stats                       // computed
 *   replayHandlerRef            // VoiceAssistant attaches its replay fn
 *   replayInteraction(record)
 *   isPanelOpen, setPanelOpen
 *
 * Storage policy: interactions live ONLY in React state. Nothing is
 * persisted to localStorage / sessionStorage / disk. Browser refresh
 * clears the timeline.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';

const STORAGE_KEY = 'seamless_demo_mode';
const MAX_INTERACTIONS = 20;
const IS_DEV = process.env.NODE_ENV === 'development';

// ---- Voice stage state machine -----------------------------------------
// 'ready' is the default. Transitions are pushed by VoiceAssistant via
// setStage(). The status badge / panel read this value.
export const VOICE_STAGES = {
  READY: 'ready',
  LISTENING: 'listening',
  TRANSCRIBING: 'transcribing',
  UNDERSTANDING: 'understanding',
  EXECUTING: 'executing',
  CONFIRMATION_NEEDED: 'confirmation_needed',
  CONFIRMING: 'confirming',
  COMPLETED: 'completed',
  ERROR: 'error',
};

export const FAILURE_MODES = {
  NONE: 'none',
  STT_TIMEOUT: 'stt_timeout',
  LOW_CONFIDENCE: 'low_confidence',
  NETWORK_ERROR: 'network_error',
  UNAUTHORIZED: 'unauthorized',
  UNKNOWN_COMMAND: 'unknown_command',
};

function readInitialDemoMode() {
  if (typeof process !== 'undefined' && process.env?.REACT_APP_DEMO_MODE === 'true') {
    return true;
  }
  try {
    return typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

const VoiceDemoContext = createContext({
  demoMode: false,
  setDemoMode: () => {},
  isDevMode: IS_DEV,
  stage: VOICE_STAGES.READY,
  setStage: () => {},
  interactions: [],
  addInteraction: () => {},
  clearHistory: () => {},
  failureMode: FAILURE_MODES.NONE,
  setFailureMode: () => {},
  stats: { total: 0, avgResponseMs: 0, avgConfidence: 0, confirmationRate: 0 },
  replayHandlerRef: { current: null },
  replayInteraction: () => {},
  isPanelOpen: false,
  setPanelOpen: () => {},
});

export function VoiceDemoProvider({ children }) {
  const [demoMode, setDemoModeRaw] = useState(readInitialDemoMode);
  const [stage, setStageState] = useState(VOICE_STAGES.READY);
  const [interactions, setInteractions] = useState([]);
  const [failureMode, setFailureMode] = useState(FAILURE_MODES.NONE);
  const [isPanelOpen, setPanelOpen] = useState(false);

  // VoiceAssistant assigns its handleActionResult fn into this ref so the
  // panel can replay any past interaction without going through the
  // network. Decoupled via ref to avoid prop-drilling and re-renders.
  const replayHandlerRef = useRef(null);

  const setDemoMode = useCallback((next) => {
    setDemoModeRaw(Boolean(next));
    try {
      if (next) localStorage.setItem(STORAGE_KEY, 'true');
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* localStorage unavailable - that's fine */
    }
  }, []);

  // When demo mode is disabled, clear all transient demo state so the
  // app returns to exactly Step 5 behaviour.
  useEffect(() => {
    if (!demoMode) {
      setInteractions([]);
      setFailureMode(FAILURE_MODES.NONE);
      setPanelOpen(false);
    }
  }, [demoMode]);

  const setStage = useCallback((next) => {
    setStageState(next || VOICE_STAGES.READY);
  }, []);

  const addInteraction = useCallback((record) => {
    if (!record) return;
    const stamped = {
      id: record.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: record.timestamp || new Date().toISOString(),
      ...record,
    };
    setInteractions((prev) => {
      const next = [stamped, ...prev];
      return next.length > MAX_INTERACTIONS ? next.slice(0, MAX_INTERACTIONS) : next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setInteractions([]);
  }, []);

  const replayInteraction = useCallback((record) => {
    const handler = replayHandlerRef.current;
    if (typeof handler !== 'function' || !record?.result) return false;
    // Mark the replay row so the user can tell replays from real runs.
    addInteraction({
      ...record,
      id: `replay-${record.id || Date.now()}`,
      replay: true,
      timestamp: new Date().toISOString(),
    });
    try {
      handler(record.result, { replay: true });
      return true;
    } catch {
      return false;
    }
  }, [addInteraction]);

  const stats = useMemo(() => {
    if (!interactions.length) {
      return { total: 0, avgResponseMs: 0, avgConfidence: 0, confirmationRate: 0 };
    }
    const reals = interactions.filter((i) => !i.replay);
    const total = reals.length;
    if (!total) return { total: 0, avgResponseMs: 0, avgConfidence: 0, confirmationRate: 0 };

    const sumMs = reals.reduce((acc, i) => acc + (i.durations?.totalMs || 0), 0);
    const sumConf = reals.reduce((acc, i) => acc + (Number(i.confidence) || 0), 0);
    const confs = reals.filter((i) => i.requiresConfirmation).length;
    return {
      total,
      avgResponseMs: Math.round(sumMs / total),
      avgConfidence: Number((sumConf / total).toFixed(2)),
      confirmationRate: Number((confs / total).toFixed(2)),
    };
  }, [interactions]);

  const value = useMemo(() => ({
    demoMode, setDemoMode,
    isDevMode: IS_DEV,
    stage, setStage,
    interactions, addInteraction, clearHistory,
    failureMode, setFailureMode,
    stats,
    replayHandlerRef,
    replayInteraction,
    isPanelOpen, setPanelOpen,
  }), [
    demoMode, setDemoMode, stage, setStage,
    interactions, addInteraction, clearHistory,
    failureMode, stats, replayInteraction,
    isPanelOpen,
  ]);

  return (
    <VoiceDemoContext.Provider value={value}>
      {children}
    </VoiceDemoContext.Provider>
  );
}

export function useVoiceDemo() {
  return useContext(VoiceDemoContext);
}

/**
 * Convenience: synthesize a fake voiceService.processVoice result
 * for the configured failure mode. Returns null when failureMode is
 * NONE (so the caller proceeds to the real backend).
 *
 * The synthesized results match the production shape so the rest of
 * the UI behaves exactly as it would on a real run.
 */
export function buildSimulatedFailure(failureMode) {
  if (!failureMode || failureMode === FAILURE_MODES.NONE) return null;

  if (failureMode === FAILURE_MODES.STT_TIMEOUT) {
    const err = new Error('Voice processing timed out. Please try again.');
    err.code = 'TIMEOUT';
    err.status = 504;
    return { __throw: err };
  }
  if (failureMode === FAILURE_MODES.NETWORK_ERROR) {
    const err = new Error('Network problem. Check your connection and try again.');
    err.code = 'UPLOAD_FAILED';
    return { __throw: err };
  }
  if (failureMode === FAILURE_MODES.UNAUTHORIZED) {
    const err = new Error('You are not authorized.');
    err.code = 'UNAUTHORIZED';
    err.status = 401;
    return { __throw: err };
  }
  if (failureMode === FAILURE_MODES.LOW_CONFIDENCE) {
    return {
      success: false,
      transcript: '(simulated) irrigation',
      intent: 'UPDATE_CHECKLIST',
      confidence: 0.62,
      entity: 'Irrigation',
      parameters: {},
      requiresConfirmation: true,
      message: "Did you mean to mark 'Irrigation' complete?",
      action: { type: 'none', data: {} },
      threshold: 0.9,
      durations: { uploadMs: 80, sttMs: 600, intentMs: 300, totalMs: 980 },
    };
  }
  if (failureMode === FAILURE_MODES.UNKNOWN_COMMAND) {
    return {
      success: false,
      transcript: '(simulated) order me a pizza',
      intent: 'UNKNOWN',
      confidence: 0.02,
      entity: null,
      parameters: {},
      requiresConfirmation: false,
      message: "Sorry, I didn't catch a command.",
      action: { type: 'none', data: {} },
      threshold: 0.9,
      durations: { uploadMs: 70, sttMs: 580, intentMs: 290, totalMs: 940 },
    };
  }
  return null;
}
