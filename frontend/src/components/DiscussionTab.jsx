import { useMemo, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ROLE_MENTION_OPTIONS, buildMessagePayload, filterMentionOptions, tokenizeMentions, normalizeMentionLabel } from '@/utils/discussionMentions';

const getStorageKey = (caseId) => `discussion_messages_${caseId}`;

export default function DiscussionTab({ caseId, teamList = [] }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(getStorageKey(caseId)) || '[]'); } catch { return []; }
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef(null);

  const mentionOptions = useMemo(() => {
    const users = teamList
      .filter((member) => member?.name)
      .map((member) => ({ id: member.id || member.name, label: normalizeMentionLabel(member.name), type: 'user' }));

    const dedup = new Map();
    [...users, ...ROLE_MENTION_OPTIONS].forEach((option) => dedup.set(`${option.type}-${option.id}`, option));
    return [...dedup.values()];
  }, [teamList]);

  const mentionQueryMatch = /(?:^|\s)@([^\n@]*)$/.exec(input);
  const mentionQuery = mentionQueryMatch?.[1] ?? null;
  const filtered = useMemo(() => mentionQuery === null ? [] : filterMentionOptions(mentionOptions, mentionQuery), [mentionOptions, mentionQuery]);
  const showDropdown = mentionQuery !== null;

  const persistMessages = (nextMessages) => {
    setMessages(nextMessages);
    localStorage.setItem(getStorageKey(caseId), JSON.stringify(nextMessages));
  };

  const onSelectMention = (option) => {
    if (!textareaRef.current || mentionQueryMatch === null) return;
    const caret = textareaRef.current.selectionStart;
    const replaceStart = caret - mentionQuery.length - 1;
    const updated = `${input.slice(0, replaceStart)}@${option.label} ${input.slice(caret)}`;
    setInput(updated);
    setActiveIndex(0);
  };

  const onKeyDown = (e) => {
    if (!showDropdown || !filtered.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((prev) => (prev + 1) % filtered.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length); }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); onSelectMention(filtered[activeIndex]); }
    if (e.key === 'Escape') { e.preventDefault(); setInput((prev) => prev.replace(/@[^\s@\n]*$/, '')); }
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    const payload = buildMessagePayload(input.trim(), mentionOptions);
    const next = [...messages, { id: `msg_${Date.now()}`, ...payload, createdAt: new Date().toISOString() }];
    persistMessages(next);
    setInput('');
  };

  const users = filtered.filter((x) => x.type === 'user');
  const roles = filtered.filter((x) => x.type === 'role');

  return (
    <div className="space-y-4">
      <div className="card-clinical p-4 space-y-3">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message the team. Type @ to mention roles or people."
            className="min-h-[92px]"
            aria-expanded={showDropdown}
            aria-controls="mention-dropdown"
          />
          {showDropdown && (
            <div id="mention-dropdown" role="listbox" className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-md border bg-white shadow-sm" style={{ borderColor: 'var(--border)' }}>
              {!filtered.length ? <div className="px-3 py-2 text-sm" style={{ color: 'var(--t2)' }}>No matches found</div> : (
                <>
                  {!!users.length && <div className="px-3 pt-2 text-xs mono" style={{ color: 'var(--t3)' }}>People</div>}
                  {users.map((item) => {
                    const idx = filtered.findIndex((f) => f.id === item.id && f.type === item.type);
                    return <button key={`${item.type}-${item.id}`} onClick={() => onSelectMention(item)} className={`w-full text-left px-3 py-2 text-sm ${activeIndex === idx ? 'bg-stone-100' : ''}`}>{item.label}</button>;
                  })}
                  {!!roles.length && <div className="px-3 pt-2 text-xs mono" style={{ color: 'var(--t3)' }}>Roles</div>}
                  {roles.map((item) => {
                    const idx = filtered.findIndex((f) => f.id === item.id && f.type === item.type);
                    return <button key={`${item.type}-${item.id}`} onClick={() => onSelectMention(item)} className={`w-full text-left px-3 py-2 text-sm ${activeIndex === idx ? 'bg-stone-100' : ''}`}>{item.label}</button>;
                  })}
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={sendMessage}>Send</Button>
        </div>
      </div>

      <div className="space-y-3">
        {messages.map((message) => (
          <div key={message.id} className="card-clinical p-3">
            <p className="text-sm leading-relaxed">
              {tokenizeMentions(message.text, message.mentions).map((token, idx) => token.type === 'mention' ? (
                <span key={idx} className="discussion-mention-pill">@{token.mention.label}</span>
              ) : <span key={idx}>{token.value}</span>)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
