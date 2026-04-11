import { useEffect, useMemo } from 'react';
import checklistMaster from '@/config/checklist_master.json';
import checklistRules from '@/config/checklist_rules.json';
import { useChecklistStore } from '../state/checklist.store';
import { buildChecklistLibrary, filterChecklistItems } from '../engine/checklistBuilder';
import { runRuleEngine } from '../engine/ruleEngine';

export function useChecklist() {
  const { state, dispatch } = useChecklistStore();

  const library = useMemo(() => buildChecklistLibrary(checklistMaster), []);
  const libraryById = useMemo(() => new Map(library.map((item) => [item.id, item])), [library]);

  useEffect(() => {
    const context = {
      ...state.patientData,
      torque: state.responses.torque_recorded ?? state.patientData.torque,
    };

    const baseItems = filterChecklistItems(library, context);
    const output = runRuleEngine(checklistRules, context, baseItems, libraryById);

    dispatch({ type: 'SET_CHECKLIST', payload: output.items });
    dispatch({ type: 'SET_WARNINGS', payload: output.warnings });
  }, [library, libraryById, state.patientData, state.responses, dispatch]);

  return { state, dispatch };
}
