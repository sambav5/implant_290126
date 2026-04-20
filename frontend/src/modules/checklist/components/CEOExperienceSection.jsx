import ChecklistItem from './ChecklistItem';

export default function CEOExperienceSection({
  items,
  responses,
  inlineWarnings,
  editableForItem,
  onChange,
  myTasksOnly,
}) {
  const ceoItems = items.filter((item) => item.section === 'patient_experience');
  const visibleItems = myTasksOnly
    ? ceoItems.filter((item) => editableForItem(item))
    : ceoItems;

  if (!visibleItems.length) return null;

  return (
    <div className="mt-6 p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500">CEO Layer</p>
        <h3 className="text-base font-semibold">💙 Patient Experience</h3>
      </div>
      <div>
        {visibleItems.map((item) => (
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
    </div>
  );
}
