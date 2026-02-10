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
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
      >
        <User className="h-4 w-4" />
        <span className="hidden sm:inline">Viewing as:</span>
        <span className="font-semibold">{currentRoleName}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 rounded-t-lg">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Viewing As</p>
          </div>
          
          <div className="py-1">
            {Object.entries(ROLES).map(([key, role]) => {
              const roleName = getRoleName(caseTeam, role);
              const isActive = activeRole === role;
              
              return (
                <button
                  key={role}
                  onClick={() => handleRoleChange(role)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{ROLE_LABELS[role]}</span>
                    {caseTeam && caseTeam[role] && (
                      <span className="text-xs text-slate-500">({caseTeam[role]})</span>
                    )}
                  </div>
                  {isActive && <Check className="h-4 w-4 text-blue-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
