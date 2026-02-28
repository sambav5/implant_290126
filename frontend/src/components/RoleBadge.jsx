import { ROLE_LABELS, ROLE_BG_COLORS } from '@/utils/rolePermissions';

export function RoleBadge({ role }) {
  if (!role) return null;

  const colorClass = ROLE_BG_COLORS[role] || 'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs border mono ${colorClass}`} 
          style={{fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.02em', fontWeight: 500}}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

