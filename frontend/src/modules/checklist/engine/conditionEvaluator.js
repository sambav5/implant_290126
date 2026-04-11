function includesAny(current, expected) {
  const values = Array.isArray(current) ? current : [current];
  return expected.some((entry) => values.includes(entry));
}

export function evaluateConditions(conditions = {}, context = {}) {
  if (!conditions || Object.keys(conditions).length === 0) return true;

  return Object.entries(conditions).every(([key, expected]) => {
    const current = context[key];
    if (Array.isArray(expected)) {
      return includesAny(current, expected);
    }
    return current === expected;
  });
}
