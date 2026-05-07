import ReactionBar from './ReactionBar';
import { normalizeMentionLabel } from './mentionUtils';

function renderMentions(text, mentions = []) {
  const mentionList = mentions.map((m) => typeof m === 'string' ? { label: m } : m);
  const labels = Array.from(new Set(mentionList.map((m) => normalizeMentionLabel(m.label || m.id)).filter(Boolean))).sort((a, b) => b.length - a.length);
  if (!labels.length) return text;

  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const mentionRegex = new RegExp(`@(${escaped.join('|')})(?=$|\\s|[,.!?;:])`, 'gi');
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
    parts.push(
      <span key={`m-${match.index}`} className="inline-block" style={{ background: 'rgba(15, 60, 40, 0.16)', color: '#0f3c28', borderRadius: 6, padding: '1px 6px', fontWeight: 500 }}>
        @{normalizeMentionLabel(match[1])}
      </span>
    );
    lastIndex = mentionRegex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(<span key={`t-end`}>{text.slice(lastIndex)}</span>);
  return parts;
}

export default function MessageItem({ message, showSender, onReply, onReact, onDelete, canDelete }) {
  return (
    <div className="px-4 py-2">
      {showSender && (
        <div className="text-xs mb-1" style={{ color: 'var(--t2)' }}>
          <span className="font-semibold" style={{ color: 'var(--t1)' }}>{message.sender_name}</span> ({message.sender_role}) • {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
      <div className="text-sm" style={{ color: 'var(--t1)' }}>{message.deleted ? <i>{message.message}</i> : renderMentions(message.message, message.mention_entities || message.mentions)}</div>
      <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--t2)' }}>
        <button onClick={onReply}>Reply</button>
        {!!message.reply_count && <button onClick={onReply}>{message.reply_count} replies</button>}
        {canDelete && !message.deleted && <button onClick={onDelete}>Delete</button>}
      </div>
      <ReactionBar reactions={message.reactions} onReact={onReact} />
    </div>
  );
}
