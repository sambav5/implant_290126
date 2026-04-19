import { Button } from '@/components/ui/button';

export default function RoleToggle({ myTasksOnly, onScopeChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant={myTasksOnly ? 'default' : 'outline'} onClick={() => onScopeChange(true)}>My Tasks</Button>
      <Button variant={!myTasksOnly ? 'default' : 'outline'} onClick={() => onScopeChange(false)}>View All</Button>
    </div>
  );
}
