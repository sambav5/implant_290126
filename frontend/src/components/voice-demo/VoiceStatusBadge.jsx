/**
 * VoiceStatusBadge - small, ambient indicator of the current voice
 * processing stage. Visible whenever demo mode is on OR the stage is
 * anything other than 'ready'. Always non-blocking; pure presentation.
 */
import { VOICE_STAGES, useVoiceDemo } from '@/contexts/VoiceDemoContext';
import { cn } from '@/lib/utils';

const STAGE_DESC = {
  [VOICE_STAGES.READY]:               { icon: '🎤', label: 'Ready',                tone: 'idle' },
  [VOICE_STAGES.LISTENING]:           { icon: '🎤', label: 'Listening',            tone: 'recording' },
  [VOICE_STAGES.TRANSCRIBING]:        { icon: '✍️', label: 'Transcribing',         tone: 'working' },
  [VOICE_STAGES.UNDERSTANDING]:       { icon: '🧠', label: 'Understanding',        tone: 'working' },
  [VOICE_STAGES.EXECUTING]:           { icon: '⚙️', label: 'Executing',            tone: 'working' },
  [VOICE_STAGES.CONFIRMATION_NEEDED]: { icon: '⚠️', label: 'Confirmation Needed',  tone: 'warn' },
  [VOICE_STAGES.CONFIRMING]:          { icon: '⚙️', label: 'Confirming',           tone: 'working' },
  [VOICE_STAGES.COMPLETED]:           { icon: '✅', label: 'Done',                 tone: 'ok' },
  [VOICE_STAGES.ERROR]:               { icon: '❌', label: 'Error',                tone: 'err' },
};

export default function VoiceStatusBadge({ className }) {
  const { demoMode, stage } = useVoiceDemo();
  // When demo mode is off, only show transient working states; hide on 'ready'.
  if (!demoMode && stage === VOICE_STAGES.READY) return null;

  const desc = STAGE_DESC[stage] || STAGE_DESC[VOICE_STAGES.READY];
  const toneClass = {
    idle:      'border-divider bg-champagne text-charcoal',
    recording: 'border-red-300 bg-red-50 text-red-700',
    working:   'border-forest/30 bg-white text-forest',
    warn:      'border-amber-300 bg-amber-50 text-amber-700',
    ok:        'border-forest/40 bg-white text-forest',
    err:       'border-red-300 bg-red-50 text-red-700',
  }[desc.tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] shadow-sm',
        'transition-colors duration-200',
        toneClass,
        className,
      )}
    >
      <span aria-hidden>{desc.icon}</span>
      <span>{desc.label}</span>
    </div>
  );
}
