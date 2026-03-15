import { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, Check } from 'lucide-react';
import { useActiveRole } from '@/hooks/useActiveRole';
import { ROLES, ROLE_LABELS, getRoleName } from '@/utils/rolePermissions';
import { toast } from 'sonner';

export function RoleSwitcher({ caseTeam }) {
  const [activeRole, setActiveRole] = useActiveRole();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRoleChange = (role) => {
    setActiveRole(role);
    setIsOpen(false);
    const roleName = getRoleName(caseTeam, role);
    toast.success(`Now viewing as ${roleName}`);
  };

  const currentRoleName = getRoleName(caseTeam, activeRole);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
        style={{
          color: 'var(--t1)',
          background: 'var(--card)',
          border: '1.5px solid var(--border)'
        }}
        onMouseOver={(e) => e.currentTarget.style.background = 'var(--border)'}
        onMouseOut={(e) => e.currentTarget.style.background = 'var(--card)'}
      >
        <User className="h-4 w-4" />
        <span className="hidden sm:inline mono" style={{fontSize: '10px', textTransform: 'uppercase'}}>Viewing as:</span>
        <span className="font-semibold">{currentRoleName}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg  z-50" style={{background: 'var(--card)', border: '1.5px solid var(--border)'}}>
          <div className="px-3 py-2 rounded-t-lg" style={{borderBottom: '1px solid var(--border)', background: 'var(--bg)'}}>
            <p className="label-endo">Viewing As</p>
          </div>
          
          <div className="py-1">
            {Object.entries(ROLES).map(([key, role]) => {
              const roleName = getRoleName(caseTeam, role);
              const isActive = activeRole === role;
              
              return (
                <button
                  key={role}
                  onClick={() => handleRoleChange(role)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors"
                  style={{
                    background: isActive ? 'var(--blue-1)' : 'transparent',
                    color: isActive ? 'var(--blue)' : 'var(--t1)'
                  }}
                  onMouseOver={(e) => !isActive && (e.currentTarget.style.background = 'var(--border)')}
                  onMouseOut={(e) => !isActive && (e.currentTarget.style.background = 'transparent')}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{ROLE_LABELS[role]}</span>
                    {caseTeam && caseTeam[role] && (
                      <span className="text-xs mono" style={{color: 'var(--t3)'}}>({caseTeam[role]})</span>
                    )}
                  </div>
                  {isActive && <Check className="h-4 w-4" style={{color: 'var(--blue)'}} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
