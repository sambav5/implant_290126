import { useState, useEffect } from 'react';
import { getActiveRole, setActiveRole as saveActiveRole, ROLES } from '@/utils/rolePermissions';

export function useActiveRole() {
  const [activeRole, setActiveRoleState] = useState(getActiveRole());

  const setActiveRole = (role) => {
    saveActiveRole(role);
    setActiveRoleState(role);
  };

  useEffect(() => {
    // Listen for storage events (when another tab changes the role)
    const handleStorageChange = (e) => {
      if (e.key === 'activeCaseRole') {
        setActiveRoleState(e.newValue || ROLES.CLINICIAN);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return [activeRole, setActiveRole];
}
