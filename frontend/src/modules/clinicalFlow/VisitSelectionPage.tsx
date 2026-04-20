import { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/layout/AppLayout';
import ContentContainer from '@/components/ui/ContentContainer';
import { Button } from '@/components/ui/button';

type VisitOption = {
  id: 'v1' | 'v2' | 'v3';
  title: string;
  subtitle: string;
};

const visitOptions: VisitOption[] = [
  { id: 'v1', title: 'Visit 1', subtitle: 'Surgery' },
  { id: 'v2', title: 'Visit 2', subtitle: 'Impression' },
  { id: 'v3', title: 'Visit 3', subtitle: 'Delivery' },
];

function normalizeVisit(visitValue: unknown): VisitOption['id'] | null {
  const visit = String(visitValue || '').toLowerCase();
  return visit === 'v1' || visit === 'v2' || visit === 'v3' ? visit : null;
}

export default function VisitSelectionPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const selectedVisit = useMemo(
    () => normalizeVisit((location.state as { currentVisit?: string } | null)?.currentVisit),
    [location.state],
  );

  const onSelectVisit = (visit: VisitOption['id']) => {
    navigate(`/case/${id}/checklist`, { state: { currentVisit: visit } });
  };

  return (
    <AppLayout>
      <ContentContainer className="py-6 space-y-5">
        <div className="card-clinical space-y-2">
          <h1 className="text-xl font-semibold">Select Visit</h1>
          <p className="text-sm text-gray-600">Choose a visit to generate and view its checklist.</p>
        </div>

        <div className="space-y-3">
          {visitOptions.map((visit) => {
            const isSelected = selectedVisit === visit.id;
            return (
              <Button
                key={visit.id}
                type="button"
                variant="outline"
                className={`w-full min-h-16 justify-start px-4 text-left ${isSelected ? 'border-forest bg-green-50' : ''}`}
                onClick={() => onSelectVisit(visit.id)}
              >
                <div>
                  <p className="font-semibold">{visit.title} – {visit.subtitle}</p>
                  <p className="text-xs text-gray-600">Tap to continue</p>
                </div>
              </Button>
            );
          })}
        </div>
      </ContentContainer>
    </AppLayout>
  );
}
