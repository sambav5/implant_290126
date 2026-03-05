import { useMemo, useState } from 'react';
import MentionDropdown from './MentionDropdown';

export default function MessageInput({ onSend, mentionables, onTyping }) {
  const [value, setValue] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);

  const mentionItems = useMemo(() => mentionables || [], [mentionables]);

  const handleKeyDown = (e) => {
    if (e.key === '@') setMentionOpen(true);
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const mentions = Array.from(new Set((value.match(/@([a-zA-Z0-9_-]+)/g) || []).map((m) => m.slice(1))));
      onSend(value, mentions);
      setValue('');
      setMentionOpen(false);
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
        onChange={(e) => {
          setValue(e.target.value);
          onTyping?.();
        }}
        onKeyDown={handleKeyDown}
        rows={3}
      />
    </div>
  );
}
