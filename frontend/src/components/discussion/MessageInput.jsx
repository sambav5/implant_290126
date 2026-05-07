import { useMemo, useRef, useState } from 'react';
import MentionDropdown from './MentionDropdown';
import { extractMentionsFromText, normalizeMentionLabel } from './mentionUtils';

export default function MessageInput({ onSend, mentionables }) {
  const [value, setValue] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef(null);

  const mentionItems = useMemo(() => {
    const query = value.slice(0, textareaRef.current?.selectionStart ?? value.length).match(/(?:^|\s)@([^\n@]*)$/)?.[1] ?? '';
    const filter = query.toLowerCase();
    const people = (mentionables?.people || []).filter((item) => item.label.toLowerCase().includes(filter));
    const roles = (mentionables?.roles || []).filter((item) => item.label.toLowerCase().includes(filter));
    return { people, roles, query };
  }, [mentionables, value]);

  const flatMentionItems = [...mentionItems.people, ...mentionItems.roles];

  const insertMention = (item) => {
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const replaced = before.replace(/@([^\n@]*)$/, `@${normalizeMentionLabel(item.label)} `);
    setValue(`${replaced}${after}`);
    setMentionOpen(false);
    setActiveIndex(0);
  };

  const handleKeyDown = (e) => {
    if (e.key === '@') setMentionOpen(true);
    if (mentionOpen && flatMentionItems.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((p) => (p + 1) % flatMentionItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((p) => (p - 1 + flatMentionItems.length) % flatMentionItems.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(flatMentionItems[activeIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setMentionOpen(false);
      }
      if (['ArrowDown','ArrowUp','Enter','Tab','Escape'].includes(e.key)) return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!value.trim() || sending) return;
    
    setSending(true);
    try {
      const mentions = extractMentionsFromText(value, mentionables);
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
      <MentionDropdown
        open={mentionOpen}
        people={mentionItems.people}
        roles={mentionItems.roles}
        activeIndex={activeIndex}
        onHoverIndex={setActiveIndex}
        onSelect={insertMention}
      />
      <textarea
        ref={textareaRef}
        className="w-full rounded-lg p-3 text-sm"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--t1)' }}
        placeholder="Message case team..."
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          const cursorText = e.target.value.slice(0, e.target.selectionStart);
          setMentionOpen(/(?:^|\s)@([^\n@]*)$/.test(cursorText));
        }}
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
