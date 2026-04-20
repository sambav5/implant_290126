import { evaluateConditions } from './conditionEvaluator';

const sectionMap = {
  pre_op: 'pre_op',
  intra_op: 'intra_op',
  post_op: 'post_op',
  patient_experience: 'patient_experience',
};

function normalizeInputType(inputType) {
  return inputType === 'number' ? 'number' : 'checkbox';
}

export function buildChecklistLibrary(masterChecklist) {
  return (masterChecklist?.items || [])
    .flatMap((item) => (Array.isArray(item) ? item : [item]))
    .filter((item) => item && !Array.isArray(item))
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((item) => ({
      id: item.id,
      text: item.text,
      phase: item.phase,
      visit: item.visit,
      section: sectionMap[item.section] || 'pre_op',
      assignedRole: item.assignedRole,
      type: item.type,
      conditions: item.conditions || {},
      ui: { inputType: normalizeInputType(item.ui?.inputType) },
    }));
}

export function filterChecklistItems(items, context) {
  return items.filter((item) => evaluateConditions(item.conditions, context));
}

export function groupChecklist(items) {
  const grouped = {};

  items.forEach((item) => {
    if (!grouped[item.phase]) grouped[item.phase] = {};
    if (!grouped[item.phase][item.visit]) grouped[item.phase][item.visit] = {};
    if (!grouped[item.phase][item.visit][item.section]) grouped[item.phase][item.visit][item.section] = [];
    grouped[item.phase][item.visit][item.section].push(item);
  });

  return grouped;
}
