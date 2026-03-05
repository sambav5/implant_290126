const DEFAULT_REACTIONS = ['👍', '👀', '✔️', '🦷'];

export default function ReactionBar({ reactions = [], onReact }) {
  return (
    <div className="flex items-center gap-2 mt-1 flex-wrap">
      {reactions.map((reaction) => (
        <button
          key={reaction.reactionType}
          className="px-2 py-1 text-xs rounded-full"
          style={{ background: 'var(--bg)', color: 'var(--t1)', border: '1px solid var(--border)' }}
          onClick={() => onReact(reaction.reactionType)}
        >
          {reaction.reactionType} {reaction.count}
        </button>
      ))}
      {DEFAULT_REACTIONS.map((emoji) => (
        <button key={emoji} className="text-sm" onClick={() => onReact(emoji)}>{emoji}</button>
      ))}
    </div>
  );
}
