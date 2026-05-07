import { useMemo, useState } from 'react';
import ChecklistItem from './ChecklistItem';
import { filterChecklist, groupChecklistByPhaseSection } from '@/utils/checklistEngine';

function PhaseSection({ phase, sections, completedItems, canEditItem, onToggleItem }) {
  const [openSections, setOpenSections] = useState({});

  return (
    <section id={`phase-${phase}`} className="space-y-6">
      <h2 className="text-xl font-semibold capitalize text-[#1A1A1A]">{phase.replace('_', ' ')}</h2>
      {Object.entries(sections).map(([section, items]) => (
        <div key={section} className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <button 
            type="button" 
            className="w-full flex items-center justify-between p-4 bg-[#F9FAFB] hover:bg-[#F3F4F6] transition-colors" 
            onClick={() => setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }))}
          >
            <span className="font-medium text-[#1A1A1A] capitalize">{section.replace('_', ' ')}</span>
            <span className="text-sm font-medium text-[#6B7280]">{openSections[section] ? 'Hide' : 'Show'}</span>
          </button>
          
          {openSections[section] && (
            <div className="divide-y divide-[#E5E7EB]">
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

export default function ChecklistContainer({ checklist = [], caseContext, activeVisit, role, completedItems, onToggleItem, activePhase, myTasksOnly }) {
  const displayedItems = useMemo(() => {
    let items = filterChecklist(checklist, caseContext, activeVisit);
    if (myTasksOnly) {
      if (role !== 'clinician') {
        items = items.filter(item => item.assignedRole === role);
      } else {
        items = items.filter(item => item.assignedRole === role);
      }
    }
    return items;
  }, [checklist, caseContext, activeVisit, myTasksOnly, role]);

  const grouped = useMemo(() => groupChecklistByPhaseSection(displayedItems), [displayedItems]);

  const total = displayedItems.length;
  const done = displayedItems.filter((item) => completedItems[item.id]).length;
  const progress = total ? Math.round((done / total) * 100) : 0;
  const canEditItem = (item) => role === 'clinician' || item.assignedRole === role;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm mb-6">
        <div className="mb-3 flex items-center justify-between text-sm font-medium text-[#1A1A1A]">
          <span>Phase Progress</span>
          <span className="text-[#6B7280]">{done} of {total} completed</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
          <div className="h-full bg-[#1F7A63] transition-all duration-500 ease-in-out" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {!displayedItems.length && <p className="text-sm text-[#6E6A60]">No checklist items for this view.</p>}

      {activePhase && grouped[activePhase] ? (
        <PhaseSection
          key={activePhase}
          phase={activePhase}
          sections={grouped[activePhase]}
          completedItems={completedItems}
          canEditItem={canEditItem}
          onToggleItem={onToggleItem}
        />
      ) : activePhase ? (
        <p className="text-sm text-[#6E6A60] mt-4">No checklist items found for the {activePhase} phase.</p>
      ) : (
        Object.entries(grouped).map(([phase, sections]) => (
          <PhaseSection
            key={phase}
            phase={phase}
            sections={sections}
            completedItems={completedItems}
            canEditItem={canEditItem}
            onToggleItem={onToggleItem}
          />
        ))
      )}
    </div>
  );
}
