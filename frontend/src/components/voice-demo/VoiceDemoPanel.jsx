/**
 * VoiceDemoPanel - collapsible developer / demo panel.
 *
 * Rendered ONLY when demoMode === true. Hidden by default. Has tabs:
 *   - Timeline    (recent interactions, with replay buttons)
 *   - Performance (last interaction's latency breakdown)
 *   - History     (last 20 transcripts + result; clear button)
 *   - Stats       (avg response time, avg confidence, confirmation rate)
 *   - Failure Sim (inject errors for demos)
 *
 * Lives at the right edge of the viewport; never blocks the checklist.
 * Does NOT call any backend; reads only from VoiceDemoContext.
 */
import { useState } from 'react';
import {
  Activity, BarChart3, History as HistoryIcon, Play, Trash2, X,
  AlertTriangle, ChevronDown, ChevronRight, Clock,
} from 'lucide-react';
import {
  useVoiceDemo, FAILURE_MODES,
} from '@/contexts/VoiceDemoContext';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'timeline',    label: 'Timeline',    icon: Activity },
  { id: 'performance', label: 'Performance', icon: BarChart3 },
  { id: 'history',     label: 'History',     icon: HistoryIcon },
  { id: 'stats',       label: 'Stats',       icon: Clock },
  { id: 'failures',    label: 'Failure Sim', icon: AlertTriangle },
];

function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

function formatMs(n) {
  if (n == null || Number.isNaN(n)) return '–';
  if (n < 1000) return `${Math.round(n)} ms`;
  return `${(n / 1000).toFixed(2)} s`;
}

function resultBadge(record) {
  if (record.requiresConfirmation) return { label: 'Confirmation', tone: 'warn' };
  if (record.success) return { label: 'Success', tone: 'ok' };
  if (record.error) return { label: 'Failed', tone: 'err' };
  if (record.intent === 'UNKNOWN') return { label: 'Unknown', tone: 'warn' };
  return { label: 'Failed', tone: 'err' };
}

