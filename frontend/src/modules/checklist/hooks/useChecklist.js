import { useEffect, useMemo } from 'react';
import checklistMaster from '@/config/checklist_master.json';
import checklistRules from '@/config/checklist_rules.json';
import { useChecklistStore } from '../state/checklist.store';
import { buildChecklistLibrary, filterChecklistItems } from '../engine/checklistBuilder';
import { runRuleEngine } from '../engine/ruleEngine';

function buildInlineWarnings(context) {
  const inline = {};

  if ((context.medical || []).includes('smoker')) {
    inline.implant_specs = 'Smoker: account for delayed healing in planning.';
  }

  if ((context.functional_risk || []).includes('bruxism')) {
    inline.nightguard_required = 'Bruxism: reinforce occlusal protection strategy.';
  }

  if (context.periodontal === 'Active disease') {
    inline.cbct_review = 'Active periodontal disease noted; sequence treatment accordingly.';
  }

  return inline;
}

function selectHighestPriorityWarnings(warnings = [], maxWarnings = 3) {
  const groupedWarnings = warnings.reduce((acc, warning) => {
    const category = warning?.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push({
      ...warning,
      category,
      priority: Number.isFinite(Number(warning?.priority)) ? Number(warning.priority) : 0,
    });
    return acc;
  }, {});

  return Object.values(groupedWarnings)
    .map((group) => [...group].sort((a, b) => b.priority - a.priority)[0])
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxWarnings);
}

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

    const manualWarnings = [];
    if (context.periodontal === 'Active disease') {
      manualWarnings.push({
        ruleId: 'gate_active_periodontal',
        message: 'Active periodontal disease — treat periodontal condition before implant when possible.',
        severity: 'high',
      });
    }

    dispatch({ type: 'SET_CHECKLIST', payload: output.items });
    dispatch({ type: 'SET_WARNINGS', payload: selectHighestPriorityWarnings([...output.warnings, ...manualWarnings]) });
    dispatch({ type: 'SET_INLINE_WARNINGS', payload: buildInlineWarnings(context) });
  }, [library, libraryById, state.patientData, state.responses, dispatch]);

  return { state, dispatch };
}
