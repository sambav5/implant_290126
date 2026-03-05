export default function MentionDropdown({ items, onSelect }) {
  if (!items.length) return null;
  return (
    <div className="absolute bottom-14 left-2 right-2 z-20 rounded-lg  p-1" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      {items.map((item) => (
        <button
          key={item}
          className="block w-full text-left px-3 py-2 rounded-md text-sm"
          style={{ color: 'var(--t1)' }}
          onClick={() => onSelect(item)}
        >
          @{item}
        </button>
      ))}
    </div>
  );
}
