import { matchesCondition } from './conditionEvaluator';

const phaseMap = {
  pre_op: 'preOp',
  intra_op: 'intraOp',
  post_op: 'postOp',
};

const stopTaskIds = new Set(['cbct_review']);

function buildType(item) {
  if (stopTaskIds.has(item.id)) return 'stop';
  if (item.importance === 'essential') return 'must_do';
  return 'good_if_done';
}

export function buildTaskLibrary(masterChecklist) {
  return (masterChecklist?.items || [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((item) => ({
      id: item.id,
      text: item.text,
      assignedRole: item.assignedRole || 'implantologist',
      ui: { inputType: item.ui?.inputType === 'number' ? 'number' : 'toggle' },
      type: buildType({ id: item.id, importance: item.type === 'critical' ? 'essential' : 'advanced' }),
      visit: item.visit || 'v1',
      phase: phaseMap[item.section] || 'preOp',
      sourcePhase: item.phase,
      sourceSection: item.section,
      conditions: item.conditions || {},
    }));
}

export function buildExecutionTasks(masterChecklist, branchDefinition) {
  const tasks = buildTaskLibrary(masterChecklist);
  const validVisits = new Set((branchDefinition?.visits || []).map((v) => v.id));
  return tasks.filter((task) => validVisits.has(task.visit));
}

export function applyTaskConditions(tasks = [], context = {}) {
  return tasks.filter((task) => {
    const conditions = task.conditions || {};
    return matchesCondition(conditions, context);
  });
}
