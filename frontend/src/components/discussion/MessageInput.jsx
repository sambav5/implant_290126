import { useMemo, useState } from 'react';
import MentionDropdown from './MentionDropdown';

export default function MessageInput({ onSend, mentionables }) {
  const [value, setValue] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const mentionItems = useMemo(() => mentionables || [], [mentionables]);

  const handleKeyDown = (e) => {
    if (e.key === '@') setMentionOpen(true);
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!value.trim() || sending) return;
    
    setSending(true);
    try {
      const mentions = Array.from(new Set((value.match(/@([a-zA-Z0-9_-]+)/g) || []).map((m) => m.slice(1))));
      await onSend(value, mentions);
      setValue('');
      setMentionOpen(false);
    } catch (err) {
      console.error('Failed to send:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative">
      <MentionDropdown items={mentionOpen ? mentionItems : []} onSelect={(name) => {
        setValue((prev) => `${prev}@${name} `);
        setMentionOpen(false);
      }} />
      <textarea
        className="w-full rounded-lg p-3 text-sm"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--t1)' }}
        placeholder="Message case team..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        disabled={sending}
      />
      {sending && (
        <div className="absolute bottom-2 right-2 text-xs" style={{ color: 'var(--t2)' }}>
          Sending...
        </div>
      )}
    </div>
  );
}