export default function VoiceDemoPanel() {
  const {
    demoMode, isPanelOpen, setPanelOpen,
    interactions, clearHistory, replayInteraction,
    failureMode, setFailureMode,
    stats,
  } = useVoiceDemo();
  const [tab, setTab] = useState('timeline');
  const [expanded, setExpanded] = useState({});

  if (!demoMode) return null;

  const toggleExpand = (id) => setExpanded((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div
      className={cn(
        'pointer-events-auto fixed right-0 top-1/2 z-[110] -translate-y-1/2',
        'flex items-stretch',
      )}
      aria-label="Voice demo panel"
    >
      {/* Side-tab toggle */}
      {!isPanelOpen && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className={cn(
            'group flex items-center gap-1.5 rounded-l-md border border-r-0 border-divider',
            'bg-champagne px-2 py-3 text-[11px] uppercase tracking-[0.12em] text-charcoal shadow-md',
            'hover:bg-white',
          )}
          aria-label="Open voice demo panel"
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Demo</span>
          <ChevronRight className="h-3 w-3" />
        </button>
      )}

      {/* Panel body */}
      {isPanelOpen && (
        <div
          className={cn(
            'flex h-[min(80vh,640px)] w-[min(420px,calc(100vw-1rem))] flex-col',
            'rounded-l-md border border-r-0 border-divider bg-champagne shadow-xl',
          )}
          role="region"
          aria-label="Voice diagnostics"
        >
          <header className="flex items-center justify-between gap-2 border-b border-divider px-3 py-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-forest" />
              <h2 className="font-serif text-[15px] tracking-tight text-charcoal">
                Voice Diagnostics
              </h2>
              <span className="ml-1 rounded-full bg-forest/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-forest">
                Demo Mode
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="rounded p-1 text-warm-gray hover:bg-divider hover:text-charcoal"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {/* Tabs */}
          <nav className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-divider bg-white/40 px-2">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-[11px] uppercase tracking-[0.1em]',
                    active
                      ? 'border-forest text-forest'
                      : 'border-transparent text-warm-gray hover:text-charcoal',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {t.label}
                </button>
              );
            })}
          </nav>

          <div className="min-h-0 flex-1 overflow-auto px-3 py-3 text-[13px] text-charcoal">
            {tab === 'timeline' && (
              <Timeline
                interactions={interactions}
                expanded={expanded}
                onToggle={toggleExpand}
                onReplay={replayInteraction}
              />
            )}
            {tab === 'performance' && (
              <PerformancePanel interactions={interactions} />
            )}
            {tab === 'history' && (
              <HistoryPanel interactions={interactions} onClear={clearHistory} />
            )}
            {tab === 'stats' && <StatsPanel stats={stats} />}
            {tab === 'failures' && (
              <FailurePanel
                failureMode={failureMode}
                setFailureMode={setFailureMode}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Tabs                                                                        //
// --------------------------------------------------------------------------- //
function Timeline({ interactions, expanded, onToggle, onReplay }) {
  if (!interactions.length) {
    return <Empty message="No interactions yet. Try a voice command." />;
  }
  return (
    <ol className="space-y-2">
      {interactions.map((r) => {
        const isOpen = !!expanded[r.id];
        const badge = resultBadge(r);
        return (
          <li
            key={r.id}
            className={cn(
              'rounded-[3px] border border-divider bg-white/70 p-2.5',
              r.replay && 'border-dashed border-forest/40 bg-forest/5',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-warm-gray">
                  {formatTime(r.timestamp)}
                </span>
                {r.replay && (
                  <span className="rounded-full bg-forest/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-forest">
                    Replay
                  </span>
                )}
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </div>
              <div className="flex items-center gap-1">
                {r.result && !r.replay && (
                  <button
                    type="button"
                    onClick={() => onReplay(r)}
                    title="Replay this command's UI effect"
                    className="rounded p-1 text-warm-gray hover:bg-divider hover:text-forest"
                    aria-label="Replay interaction"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onToggle(r.id)}
                  className="rounded p-1 text-warm-gray hover:bg-divider hover:text-charcoal"
                  aria-label={isOpen ? 'Collapse details' : 'Expand details'}
                >
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="mt-1.5 text-[13px] text-charcoal">
              <span aria-hidden>🎤</span>{' '}
              <span className="italic">
                {r.transcript || <span className="text-warm-gray">(empty)</span>}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-[12px] text-warm-gray">
              <span aria-hidden>↓</span>
              <span className="font-medium text-charcoal">{r.intent || 'UNKNOWN'}</span>
              {r.entity && (
                <>
                  <span aria-hidden>·</span>
                  <span>{r.entity}</span>
                </>
              )}
              <span aria-hidden>·</span>
              <span className="tabular-nums">
                {Math.round((Number(r.confidence) || 0) * 100)}%
              </span>
            </div>

            {isOpen && (
              <dl className="mt-2 grid grid-cols-2 gap-1 rounded-[2px] bg-white px-2 py-1.5 text-[11px] text-charcoal">
                <dt className="text-warm-gray">Action</dt>
                <dd className="text-right font-mono">{r.action?.type || 'none'}</dd>
                <dt className="text-warm-gray">Threshold</dt>
                <dd className="text-right tabular-nums">
                  {typeof r.threshold === 'number' ? r.threshold.toFixed(2) : '–'}
                </dd>
                <dt className="text-warm-gray">Server total</dt>
                <dd className="text-right tabular-nums">{formatMs(r.durations?.totalMs)}</dd>
                <dt className="text-warm-gray">STT</dt>
                <dd className="text-right tabular-nums">{formatMs(r.durations?.sttMs)}</dd>
                <dt className="text-warm-gray">Intent</dt>
                <dd className="text-right tabular-nums">{formatMs(r.durations?.intentMs)}</dd>
                <dt className="text-warm-gray">Recording</dt>
                <dd className="text-right tabular-nums">{formatMs(r.durations?.recordingMs)}</dd>
              </dl>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function PerformancePanel({ interactions }) {
  const last = interactions.find((i) => !i.replay);
  if (!last) {
    return <Empty message="No timing data yet." />;
  }
  const d = last.durations || {};
  const rows = [
    { label: 'Recording',         value: d.recordingMs },
    { label: 'Upload + Routing',  value: d.uploadMs },
    { label: 'Speech-to-Text',    value: d.sttMs },
    { label: 'Intent Detection',  value: d.intentMs },
    { label: 'Execution',         value: d.orchestratorMs },
    { label: 'Total',             value: d.totalMs, emphasis: true },
  ];
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-[0.12em] text-warm-gray">
        Last command · {formatTime(last.timestamp)}
      </div>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li
            key={row.label}
            className={cn(
              'flex items-center justify-between rounded-[2px] border border-divider bg-white px-2.5 py-1.5',
              row.emphasis && 'border-forest/30 bg-forest/5',
            )}
          >
            <span className={cn(row.emphasis && 'font-semibold')}>{row.label}</span>
            <span className={cn('tabular-nums', row.emphasis && 'font-semibold')}>
              {formatMs(row.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HistoryPanel({ interactions, onClear }) {
  if (!interactions.length) {
    return <Empty message="No commands yet this session." />;
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.12em] text-warm-gray">
          Session history · {interactions.length} item{interactions.length === 1 ? '' : 's'} (max 20)
        </div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-[2px] border border-divider bg-white px-2 py-1 text-[11px] text-charcoal hover:bg-divider"
        >
          <Trash2 className="h-3 w-3" /> Clear
        </button>
      </div>
      <ul className="space-y-1">
        {interactions.map((r) => {
          const badge = resultBadge(r);
          return (
            <li
              key={r.id}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-[2px] border border-divider bg-white px-2 py-1.5"
            >
              <span className="font-mono text-[10px] text-warm-gray tabular-nums">
                {formatTime(r.timestamp)}
              </span>
              <span className="truncate text-[12px] italic">
                {r.transcript || <span className="text-warm-gray">(empty)</span>}
              </span>
              <Badge tone={badge.tone}>{badge.label}</Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatsPanel({ stats }) {
  const items = [
    { label: 'Total commands',      value: stats.total },
    { label: 'Avg response',        value: formatMs(stats.avgResponseMs) },
    { label: 'Avg confidence',      value: `${Math.round((stats.avgConfidence || 0) * 100)}%` },
    { label: 'Confirmation rate',   value: `${Math.round((stats.confirmationRate || 0) * 100)}%` },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((s) => (
        <div
          key={s.label}
          className="rounded-[2px] border border-divider bg-white p-3 text-center"
        >
          <div className="text-[10px] uppercase tracking-[0.12em] text-warm-gray">
            {s.label}
          </div>
          <div className="mt-1 text-[20px] font-semibold tabular-nums text-charcoal">
            {s.value ?? '–'}
          </div>
        </div>
      ))}
      <p className="col-span-2 mt-1 text-[11px] text-warm-gray">
        Stats reflect the current browser session only and exclude replays.
      </p>
    </div>
  );
}

function FailurePanel({ failureMode, setFailureMode }) {
  const modes = [
    { id: FAILURE_MODES.NONE,            label: 'No simulation (default)',     desc: 'Real backend behaviour.' },
    { id: FAILURE_MODES.LOW_CONFIDENCE,  label: 'Low confidence',              desc: 'Forces a confirmation card.' },
    { id: FAILURE_MODES.UNKNOWN_COMMAND, label: 'Unknown command',             desc: 'Returns UNKNOWN intent.' },
    { id: FAILURE_MODES.STT_TIMEOUT,     label: 'Speech-to-Text timeout',      desc: 'Surfaces a friendly timeout toast.' },
    { id: FAILURE_MODES.NETWORK_ERROR,   label: 'Network error',               desc: 'Surfaces an offline-style error.' },
    { id: FAILURE_MODES.UNAUTHORIZED,    label: 'Unauthorized (401)',          desc: 'Surfaces the sign-in toast.' },
  ];
  return (
    <div className="space-y-2">
      <div className="rounded-[2px] border border-amber-300 bg-amber-50 px-2.5 py-2 text-[12px] text-amber-800">
        Failure simulation runs entirely in the browser. The selected
        outcome is returned instead of calling the backend.
      </div>
      <ul className="space-y-1">
        {modes.map((m) => (
          <li key={m.id}>
            <label className="flex cursor-pointer items-start gap-2 rounded-[2px] border border-divider bg-white px-2.5 py-2 hover:bg-divider/40">
              <input
                type="radio"
                name="failureMode"
                value={m.id}
                checked={failureMode === m.id}
                onChange={() => setFailureMode(m.id)}
                className="mt-0.5"
              />
              <div>
                <div className="text-[13px] font-medium text-charcoal">{m.label}</div>
                <div className="text-[11px] text-warm-gray">{m.desc}</div>
              </div>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Atoms                                                                       //
// --------------------------------------------------------------------------- //
function Badge({ children, tone = 'idle' }) {
  const klass = {
    ok:   'bg-forest/10 text-forest',
    warn: 'bg-amber-100 text-amber-800',
    err:  'bg-red-100 text-red-700',
    idle: 'bg-divider text-charcoal',
  }[tone];
  return (
    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', klass)}>
      {children}
    </span>
  );
}

function Empty({ message }) {
  return (
    <div className="flex h-full items-center justify-center py-8 text-center text-[12px] italic text-warm-gray">
      {message}
    </div>
  );
}
