const severeValues = new Set(['severe', 'high']);
const moderateValues = new Set(['moderate', 'amber']);

const gateFields = [
  { key: 'medicalRisk', label: 'Medical risk' },
  { key: 'periodontalStatus', label: 'Periodontal status' },
  { key: 'functionalRisk', label: 'Functional risk' },
  { key: 'patientExpectation', label: 'Patient expectation' },
];

export function evaluateGate(patientData = {}) {
  const blockers = [];
  const warnings = [];

  gateFields.forEach(({ key, label }) => {
    const value = String(patientData[key] || 'low').toLowerCase();
    if (severeValues.has(value)) {
      blockers.push(`${label} flagged as severe.`);
    } else if (moderateValues.has(value)) {
      warnings.push(`${label} is moderate and needs caution.`);
    }
  });

  const gateStatus = blockers.length > 0 ? 'STOP' : warnings.length > 0 ? 'AMBER' : 'GO';
  return { gateStatus, blockers, warnings };
}

export { gateFields };
