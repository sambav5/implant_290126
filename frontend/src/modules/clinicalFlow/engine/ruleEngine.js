import { matchesCondition } from './conditionEvaluator';

export function runRules(ruleConfig, context, baseTasks = [], taskLibrary = []) {
  const warnings = [];
  const addedTasks = [];
  const stopEvents = [];
  const taskById = new Map(taskLibrary.map((task) => [task.id, task]));

  (ruleConfig?.rules || []).forEach((rule) => {
    if (!matchesCondition(rule.when, context)) return;

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
