import { useMemo, useState } from 'react';
import VisitTabs from '../components/VisitTabs';
import PhaseTabs from '../components/PhaseTabs';
import TaskCard from '../components/TaskCard';
import RoleToggle from '../components/RoleToggle';
import WarningBanner from '../components/WarningBanner';
import { Button } from '@/components/ui/button';

export default function VisitExecutionFlow({ state, dispatch, branch, onStop }) {
  const [activePhase, setActivePhase] = useState('preOp');

  const filteredTasks = useMemo(() => {
    return state.tasks.filter((task) => {
      if (task.visit !== state.currentVisit || task.phase !== activePhase) return false;
      if (!state.myTasksOnly) return true;
      return task.assignedRole === state.role || state.role === 'implantologist';
    });
  }, [state.tasks, state.currentVisit, activePhase, state.myTasksOnly, state.role]);

  const onChange = (taskId, value) => dispatch({ type: 'SET_RESPONSES', payload: { [taskId]: value } });

  const canEdit = (task) => state.role === 'implantologist' || task.assignedRole === state.role;
  const medicalFlags = state.patientData.medical || [];
  const functionalFlags = state.patientData.functional_risk || [];

  const toggleFlag = (key, value) => {
    const list = key === 'medical' ? medicalFlags : functionalFlags;
    const exists = list.includes(value);
    dispatch({
      type: 'SET_PATIENT_DATA',
      payload: { [key]: exists ? list.filter((entry) => entry !== value) : [...list, value] },
    });
  };

  return (
    <div className="space-y-4">
      <div className="card-clinical space-y-4">
        <h2 className="text-xl font-semibold">Visit Execution</h2>
        <RoleToggle
          role={state.role}
          myTasksOnly={state.myTasksOnly}
          onRoleChange={(role) => dispatch({ type: 'SET_ROLE', payload: role })}
          onScopeChange={(myTasksOnly) => dispatch({ type: 'SET_MY_TASKS_ONLY', payload: myTasksOnly })}
        />
        <VisitTabs
          visits={branch.visits}
          currentVisit={state.currentVisit}
          onChange={(visit) => dispatch({ type: 'SET_CURRENT_VISIT', payload: visit })}
        />
        <PhaseTabs activePhase={activePhase} onChange={setActivePhase} />
        <div className="flex flex-wrap gap-2">
          <Button variant={medicalFlags.includes('smoker') ? 'default' : 'outline'} onClick={() => toggleFlag('medical', 'smoker')}>
            Smoker
          </Button>
          <Button variant={functionalFlags.includes('bruxism') ? 'default' : 'outline'} onClick={() => toggleFlag('functional_risk', 'bruxism')}>
            Bruxism
          </Button>
        </div>
      </div>

      <WarningBanner warnings={state.warnings} />

      <div className="grid gap-3">
        {filteredTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            value={state.responses[task.id]}
            editable={canEdit(task)}
            onChange={onChange}
            onStop={onStop}
          />
        ))}
        {!filteredTasks.length && <p className="text-sm text-gray-500">No tasks for this phase.</p>}
      </div>
    </div>
  );
}
