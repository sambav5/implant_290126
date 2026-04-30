import { Checkbox } from '@/components/ui/checkbox';
import SubItemList from './SubItemList';

const severityStyles = {
  critical: 'border-[#D9D2C2] bg-[#F4EFE3]',
  warning: 'border-[#D9D2C2] bg-[#F4EFE3]',
  normal: 'border-[#D9D2C2] bg-[#F4EFE3]',
};

const uiTypeStyles = {
  alert: 'ring-1 ring-red-200',
  action: '',
  guidance: 'text-[#6E6A60]',
  decision: '',
};

export default function ChecklistItem({ item, completed, canEdit, onToggle }) {
  const severity = item?.severity || 'normal';
  const uiType = item?.uiType || 'action';
  const showCheckbox = uiType !== 'guidance';

  return (
    <div
      className={`rounded-lg border p-3 shadow-none ${severityStyles[severity] || severityStyles.normal} ${uiTypeStyles[uiType] || ''} ${completed ? 'bg-[#E8DFC8]' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        {showCheckbox && (
          <Checkbox
            checked={Boolean(completed)}
            disabled={!canEdit}
            onCheckedChange={(checked) => onToggle(item.id, Boolean(checked))}
            className="mt-1 border-[#183328] text-[#183328] data-[state=checked]:bg-[#183328] data-[state=checked]:text-[#F4EFE3]"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#1A1A1A]">{item.text}</p>
          <p className="text-xs text-[#6E6A60] capitalize">{item.assignedRole} • {severity}</p>
          {uiType === 'decision' && item?.recommendation && (
            <p className="mt-1 text-xs text-[#6E6A60]">Recommended: {item.recommendation}</p>
          )}
          <SubItemList subItems={item.subItems || []} />
        </div>
      </div>
    </div>
  );
}
