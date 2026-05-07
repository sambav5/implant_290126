import ReactionBar from './ReactionBar';
import { normalizeMentionLabel } from './mentionUtils';

function renderMentions(text, mentions = []) {
  const mentionList = mentions.map((m) => typeof m === 'string' ? { label: m } : m);
  const labelSet = new Set(mentionList.map((m) => normalizeMentionLabel(m.label || m.id).toLowerCase()));
  return text.split(/(\s+)/).map((chunk, idx) => {
    const raw = chunk.startsWith('@') ? normalizeMentionLabel(chunk.slice(1).replace(/[,.!?;:]+$/, '')) : '';
    const highlighted = raw && labelSet.has(raw.toLowerCase());
    if (!highlighted) return <span key={idx}>{chunk}</span>;
    const suffix = chunk.match(/[,.!?;:]+$/)?.[0] || '';
    return <span key={idx}><span className="inline-block" style={{ background: 'rgba(15, 60, 40, 0.12)', color: '#0f3c28', borderRadius: 6, padding: '1px 6px', fontWeight: 500 }}>@{raw}</span>{suffix}</span>;
  });
}

export default function MessageItem({ message, showSender, onReply, onReact, onDelete, canDelete }) {
  return (
    <div className="px-4 py-2">
      {showSender && (
        <div className="text-xs mb-1" style={{ color: 'var(--t2)' }}>
          <span className="font-semibold" style={{ color: 'var(--t1)' }}>{message.sender_name}</span> ({message.sender_role}) • {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
      <div className="text-sm" style={{ color: 'var(--t1)' }}>{message.deleted ? <i>{message.message}</i> : renderMentions(message.message, message.mentions)}</div>
      <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--t2)' }}>
        <button onClick={onReply}>Reply</button>
        {!!message.reply_count && <button onClick={onReply}>{message.reply_count} replies</button>}
        {canDelete && !message.deleted && <button onClick={onDelete}>Delete</button>}
      </div>
      <ReactionBar reactions={message.reactions} onReact={onReact} />
    </div>
  );
}
