import ChecklistItem from './ChecklistItem';

const labels = {
  pre_op: 'Pre-op',
  intra_op: 'Intra-op',
  post_op: 'Post-op',
};

export default function ChecklistSection({ section, items, responses, inlineWarnings, editableForItem, onChange }) {
  return (
    <details open className="border rounded-lg px-3 py-2">
      <summary className="font-medium cursor-pointer">{labels[section] || section}</summary>
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
