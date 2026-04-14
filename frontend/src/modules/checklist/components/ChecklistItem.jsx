import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

export default function ChecklistItem({ item, value, editable, inlineWarning, onChange }) {
  const isNumber = item.ui?.inputType === 'number';

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b">
      <div>
        <p className="text-sm font-medium">{item.text}</p>
        <p className="text-xs text-gray-500">{item.assignedRole} • {item.type}</p>
        {inlineWarning && <p className="text-xs text-amber-700 mt-1">⚠ {inlineWarning}</p>}
      </div>
      {isNumber ? (
        <Input
          type="number"
          className="w-24"
          disabled={!editable}
          value={value ?? ''}
          onChange={(event) => onChange(item.id, event.target.value)}
        />
      ) : (
        <Checkbox disabled={!editable} checked={Boolean(value)} onCheckedChange={(checked) => onChange(item.id, Boolean(checked))} />
      )}
    </div>
  );
}
