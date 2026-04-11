export const CASE_TYPES = ['standard', 'sinus', 'esthetic', 'full_arch', 'immediate'];

const branchTemplates = {
  standard: ['v1', 'v2', 'v3'],
  sinus: ['v1', 'v2', 'v3', 'v4'],
  esthetic: ['v1', 'v2', 'v3'],
  full_arch: ['v1', 'v2', 'v3', 'v4'],
  immediate: ['v1', 'v2', 'v3'],
};

export function getBranchDefinition(caseType = 'standard') {
  const visits = branchTemplates[caseType] || branchTemplates.standard;
  return {
    caseType,
    visits: visits.map((visitId) => ({
      id: visitId,
      phases: ['preOp', 'intraOp', 'postOp'],
    })),
  };
}
