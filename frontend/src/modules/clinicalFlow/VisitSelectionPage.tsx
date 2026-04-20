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

type CaseType = 'standard' | 'sinus' | 'esthetic' | 'full_arch' | 'immediate';

const storageKeyForCaseType = (caseId: string) => `case_routing_type_${caseId}`;

const visitOptions: VisitOption[] = [
  { id: 'v1', title: 'Visit 1', subtitle: 'Surgery' },
  { id: 'v2', title: 'Visit 2', subtitle: 'Impression' },
  { id: 'v3', title: 'Visit 3', subtitle: 'Delivery' },
];

function normalizeVisit(visitValue: unknown): VisitOption['id'] | null {
  const visit = String(visitValue || '').toLowerCase();
  return visit === 'v1' || visit === 'v2' || visit === 'v3' ? visit : null;
}

function normalizeCaseType(caseTypeValue: unknown): CaseType | null {
  const value = String(caseTypeValue || '').toLowerCase();
  return ['standard', 'sinus', 'esthetic', 'full_arch', 'immediate'].includes(value) ? (value as CaseType) : null;
}

export default function VisitSelectionPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const selectedVisit = useMemo(
    () => normalizeVisit((location.state as { currentVisit?: string } | null)?.currentVisit),
    [location.state],
  );

  const caseType = useMemo(() => {
    const stateCaseType = normalizeCaseType((location.state as { caseType?: string } | null)?.caseType);
    if (stateCaseType) return stateCaseType;
    return normalizeCaseType(localStorage.getItem(storageKeyForCaseType(id))) || 'standard';
  }, [id, location.state]);

  const onSelectVisit = (visit: VisitOption['id']) => {
    navigate(`/case/${id}/checklist`, { state: { currentVisit: visit, caseType } });
  };

  return (
    <AppLayout>
      <ContentContainer className="py-6 space-y-5">
        <div className="card-clinical space-y-2">
          <h1 className="text-xl font-semibold">Select Visit</h1>
          <p className="text-sm text-gray-600">Choose a visit to generate and view its checklist.</p>
          <p className="text-sm text-gray-700">
            Case Type: <span className="font-semibold capitalize">{caseType.replace('_', ' ')}</span>
          </p>
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

        <Button variant="outline" onClick={() => navigate(`/case/${id}/routing`, { state: { caseType } })}>
          Back to Case Type
        </Button>
      </ContentContainer>
    </AppLayout>
  );
}
