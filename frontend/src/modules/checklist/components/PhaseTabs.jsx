import { Button } from '@/components/ui/button';

const phaseOrder = ['planning', 'surgery', 'delivery'];

export default function PhaseTabs({ activePhase, phases = [], onChange }) {
  const visible = phaseOrder.filter((phase) => phases.includes(phase));
  return (
    <div className="flex gap-2">
      {visible.map((phase) => (
        <Button key={phase} variant={phase === activePhase ? 'default' : 'outline'} onClick={() => onChange(phase)}>
          {phase}
        </Button>
      ))}
    </div>
  );
}
