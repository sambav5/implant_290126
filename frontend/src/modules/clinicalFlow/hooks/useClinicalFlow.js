import { useEffect, useMemo } from 'react';
import checklistMaster from '@/config/checklist_master.json';
import checklistRules from '@/config/checklist_rules.json';
import { useClinicalFlowStore } from '../state/clinicalFlow.store';
import { evaluateGate } from '../engine/gateEngine';
import { getBranchDefinition } from '../engine/routingEngine';
import { applyTaskConditions, buildExecutionTasks, buildTaskLibrary } from '../engine/checklistBuilder';
import { runRules } from '../engine/ruleEngine';

export function useClinicalFlow() {
  const { state, dispatch } = useClinicalFlowStore();

  const branch = useMemo(() => getBranchDefinition(state.caseType || 'standard'), [state.caseType]);

  useEffect(() => {
    const gate = evaluateGate(state.patientData);
    dispatch({ type: 'SET_GATE', payload: gate });
  }, [state.patientData, dispatch]);

  useEffect(() => {
    const taskLibrary = buildTaskLibrary(checklistMaster);
    const rawTasks = buildExecutionTasks(checklistMaster, branch);
    const baseTasks = applyTaskConditions(rawTasks, {
      caseType: state.caseType,
      medical: state.patientData.medical,
      functional_risk: state.patientData.functional_risk,
      requiresImaging: true,
      guideRequired: true,
    });
    const ruleOutput = runRules(
      checklistRules,
      {
        medical: state.patientData.medical,
        functional_risk: state.patientData.functional_risk,
        caseType: state.caseType,
        torque: state.responses.torque_recorded,
      },
      baseTasks,
      taskLibrary,
    );

    dispatch({ type: 'SET_TASKS', payload: ruleOutput.tasks });
    dispatch({
      type: 'SET_WARNINGS',
      payload: [...state.gate.warnings, ...ruleOutput.warnings.map((warning) => warning.message)],
    });
    dispatch({ type: 'SET_STOP_EVENTS', payload: ruleOutput.stopEvents });
  }, [state.caseType, state.currentVisit, state.patientData, state.responses, state.gate, branch, dispatch]);

  return { state, dispatch, branch };
}
