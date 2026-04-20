import { useEffect, useMemo } from 'react';
import checklistMaster from '@/config/checklist_master.json';
import checklistRules from '@/config/checklist_rules.json';
import { useClinicalFlowStore } from '../state/clinicalFlow.store';
import { evaluateGate } from '../engine/gateEngine';
import { getBranchDefinition } from '../engine/routingEngine';
import { applyTaskConditions, buildExecutionTasks, buildTaskLibrary } from '../engine/checklistBuilder';
import { runRules } from '../engine/ruleEngine';
import { deriveCaseContext, getRoutingVariant } from '@/lib/caseContext';

export function useClinicalFlow() {
  const { state, dispatch } = useClinicalFlowStore();

  const activeCaseContext = state.caseContext || state.patientData.caseContext || deriveCaseContext({});
  const routingVariant = getRoutingVariant(activeCaseContext);
  const branch = useMemo(() => getBranchDefinition(routingVariant), [routingVariant]);

  useEffect(() => {
    const gate = evaluateGate(state.patientData);
    dispatch({ type: 'SET_GATE', payload: gate });
  }, [state.patientData, dispatch]);

  useEffect(() => {
    const taskLibrary = buildTaskLibrary(checklistMaster);
    const rawTasks = buildExecutionTasks(checklistMaster, branch);
    const evaluationContext = {
      modifiers: activeCaseContext.modifiers || {},
      clinicalInputs: {
        bone_height: state.patientData?.bone_height ?? state.responses?.bone_height,
      },
      medical: state.patientData.medical,
      functional_risk: state.patientData.functional_risk,
      requiresImaging: true,
      guideRequired: true,
      torque: state.responses.torque_recorded,
    };
    const baseTasks = applyTaskConditions(rawTasks, evaluationContext);
    const ruleOutput = runRules(
      checklistRules,
      evaluationContext,
      baseTasks,
      taskLibrary,
    );

    dispatch({ type: 'SET_TASKS', payload: ruleOutput.tasks });
    dispatch({
      type: 'SET_WARNINGS',
      payload: [...state.gate.warnings, ...ruleOutput.warnings.map((warning) => warning.message)],
    });
    dispatch({ type: 'SET_STOP_EVENTS', payload: ruleOutput.stopEvents });
  }, [activeCaseContext.modifiers, state.currentVisit, state.patientData, state.responses, state.gate, branch, dispatch]);

  return { state, dispatch, branch };
}
