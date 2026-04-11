import { Button } from '@/components/ui/button';

export default function PhaseTabs({ activePhase, onChange }) {
  const phases = ['preOp', 'intraOp', 'postOp'];
  return (
    <div className="flex gap-2 mt-4">
      {phases.map((phase) => (
        <Button key={phase} variant={activePhase === phase ? 'default' : 'outline'} onClick={() => onChange(phase)}>
          {phase}
        </Button>
      ))}
    </div>
  );
}
