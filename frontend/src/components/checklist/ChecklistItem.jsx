import { Checkbox } from '@/components/ui/checkbox';
import SubItemList from './SubItemList';

const severityStyles = {
  critical: 'border-red-500 bg-red-50',
  warning: 'border-amber-400 bg-amber-50',
  normal: 'border-divider bg-white',
};

const uiTypeStyles = {
  alert: 'ring-1 ring-red-200',
  action: '',
  guidance: 'bg-slate-50 text-slate-600',
  decision: 'ring-1 ring-indigo-200 bg-indigo-50',
};

export default function ChecklistItem({ item, completed, canEdit, onToggle }) {
  const severity = item?.severity || 'normal';
  const uiType = item?.uiType || 'action';
  const showCheckbox = uiType !== 'guidance';

  return (
    <div className={`rounded-md border p-3 ${severityStyles[severity] || severityStyles.normal} ${uiTypeStyles[uiType] || ''}`}>
      <div className="flex items-start gap-3">
        {showCheckbox && (
          <Checkbox
            checked={Boolean(completed)}
            disabled={!canEdit}
            onCheckedChange={(checked) => onToggle(item.id, Boolean(checked))}
            className="mt-1"
          />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium">{item.text}</p>
          <p className="text-xs text-gray-500 capitalize">{item.assignedRole} • {uiType} • {severity}</p>
          {uiType === 'decision' && item?.recommendation && (
            <p className="mt-1 text-xs text-indigo-700">Recommended: {item.recommendation}</p>
          )}
          <SubItemList subItems={item.subItems || []} />
        </div>
      </div>
    </div>
  );
}
