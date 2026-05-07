export default function MentionDropdown({ open, people = [], roles = [], activeIndex = 0, onHoverIndex, onSelect }) {
  if (!open) return null;
  const items = [...people, ...roles];
  if (!items.length) {
    return <div className="absolute bottom-14 left-2 right-2 z-20 rounded-lg p-3 text-sm" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--t2)' }}>No matches found</div>;
  }
  let idx = -1;
  return (
    <div role="listbox" className="absolute bottom-14 left-2 right-2 max-h-56 overflow-auto z-20 rounded-lg p-1" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      {!!people.length && <div className="px-2 py-1 text-xs font-semibold" style={{ color: 'var(--t2)' }}>People</div>}
      {people.map((item) => {
        idx += 1;
        const isActive = idx === activeIndex;
        return <button role="option" aria-selected={isActive} key={`user-${item.id}`} className="block w-full text-left px-3 py-2 rounded-md text-sm" style={{ color: 'var(--t1)', background: isActive ? 'rgba(15, 60, 40, 0.08)' : 'transparent' }} onMouseEnter={() => onHoverIndex(idx)} onClick={() => onSelect(item)}>@{item.label}</button>;
      })}
      {!!roles.length && <div className="px-2 py-1 text-xs font-semibold" style={{ color: 'var(--t2)' }}>Roles</div>}
      {roles.map((item) => {
        idx += 1;
        const isActive = idx === activeIndex;
        return <button role="option" aria-selected={isActive} key={`role-${item.id}`} className="block w-full text-left px-3 py-2 rounded-md text-sm" style={{ color: 'var(--t1)', background: isActive ? 'rgba(15, 60, 40, 0.08)' : 'transparent' }} onMouseEnter={() => onHoverIndex(idx)} onClick={() => onSelect(item)}>@{item.label}</button>;
      })}
    </div>
  );
}
