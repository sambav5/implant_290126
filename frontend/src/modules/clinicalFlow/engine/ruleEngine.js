function intersects(current, expected) {
  const currentSet = new Set(Array.isArray(current) ? current : [current]);
  return expected.some((entry) => currentSet.has(entry));
}

function matchRule(when, context) {
  return Object.entries(when || {}).every(([key, expected]) => {
    const current = context[key];
    if (Array.isArray(expected)) {
      return intersects(current, expected);
    }
    if (expected && typeof expected === 'object' && Object.prototype.hasOwnProperty.call(expected, 'lt')) {
      return Number(current) < Number(expected.lt);
    }
    return current === expected;
  });
}

export function runRules(ruleConfig, context, baseTasks = [], taskLibrary = []) {
  const warnings = [];
  const addedTasks = [];
  const stopEvents = [];
  const taskById = new Map(taskLibrary.map((task) => [task.id, task]));

  (ruleConfig?.rules || []).forEach((rule) => {
    if (!matchRule(rule.when, context)) return;

    (rule.then?.warnings || []).forEach((entry) => warnings.push(entry));
    (rule.then?.add || []).forEach((taskId) => {
      if (taskById.has(taskId)) {
        addedTasks.push(taskById.get(taskId));
      }
    });
  });

  const mergedTasks = [...baseTasks];
  addedTasks.forEach((task) => {
    if (!mergedTasks.some((existing) => existing.id === task.id)) {
      mergedTasks.push(task);
    }
  });

  return { tasks: mergedTasks, warnings, stopEvents };
}
