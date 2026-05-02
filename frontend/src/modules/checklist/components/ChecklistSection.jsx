import ChecklistItem from './ChecklistItem';

const labels = {
  pre_op: 'Pre-op',
  intra_op: 'Intra-op',
  post_op: 'Post-op',
};

export default function ChecklistSection({ section, items, responses, inlineWarnings, editableForItem, onChange }) {
  return (
    <details open className="mt-4">
      <summary className="cursor-pointer text-sm text-[#6E6A60]">▼ {labels[section] || section}</summary>
      <div className="mt-2">
        {items.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            value={responses[item.id]}
            editable={editableForItem(item)}
            inlineWarning={inlineWarnings?.[item.id]}
            onChange={onChange}
          />
        ))}
      </div>
    </details>
  );
}
