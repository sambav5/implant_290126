import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/layout/AppLayout';
import ContentContainer from '@/components/ui/ContentContainer';
import { Button } from '@/components/ui/button';
import { caseApi } from '@/services/api';
import { deriveCaseContext } from '@/lib/caseContext';

const storageKeyForCaseContext = (caseId: string) => `case_routing_context_${caseId}`;

type RoutingVariant = 'standard' | 'sinus' | 'esthetic' | 'full_arch' | 'immediate';

type RoutingVariantOption = {
  id: RoutingVariant;
  title: string;
  subtitle: string;
};

const routingVariantOptions: RoutingVariantOption[] = [
  { id: 'standard', title: 'Standard', subtitle: 'posterior single unit' },
  { id: 'sinus', title: 'Sinus', subtitle: 'posterior maxilla, ≤9mm bone' },
  { id: 'esthetic', title: 'Esthetic', subtitle: 'anterior zone' },
  { id: 'full_arch', title: 'Full Arch', subtitle: '4+ implants' },
  { id: 'immediate', title: 'Immediate', subtitle: 'placement at extraction' },
];

function normalizeRoutingVariant(value: unknown): RoutingVariant | null {
  const normalized = String(value || '').toLowerCase();
  return routingVariantOptions.some((option) => option.id === normalized) ? (normalized as RoutingVariant) : null;
}

function getSuggestedCaseType(gateData: { functional_risk?: string[]; patient_expectation?: string; medical?: string[] }) {
  const functionalRisk = (gateData.functional_risk || []).map((value) => value.toLowerCase());
  const expectations = String(gateData.patient_expectation || '').toLowerCase();
  const medical = (gateData.medical || []).map((value) => value.toLowerCase());

  if (functionalRisk.some((risk) => risk.includes('heavy')) || medical.some((entry) => entry.includes('smoker'))) {
    return 'standard';
  }

  if (functionalRisk.some((risk) => risk.includes('tmj')) || functionalRisk.some((risk) => risk.includes('bruxism'))) {
    return 'full_arch';
  }

  if (expectations.includes('esthetic')) {
    return 'esthetic';
  }

  return null;
}

export default function RoutingPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedVariant, setSelectedVariant] = useState<RoutingVariant | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fromState = normalizeRoutingVariant((location.state as { routingVariant?: string } | null)?.routingVariant);
    if (fromState) {
      setSelectedVariant(fromState);
      return;
    }

    try {
      const localContext = localStorage.getItem(storageKeyForCaseContext(id));
      const parsedContext = localContext ? JSON.parse(localContext) : null;
      const selectedFromContext = normalizeRoutingVariant(
        (parsedContext?.modifiers?.full_arch && 'full_arch') ||
        (parsedContext?.modifiers?.sinus && 'sinus') ||
        (parsedContext?.modifiers?.esthetic && 'esthetic') ||
        (parsedContext?.modifiers?.immediate && 'immediate') ||
        'standard',
      );
      if (selectedFromContext) {
        setSelectedVariant(selectedFromContext);
        return;
      }
    } catch {
      // Ignore malformed local storage and try legacy key
    }

    const legacyLocalValue = normalizeRoutingVariant(localStorage.getItem(`case_routing_type_${id}`));
    if (legacyLocalValue) {
      setSelectedVariant(legacyLocalValue);
    }
  }, [id, location.state]);

  const suggestion = useMemo(() => {
    try {
      const snapshot = JSON.parse(localStorage.getItem(`case_gate_data_${id}`) || '{}');
      return getSuggestedCaseType(snapshot);
    } catch {
      return null;
    }
  }, [id]);

  const onContinue = async () => {
    if (!selectedVariant) return;

    const caseContext = deriveCaseContext({}, { legacyCaseType: selectedVariant });
    localStorage.setItem(storageKeyForCaseContext(id), JSON.stringify(caseContext));

    setSaving(true);
    try {
      await caseApi.update(id, {
        planningData: { caseContext },
      });
    } catch {
      // Non-blocking: local state is sufficient to continue flow
    } finally {
      setSaving(false);
      navigate(`/case/${id}/checklist/visit`, { state: { caseContext, routingVariant: selectedVariant } });
    }
  };

  return (
    <AppLayout>
      <ContentContainer className="py-6 space-y-5">
        <div className="card-clinical space-y-2">
          <h1 className="text-xl font-semibold">Choose Your Protocol</h1>
          <p className="text-sm text-gray-600">Pick the case type. Seamless builds your checklist from here.</p>
        </div>

        {suggestion && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            Seamless recommends: <span className="font-semibold capitalize">{suggestion.replace('_', ' ')}</span> — based on what you've told it.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {routingVariantOptions.map((option) => {
            const isSelected = selectedVariant === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedVariant(option.id)}
                className={`text-left rounded-lg border px-4 py-4 transition min-h-24 ${
                  isSelected ? 'border-forest bg-green-50 ring-1 ring-forest' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className="font-semibold">{option.title}</p>
                <p className="text-sm text-gray-600">{option.subtitle}</p>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => navigate(`/case/${id}/gate`)}>
            ← BACK
          </Button>
          <Button onClick={onContinue} disabled={!selectedVariant || saving}>
            {saving ? 'Saving...' : 'LOCK PROTOCOL'}
          </Button>
        </div>
      </ContentContainer>
    </AppLayout>
  );
}
