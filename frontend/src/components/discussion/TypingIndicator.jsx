export default function TypingIndicator({ text }) {
  if (!text) return null;
  return <div className="px-4 py-1 text-xs mono" style={{ color: 'var(--t2)' }}>{text}</div>;
}
