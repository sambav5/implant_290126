import { ROLE_LABELS, ROLE_BG_COLORS } from '@/utils/rolePermissions';

export function RoleBadge({ role }) {
  if (!role) return null;

  const colorClass = ROLE_BG_COLORS[role] || 'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}
