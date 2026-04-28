import { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import WarningBanner from './WarningBanner';
import PhaseTabs from './PhaseTabs';
import ChecklistSection from './ChecklistSection';
import RoleToggle from './RoleToggle';
import InfoNote from './InfoNote';
import CEOExperienceSection from './CEOExperienceSection';

const phaseOrder = ['planning', 'surgery', 'delivery'];
const visitLabels = {
  v1: 'Visit 1 — Surgery',
  v2: 'Visit 2 — Impression',
  v3: 'Visit 3 — Delivery',
};

function normalizeVisit(visitValue) {
  const visit = String(visitValue || '').toLowerCase();
  return ['v1', 'v2', 'v3'].includes(visit) ? visit : null;
}

export default function ChecklistPage({ state, dispatch, totalVisits = 3, onVisitNavigate, onCompleteCase }) {
  const currentVisit = normalizeVisit(state.activeVisit);
  const currentVisitNumber = Number(currentVisit?.replace('v', '')) || 0;
  const filteredChecklist = useMemo(
    () => (currentVisit ? state.checklist.filter((item) => item.visit === currentVisit) : []),
    [currentVisit, state.checklist],
  );

  const phases = useMemo(() => {
    const dynamicPhases = Array.from(new Set(filteredChecklist.map((item) => item.phase)));
    const ordered = phaseOrder.filter((phase) => dynamicPhases.includes(phase));
    const extra = dynamicPhases.filter((phase) => !phaseOrder.includes(phase));
    return [...ordered, ...extra];
  }, [filteredChecklist]);

  useEffect(() => {
    if (!currentVisit) return;

    if (state.activeVisit !== currentVisit) {
      dispatch({ type: 'SET_ACTIVE_VISIT', payload: currentVisit });
      return;
    }

    if (!filteredChecklist.length) return;

    const nextPhase = phases.includes(state.activePhase) ? state.activePhase : phases[0];
    if (nextPhase && nextPhase !== state.activePhase) {
      dispatch({ type: 'SET_ACTIVE_PHASE', payload: nextPhase });
    }
  }, [currentVisit, dispatch, filteredChecklist.length, phases, state.activePhase, state.activeVisit]);

  const sections = useMemo(() => {
    return ['pre_op', 'intra_op', 'post_op']
      .map((section) => ({
        section,
        items: filteredChecklist.filter(
          (item) => item.phase === state.activePhase && item.section === section,
        ),
      }))
      .filter((entry) => entry.items.length > 0);
  }, [filteredChecklist, state.activePhase]);

  const onResponse = (id, value) => dispatch({ type: 'SET_RESPONSES', payload: { [id]: value } });
  const isClinician = state.role === 'implantologist' || state.role === 'clinician';
  const editableForItem = (item) => isClinician || item.assignedRole === state.role;

  const visibleItems = state.myTasksOnly
    ? sections
      .map((entry) => ({ ...entry, items: entry.items.filter((item) => editableForItem(item)) }))
      .filter((entry) => entry.items.length)
    : sections;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentVisitNumber]);

  const goToVisit = (visitNumber) => {
    if (!onVisitNavigate) return;
    onVisitNavigate(visitNumber, state);
  };

  return (
    <div className="space-y-4">
      <div className="card-clinical space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Dynamic Clinical Checklist</h1>
          <p className="text-sm text-gray-600">Assistive guidance only — non-blocking workflow.</p>
        </div>
        <WarningBanner warnings={state.warnings} />
        <InfoNote />
      </div>

      <div className="card-clinical space-y-4">
        <RoleToggle
          myTasksOnly={state.myTasksOnly}
          onScopeChange={(myTasksOnly) => dispatch({ type: 'SET_MY_TASKS_ONLY', payload: myTasksOnly })}
        />
        <p className="text-sm text-gray-600">{visitLabels[currentVisit] || 'Visit not selected'}</p>
        <PhaseTabs
          activePhase={state.activePhase}
          phases={phases}
          onChange={(phase) => dispatch({ type: 'SET_ACTIVE_PHASE', payload: phase })}
        />

        <div className="space-y-3">
          {visibleItems.map((entry) => (
            <ChecklistSection
              key={entry.section}
              section={entry.section}
              items={entry.items}
              responses={state.responses}
              inlineWarnings={state.inlineWarnings}
              editableForItem={editableForItem}
              onChange={onResponse}
            />
          ))}
          {!visibleItems.length && <p className="text-sm text-gray-500">No checklist items for this visit.</p>}
        </div>

        <CEOExperienceSection
          items={filteredChecklist}
          responses={state.responses}
          inlineWarnings={state.inlineWarnings}
          editableForItem={editableForItem}
          onChange={onResponse}
          myTasksOnly={state.myTasksOnly}
        />

        <div className="mt-8 flex flex-col items-stretch gap-3 border-t border-divider pt-6 sm:flex-row sm:items-center sm:justify-between">
          {currentVisitNumber > 1 ? (
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => goToVisit(currentVisitNumber - 1)}>
              ← Previous Visit
            </Button>
          ) : (
            <div />
          )}

          {currentVisitNumber < totalVisits ? (
            <Button className="w-full sm:w-auto" onClick={() => goToVisit(currentVisitNumber + 1)}>
              Next Visit →
            </Button>
          ) : (
            <Button className="w-full sm:w-auto" onClick={onCompleteCase}>
              Complete Treatment
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
