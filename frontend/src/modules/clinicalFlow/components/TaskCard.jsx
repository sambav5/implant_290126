import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

const typePriority = {
  stop: 'text-red-700 border-red-300 bg-red-50',
  must_do: 'text-orange-800 border-orange-300 bg-orange-50',
  good_if_done: 'text-emerald-800 border-emerald-300 bg-emerald-50',
};

export default function TaskCard({ task, value, onChange, editable, onStop }) {
  const inputType = task.ui?.inputType || 'toggle';

  const handleToggle = (checked) => {
    if (task.type === 'stop' && checked) {
      onStop?.(`STOP task triggered: ${task.text}`);
      return;
    }
    onChange(task.id, checked);
  };

  return (
    <div className={`border rounded-lg p-3 space-y-2 ${typePriority[task.type] || ''}`}>
      <div className="flex justify-between gap-3">
        <div>
          <p className="font-medium text-sm">{task.text}</p>
          <p className="text-xs opacity-80">{task.type.toUpperCase()} • {task.assignedRole}</p>
        </div>
      </div>

      <div>
        {inputType === 'number' ? (
          <Input
            type="number"
            disabled={!editable}
            value={value ?? ''}
            onChange={(event) => onChange(task.id, event.target.value)}
            placeholder="Enter value"
            className="max-w-[220px]"
          />
        ) : (
          <Switch disabled={!editable} checked={Boolean(value)} onCheckedChange={handleToggle} />
        )}
      </div>
    </div>
  );
}
