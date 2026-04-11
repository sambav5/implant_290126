function includesAny(current, expected) {
  const values = Array.isArray(current) ? current : [current];
  return expected.some((entry) => values.includes(entry));
}

function matchesWhen(when = {}, context = {}) {
  return Object.entries(when).every(([key, expected]) => {
    const current = context[key];

    if (Array.isArray(expected)) {
      return includesAny(current, expected);
    }

    if (expected && typeof expected === 'object' && Object.prototype.hasOwnProperty.call(expected, 'lt')) {
      return Number(current) < Number(expected.lt);
    }

    return current === expected;
  });
}

export function runRuleEngine(ruleConfig, context, visibleItems, libraryById) {
  const warnings = [];
  const additions = [];

  (ruleConfig?.rules || []).forEach((rule) => {
    if (!matchesWhen(rule.when, context)) return;

    (rule.then?.warnings || []).forEach((warning) => {
      warnings.push({ ...warning, ruleId: rule.id });
    });

    (rule.then?.add || []).forEach((itemId) => {
      const item = libraryById.get(itemId);
      if (!item) return;
      additions.push(item);
    });
  });

  const merged = [...visibleItems];
  additions.forEach((item) => {
    if (!merged.some((entry) => entry.id === item.id)) {
      merged.push(item);
    }
  });

  return { items: merged, warnings };
}
