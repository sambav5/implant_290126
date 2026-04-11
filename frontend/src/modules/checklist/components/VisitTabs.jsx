import { Button } from '@/components/ui/button';

export default function VisitTabs({ activeVisit, visits = [], onChange }) {
  return (
    <div className="flex gap-2">
      {visits.map((visit) => (
        <Button key={visit} variant={visit === activeVisit ? 'default' : 'outline'} onClick={() => onChange(visit)}>
          {visit.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
