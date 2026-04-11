import { Button } from '@/components/ui/button';

const roles = ['implantologist', 'assistant', 'prosthodontist'];

export default function RoleToggle({ role, myTasksOnly, onRoleChange, onScopeChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {roles.map((value) => (
        <Button key={value} variant={role === value ? 'default' : 'outline'} onClick={() => onRoleChange(value)}>{value}</Button>
      ))}
      <Button variant={myTasksOnly ? 'default' : 'outline'} onClick={() => onScopeChange(true)}>My Tasks</Button>
      <Button variant={!myTasksOnly ? 'default' : 'outline'} onClick={() => onScopeChange(false)}>View All</Button>
    </div>
  );
}
