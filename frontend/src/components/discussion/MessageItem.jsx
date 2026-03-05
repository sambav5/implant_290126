import ReactionBar from './ReactionBar';

function renderMentions(text, mentions = []) {
  const chunks = text.split(/(\s+)/);
  return chunks.map((chunk, idx) => {
    const clean = chunk.replace(/^@/, '').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    const highlighted = mentions.some((m) => m.toLowerCase() === clean);
    if (chunk.startsWith('@') && highlighted) {
      return <span key={idx} className="px-1 rounded" style={{ background: 'var(--blue-1)', color: 'var(--blue)' }}>{chunk}</span>;
    }
    return <span key={idx}>{chunk}</span>;
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
