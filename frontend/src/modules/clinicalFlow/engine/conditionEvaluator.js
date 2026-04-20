export function getNestedValue(obj, path) {
  if (!path) return obj;
  return String(path)
    .split('.')
    .reduce((current, key) => (current === null || current === undefined ? undefined : current[key]), obj);
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function matchesArrayCondition(expected, current) {
  const currentValues = new Set(asArray(current));
  return expected.some((value) => currentValues.has(value));
}

function matchesComparisonCondition(expected, current) {
  const numericCurrent = Number(current);
  if (!Number.isFinite(numericCurrent)) return false;

  if (Object.prototype.hasOwnProperty.call(expected, 'lt') && !(numericCurrent < Number(expected.lt))) return false;
  if (Object.prototype.hasOwnProperty.call(expected, 'lte') && !(numericCurrent <= Number(expected.lte))) return false;
  if (Object.prototype.hasOwnProperty.call(expected, 'gt') && !(numericCurrent > Number(expected.gt))) return false;
  if (Object.prototype.hasOwnProperty.call(expected, 'gte') && !(numericCurrent >= Number(expected.gte))) return false;
  if (Object.prototype.hasOwnProperty.call(expected, 'eq') && !(numericCurrent === Number(expected.eq))) return false;
  if (Object.prototype.hasOwnProperty.call(expected, 'ne') && !(numericCurrent !== Number(expected.ne))) return false;

  return true;
}

function isComparisonObject(expected) {
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) return false;
  return ['lt', 'lte', 'gt', 'gte', 'eq', 'ne'].some((operator) =>
    Object.prototype.hasOwnProperty.call(expected, operator),
  );
}

export function matchesCondition(ruleWhen = {}, context = {}) {
  return Object.entries(ruleWhen).every(([path, expected]) => {
    const current = getNestedValue(context, path);

    if (Array.isArray(expected)) {
      return matchesArrayCondition(expected, current);
    }

    if (isComparisonObject(expected)) {
      return matchesComparisonCondition(expected, current);
    }

    return current === expected;
  });
}
