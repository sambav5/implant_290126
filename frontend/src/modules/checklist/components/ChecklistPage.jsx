import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import WarningBanner from './WarningBanner';
import PhaseTabs from './PhaseTabs';
import VisitTabs from './VisitTabs';
import ChecklistSection from './ChecklistSection';
import RoleToggle from './RoleToggle';
import InfoNote from './InfoNote';

export default function ChecklistPage({ state, dispatch }) {
  const phases = useMemo(() => Array.from(new Set(state.checklist.map((item) => item.phase))), [state.checklist]);
  const visitsForPhase = useMemo(() => {
    return Array.from(new Set(state.checklist.filter((item) => item.phase === state.activePhase).map((item) => item.visit)));
  }, [state.checklist, state.activePhase]);

  const sections = useMemo(() => {
    return ['pre_op', 'intra_op', 'post_op'].map((section) => ({
      section,
      items: state.checklist.filter(
        (item) => item.phase === state.activePhase && item.visit === state.activeVisit && item.section === section,
      ),
    })).filter((entry) => entry.items.length > 0);
  }, [state.checklist, state.activePhase, state.activeVisit]);

  const onResponse = (id, value) => dispatch({ type: 'SET_RESPONSES', payload: { [id]: value } });
  const isClinician = state.role === 'implantologist' || state.role === 'clinician';
  const editableForItem = (item) => isClinician || item.assignedRole === state.role;

  const visibleItems = state.myTasksOnly
    ? sections.map((entry) => ({ ...entry, items: entry.items.filter((item) => editableForItem(item)) })).filter((entry) => entry.items.length)
    : sections;

  return (
    <div className="space-y-4">
      <div className="card-clinical space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Dynamic Clinical Checklist</h1>
          <p className="text-sm text-gray-600">Assistive guidance only — non-blocking workflow.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Select value={state.patientData.caseType} onValueChange={(value) => dispatch({ type: 'SET_PATIENT_DATA', payload: { caseType: value } })}>
            <SelectTrigger><SelectValue placeholder="Case type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">standard</SelectItem>
              <SelectItem value="esthetic">esthetic</SelectItem>
              <SelectItem value="sinus">sinus</SelectItem>
              <SelectItem value="full_arch">full_arch</SelectItem>
              <SelectItem value="immediate">immediate</SelectItem>
            </SelectContent>
          </Select>

          <Select value={state.patientData.medical.includes('smoker') ? 'smoker' : 'none'} onValueChange={(value) => dispatch({ type: 'SET_PATIENT_DATA', payload: { medical: value === 'smoker' ? ['smoker'] : [] } })}>
            <SelectTrigger><SelectValue placeholder="Medical" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">non-smoker</SelectItem>
              <SelectItem value="smoker">smoker</SelectItem>
            </SelectContent>
          </Select>

          <Select value={state.patientData.functional_risk.includes('bruxism') ? 'bruxism' : 'none'} onValueChange={(value) => dispatch({ type: 'SET_PATIENT_DATA', payload: { functional_risk: value === 'bruxism' ? ['bruxism'] : [] } })}>
            <SelectTrigger><SelectValue placeholder="Functional risk" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">none</SelectItem>
              <SelectItem value="bruxism">bruxism</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <WarningBanner warnings={state.warnings} />
        <InfoNote />
      </div>

      <div className="card-clinical space-y-4">
        <RoleToggle
          role={state.role}
          myTasksOnly={state.myTasksOnly}
          onRoleChange={(role) => dispatch({ type: 'SET_ROLE', payload: role })}
          onScopeChange={(myTasksOnly) => dispatch({ type: 'SET_MY_TASKS_ONLY', payload: myTasksOnly })}
        />
        <PhaseTabs
          activePhase={state.activePhase}
          phases={phases}
          onChange={(phase) => {
            dispatch({ type: 'SET_ACTIVE_PHASE', payload: phase });
            dispatch({ type: 'SET_ACTIVE_VISIT', payload: 'v1' });
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
