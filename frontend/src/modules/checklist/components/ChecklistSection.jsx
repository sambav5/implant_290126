import ChecklistItem from './ChecklistItem';

const labels = {
  pre_op: 'Pre-op',
  intra_op: 'Intra-op',
  post_op: 'Post-op',
};

export default function ChecklistSection({ section, items, responses, inlineWarnings, editableForItem, onChange }) {
  return (
    <details open className="rounded-lg border border-[#D9D2C2] bg-[#F4EFE3] px-4 py-3 shadow-none">
      <summary className="cursor-pointer font-medium text-[#1A1A1A]">{labels[section] || section}</summary>
      <div className="mt-2 space-y-2">
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
