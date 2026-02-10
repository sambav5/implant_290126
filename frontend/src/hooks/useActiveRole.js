import { useState, useEffect } from 'react';
import { getActiveRole, setActiveRole as saveActiveRole, ROLES } from '@/utils/rolePermissions';

// Custom event name for role changes within the same tab
const ROLE_CHANGE_EVENT = 'activeCaseRoleChanged';

export function useActiveRole() {
  const [activeRole, setActiveRoleState] = useState(getActiveRole());

  const setActiveRole = (role) => {
    saveActiveRole(role);
    setActiveRoleState(role);
    
    // Dispatch custom event to notify other components in the same tab
    window.dispatchEvent(new CustomEvent(ROLE_CHANGE_EVENT, { detail: { role } }));
  };

  useEffect(() => {
    // Listen for storage events (when another tab changes the role)
    const handleStorageChange = (e) => {
      if (e.key === 'activeCaseRole') {
        setActiveRoleState(e.newValue || ROLES.CLINICIAN);
      }
    };

    // Listen for custom events (when same tab changes the role)
    const handleRoleChange = (e) => {
      setActiveRoleState(e.detail.role);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(ROLE_CHANGE_EVENT, handleRoleChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(ROLE_CHANGE_EVENT, handleRoleChange);
    };
  }, []);

  return [activeRole, setActiveRole];
}
