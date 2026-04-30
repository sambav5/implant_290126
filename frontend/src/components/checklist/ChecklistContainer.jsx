import { useMemo, useState } from 'react';
import ChecklistItem from './ChecklistItem';
import { filterChecklist, groupChecklistByPhaseSection } from '@/utils/checklistEngine';

function PhaseSection({ phase, sections, completedItems, canEditItem, onToggleItem }) {
  const [openSections, setOpenSections] = useState(() => Object.keys(sections || {}).reduce((acc, key) => ({ ...acc, [key]: true }), {}));

  return (
    <section id={`phase-${phase}`} className="space-y-2">
      <h2 className="sticky top-0 z-10 bg-[#F4EFE3]/95 py-2 text-lg font-semibold capitalize text-[#1A1A1A] backdrop-blur">{phase.replace('_', ' ')}</h2>
      {Object.entries(sections).map(([section, items]) => (
        <div key={section} className="rounded-lg border border-[#D9D2C2] bg-[#F4EFE3] shadow-none">
          <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }))}>
            <span className="text-sm font-medium capitalize text-[#1A1A1A]">{section.replace('_', ' ')}</span>
            <span className="text-xs text-[#6E6A60]">{openSections[section] ? 'Hide' : 'Show'}</span>
          </button>
          {openSections[section] && (
            <div className="space-y-2 border-t border-[#D9D2C2] px-4 py-3">
              {items.map((item) => (
                <ChecklistItem
                  key={item.id}
                  item={item}
                  completed={completedItems[item.id]}
                  canEdit={canEditItem(item)}
                  onToggle={onToggleItem}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

export default function ChecklistContainer({ checklist = [], caseContext, activeVisit, role, completedItems, onToggleItem }) {
  const filteredItems = useMemo(() => filterChecklist(checklist, caseContext, activeVisit), [checklist, caseContext, activeVisit]);
  const grouped = useMemo(() => groupChecklistByPhaseSection(filteredItems), [filteredItems]);

  const total = filteredItems.length;
  const done = filteredItems.filter((item) => completedItems[item.id]).length;
  const progress = total ? Math.round((done / total) * 100) : 0;
  const canEditItem = (item) => role === 'clinician' || role === 'implantologist' || item.assignedRole === role;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#D9D2C2] bg-[#F4EFE3] p-4 shadow-none">
        <div className="mb-2 flex items-center justify-between text-xs text-[#6E6A60]">
          <span>Progress</span><span>{done}/{total}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#F4EFE3]">
          <div className="h-full bg-forest transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {!filteredItems.length && <p className="text-sm text-[#6E6A60]">No checklist items for this visit.</p>}

      {Object.entries(grouped).map(([phase, sections]) => (
        <PhaseSection
          key={phase}
          phase={phase}
          sections={sections}
          completedItems={completedItems}
          canEditItem={canEditItem}
          onToggleItem={onToggleItem}
        />
      ))}
    </div>
  );
}
