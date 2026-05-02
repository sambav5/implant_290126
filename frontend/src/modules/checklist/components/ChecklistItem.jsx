import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

export default function ChecklistItem({ item, value, editable, inlineWarning, onChange }) {
  const isNumber = item.ui?.inputType === 'number';

  return (
    <div className={`flex items-start justify-between gap-3 border-b border-[#D9D2C2] py-3 ${Boolean(value) ? 'opacity-60' : ''}`}>
      <div className="flex-1">
        <p className="text-sm font-medium text-[#1A1A1A]">{item.text}</p>
        <p className="text-xs text-[#6E6A60]">{item.assignedRole} • {item.type}</p>
        {inlineWarning && <p className="text-xs text-amber-700 mt-1">⚠ {inlineWarning}</p>}
      </div>
      {isNumber ? (
        <Input
          type="number"
          className="w-24 border-[#D9D2C2] bg-transparent text-[#1A1A1A]"
          disabled={!editable}
          value={value ?? ''}
          onChange={(event) => onChange(item.id, event.target.value)}
        />
      ) : (
        <Checkbox className="border-[#183328] text-[#183328] data-[state=checked]:bg-[#183328] data-[state=checked]:text-[#F4EFE3]" disabled={!editable} checked={Boolean(value)} onCheckedChange={(checked) => onChange(item.id, Boolean(checked))} />
      )}
    </div>
  );
}
