import { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/layout/AppLayout';
import ContentContainer from '@/components/ui/ContentContainer';
import { Button } from '@/components/ui/button';
import { deriveCaseContext, getRoutingVariant } from '@/lib/caseContext';

type VisitOption = {
  id: 'v1' | 'v2' | 'v3';
  title: string;
  subtitle: string;
};

type RoutingVariant = 'standard' | 'sinus' | 'esthetic' | 'full_arch' | 'immediate';

const storageKeyForCaseContext = (caseId: string) => `case_routing_context_${caseId}`;

const visitOptions: VisitOption[] = [
  { id: 'v1', title: 'Visit 1', subtitle: 'Surgery' },
  { id: 'v2', title: 'Visit 2', subtitle: 'Impression' },
  { id: 'v3', title: 'Visit 3', subtitle: 'Delivery' },
];

function normalizeVisit(visitValue: unknown): VisitOption['id'] | null {
  const visit = String(visitValue || '').toLowerCase();
  return visit === 'v1' || visit === 'v2' || visit === 'v3' ? visit : null;
}

function normalizeRoutingVariant(value: unknown): RoutingVariant | null {
  const normalizedValue = String(value || '').toLowerCase();
  return ['standard', 'sinus', 'esthetic', 'full_arch', 'immediate'].includes(normalizedValue) ? (normalizedValue as RoutingVariant) : null;
}

export default function VisitSelectionPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const selectedVisit = useMemo(
    () => normalizeVisit((location.state as { currentVisit?: string } | null)?.currentVisit),
    [location.state],
  );

  const caseContext = useMemo(() => {
    const fromState = (location.state as { caseContext?: unknown } | null)?.caseContext;
    if (fromState && typeof fromState === 'object') return fromState as ReturnType<typeof deriveCaseContext>;

    try {
      const localContext = JSON.parse(localStorage.getItem(storageKeyForCaseContext(id)) || 'null');
      if (localContext?.baseCase && localContext?.modifiers) return localContext;
    } catch {
      // Ignore malformed local storage
    }

    const legacyLocal = normalizeRoutingVariant(localStorage.getItem(`case_routing_type_${id}`));
    return deriveCaseContext({}, { legacyCaseType: legacyLocal || 'standard' });
  }, [id, location.state]);

  const routingVariant = getRoutingVariant(caseContext);

  const onSelectVisit = (visit: VisitOption['id']) => {
    navigate(`/case/${id}/checklist`, { state: { currentVisit: visit, caseContext, routingVariant } });
  };

  return (
    <AppLayout>
      <ContentContainer className="py-6 space-y-5">
        <div className="card-clinical space-y-2">
          <h1 className="text-xl font-semibold">Select Your Visit</h1>
          <p className="text-sm text-gray-600">Pick the visit you're running. Your checklist is ready.</p>
          <p className="text-sm text-gray-700">
            Route: <span className="font-semibold capitalize">{routingVariant.replace('_', ' ')}</span>
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
                  <p className="font-semibold">{visit.title} — {visit.subtitle}</p>
                  <p className="text-xs text-gray-600">Open checklist →</p>
                </div>
              </Button>
            );
          })}
        </div>

        <Button variant="outline" onClick={() => navigate(`/case/${id}/routing`, { state: { caseContext, routingVariant } })}>
          ← CHANGE PROTOCOL
        </Button>
      </ContentContainer>
    </AppLayout>
  );
}
