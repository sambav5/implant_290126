import { Button } from '@/components/ui/button';

export default function VisitTabs({ visits = [], currentVisit, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {visits.map((visit) => (
        <Button
          key={visit.id}
          variant={currentVisit === visit.id ? 'default' : 'outline'}
          onClick={() => onChange(visit.id)}
        >
          {visit.id.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
