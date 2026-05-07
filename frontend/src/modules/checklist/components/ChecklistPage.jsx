import { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import WarningBanner from './WarningBanner';
import PhaseTabs from './PhaseTabs';
import ChecklistContainer from '@/components/checklist/ChecklistContainer';
import RoleToggle from './RoleToggle';
import InfoNote from './InfoNote';

const phaseOrder = ['planning', 'surgery', 'delivery'];
const visitLabels = {
  v1: 'Visit 1 — Surgery',
  v2: 'Visit 2 — Impression',
  v3: 'Visit 3 — Delivery',
  v4: 'Visit 4 — Maintenance',
};

function normalizeVisit(visitValue) {
  const visit = String(visitValue || '').toLowerCase();
  return ['v1', 'v2', 'v3', 'v4'].includes(visit) ? visit : null;
}

export default function ChecklistPage({ state, dispatch, totalVisits = 4, activeVisit, onVisitChange, onChangeVisit, onCompleteCase }) {
  const currentVisit = normalizeVisit(activeVisit || state.activeVisit);
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

  const completedItems = state.responses || {};
  const onResponse = (id, value) => dispatch({ type: 'SET_RESPONSES', payload: { [id]: value } });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentVisitNumber]);

  const goToVisit = (visitNumber) => {
    if (onVisitChange) {
      onVisitChange(visitNumber);
      return;
    }
    if (!onChangeVisit) return;
    onChangeVisit(visitNumber, state);
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

        <ChecklistContainer
          checklist={state.checklist}
          caseContext={state.patientData?.caseContext}
          activeVisit={currentVisit}
          role={state.role}
          completedItems={completedItems}
          onToggleItem={onResponse}
          activePhase={state.activePhase}
          myTasksOnly={state.myTasksOnly}
        />

        <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-[#E5E7EB] p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:pl-64">
          <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
            {currentVisitNumber > 1 ? (
              <Button className="w-full sm:w-auto" variant="outline" onClick={() => goToVisit(currentVisitNumber - 1)}>
                ← Previous Visit
              </Button>
            ) : (
              <div />
            )}

            {currentVisitNumber < totalVisits ? (
              <Button className="w-full sm:w-auto bg-[#1F7A63] hover:bg-[#17604D] text-white" onClick={() => goToVisit(currentVisitNumber + 1)}>
                Next Visit →
              </Button>
            ) : (
              <Button className="w-full sm:w-auto bg-[#1F7A63] hover:bg-[#17604D] text-white" onClick={onCompleteCase}>
                Complete Treatment
              </Button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
