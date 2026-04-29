export function applyChecklistRules(item, caseContext = {}) {
  const conditions = item?.conditions;
  if (!conditions || !Object.keys(conditions).length) return true;

  const modifiers = caseContext?.modifiers || {};

  return Object.entries(conditions).every(([key, expected]) => {
    const actual = key.startsWith('modifiers.') ? modifiers[key.replace('modifiers.', '')] : modifiers[key] ?? caseContext[key];

    if (Array.isArray(expected)) {
      if (Array.isArray(actual)) return expected.every((value) => actual.includes(value));
      return expected.includes(actual);
    }

    return actual === expected;
  });
}

export function filterChecklist(checklist = [], caseContext = {}, visit = 'v1') {
  return checklist
    .filter((item) => item?.visit === visit)
    .filter((item) => applyChecklistRules(item, caseContext))
    .sort((a, b) => (a?.order || 0) - (b?.order || 0));
}

export function groupChecklistByPhaseSection(items = []) {
  return items.reduce((acc, item) => {
    const phase = item.phase || 'planning';
    const section = item.section || 'pre_op';
    if (!acc[phase]) acc[phase] = {};
    if (!acc[phase][section]) acc[phase][section] = [];
    acc[phase][section].push(item);
    return acc;
  }, {});
}
