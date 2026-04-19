import { useEffect, useMemo } from 'react';
import WarningBanner from './WarningBanner';
import PhaseTabs from './PhaseTabs';
import VisitTabs from './VisitTabs';
import ChecklistSection from './ChecklistSection';
import RoleToggle from './RoleToggle';
import InfoNote from './InfoNote';

const phaseOrder = ['planning', 'surgery', 'delivery'];

export default function ChecklistPage({ state, dispatch }) {
  const phases = useMemo(() => {
    const dynamicPhases = Array.from(new Set(state.checklist.map((item) => item.phase)));
    const ordered = phaseOrder.filter((phase) => dynamicPhases.includes(phase));
    const extra = dynamicPhases.filter((phase) => !phaseOrder.includes(phase));
    return [...ordered, ...extra];
  }, [state.checklist]);

  const visitsForPhase = useMemo(() => {
    return Array.from(new Set(
      state.checklist
        .filter((item) => item.phase === state.activePhase)
        .map((item) => item.visit),
    ));
  }, [state.checklist, state.activePhase]);

  useEffect(() => {
    if (!state.checklist.length) return;

    const nextPhase = phases.includes(state.activePhase) ? state.activePhase : phases[0];
    if (nextPhase && nextPhase !== state.activePhase) {
      dispatch({ type: 'SET_ACTIVE_PHASE', payload: nextPhase });
      return;
    }

    const nextVisitOptions = Array.from(new Set(
      state.checklist
        .filter((item) => item.phase === nextPhase)
        .map((item) => item.visit),
    ));

    const nextVisit = nextVisitOptions.includes(state.activeVisit) ? state.activeVisit : nextVisitOptions[0];
    if (nextVisit && nextVisit !== state.activeVisit) {
      dispatch({ type: 'SET_ACTIVE_VISIT', payload: nextVisit });
    }
  }, [dispatch, phases, state.activePhase, state.activeVisit, state.checklist]);

  const sections = useMemo(() => {
    return ['pre_op', 'intra_op', 'post_op']
      .map((section) => ({
        section,
        items: state.checklist.filter(
          (item) => item.phase === state.activePhase && item.visit === state.activeVisit && item.section === section,
        ),
      }))
      .filter((entry) => entry.items.length > 0);
  }, [state.checklist, state.activePhase, state.activeVisit]);

  const onResponse = (id, value) => dispatch({ type: 'SET_RESPONSES', payload: { [id]: value } });
  const isClinician = state.role === 'implantologist' || state.role === 'clinician';
  const editableForItem = (item) => isClinician || item.assignedRole === state.role;

  const visibleItems = state.myTasksOnly
    ? sections
      .map((entry) => ({ ...entry, items: entry.items.filter((item) => editableForItem(item)) }))
      .filter((entry) => entry.items.length)
    : sections;

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
        <PhaseTabs
          activePhase={state.activePhase}
          phases={phases}
          onChange={(phase) => {
            dispatch({ type: 'SET_ACTIVE_PHASE', payload: phase });
            const visits = Array.from(new Set(state.checklist.filter((item) => item.phase === phase).map((item) => item.visit)));
            if (visits.length) {
              dispatch({ type: 'SET_ACTIVE_VISIT', payload: visits[0] });
            }
          }}
        />
        <VisitTabs
          activeVisit={state.activeVisit}
          visits={visitsForPhase}
          onChange={(visit) => dispatch({ type: 'SET_ACTIVE_VISIT', payload: visit })}
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
          {!visibleItems.length && <p className="text-sm text-gray-500">No checklist items for current filters.</p>}
        </div>
      </div>
    </div>
  );
}
