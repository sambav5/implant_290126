// Role permission utilities

export const ROLES = {
  CLINICIAN: 'clinician',
  IMPLANTOLOGIST: 'implantologist',
  PROSTHODONTIST: 'prosthodontist',
  ASSISTANT: 'assistant',
};

export const ROLE_LABELS = {
  [ROLES.CLINICIAN]: 'Clinician',
  [ROLES.IMPLANTOLOGIST]: 'Implantologist',
  [ROLES.PROSTHODONTIST]: 'Prosthodontist',
  [ROLES.ASSISTANT]: 'Assistant',
};

export const ROLE_COLORS = {
  [ROLES.CLINICIAN]: 'blue',
  [ROLES.IMPLANTOLOGIST]: 'purple',
  [ROLES.PROSTHODONTIST]: 'green',
  [ROLES.ASSISTANT]: 'amber',
};

export const ROLE_BG_COLORS = {
  [ROLES.CLINICIAN]: 'bg-blue-100 text-blue-700 border-blue-200',
  [ROLES.IMPLANTOLOGIST]: 'bg-purple-100 text-purple-700 border-purple-200',
  [ROLES.PROSTHODONTIST]: 'bg-green-100 text-green-700 border-green-200',
  [ROLES.ASSISTANT]: 'bg-amber-100 text-amber-700 border-amber-200',
};

/**
 * Check if a user can edit a checklist item
 * Clinician can edit everything, others can only edit items assigned to their role
 */
export function canEditItem(itemAssignedRole, activeRole) {
  // Clinician (Case Owner) can edit everything
  if (activeRole === ROLES.CLINICIAN) {
    return true;
  }
  
  // Other roles can only edit items assigned to them
  return itemAssignedRole === activeRole;
}

/**
 * Get role name from case team
 */
export function getRoleName(caseTeam, role) {
  if (!caseTeam) return ROLE_LABELS[role];
  return caseTeam[role] || ROLE_LABELS[role];
}

/**
 * Get active role from localStorage
 */
export function getActiveRole() {
  return localStorage.getItem('activeCaseRole') || ROLES.CLINICIAN;
}

/**
 * Set active role in localStorage
 */
export function setActiveRole(role) {
  localStorage.setItem('activeCaseRole', role);
}
