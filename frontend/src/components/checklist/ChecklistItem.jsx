import { Checkbox } from '@/components/ui/checkbox';
import SubItemList from './SubItemList';

const uiTypeStyles = {
  alert: '',
  action: '',
  guidance: 'text-[#6E6A60]',
  decision: '',
};

export default function ChecklistItem({ item, completed, canEdit, onToggle }) {
  const severity = item?.severity || 'normal';
  const uiType = item?.uiType || 'action';
  const showCheckbox = uiType !== 'guidance';

  return (
    <div className={`flex items-start justify-between p-4 transition-colors hover:bg-[#F9FAFB] ${completed ? 'opacity-60 bg-[#F9FAFB]' : 'bg-white'} ${uiTypeStyles[uiType] || ''}`}>
      <div className="flex items-start gap-4 w-full">
        {showCheckbox && (
          <Checkbox
            checked={Boolean(completed)}
            disabled={!canEdit}
            onCheckedChange={(checked) => onToggle(item.id, Boolean(checked))}
            className="mt-0.5 w-5 h-5 border-[#D1D5DB] data-[state=checked]:bg-[#1F7A63] data-[state=checked]:border-[#1F7A63]"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-base font-medium ${completed ? 'text-[#6B7280] line-through' : 'text-[#1A1A1A]'}`}>{item.text}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-0.5 rounded-md bg-[#F3F4F6] text-xs font-medium text-[#4B5563] capitalize">{item.assignedRole}</span>
            <span className={`text-xs font-medium ${severity === 'high' ? 'text-red-600' : 'text-[#9CA3AF]'}`}>{severity}</span>
          </div>
          {uiType === 'decision' && item?.recommendation && (
            <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <p className="text-sm text-blue-800"><span className="font-semibold">Recommended:</span> {item.recommendation}</p>
            </div>
          )}
          <div className="mt-2">
            <SubItemList subItems={item.subItems || []} />
          </div>
        </div>
      </div>
    </div>
  );
}
