import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/layout/AppLayout';
import ContentContainer from '@/components/ui/ContentContainer';
import { Button } from '@/components/ui/button';
import { caseApi } from '@/services/api';

const storageKeyForCaseType = (caseId: string) => `case_routing_type_${caseId}`;

type CaseType = 'standard' | 'sinus' | 'esthetic' | 'full_arch' | 'immediate';

type CaseTypeOption = {
  id: CaseType;
  title: string;
  subtitle: string;
};

const caseTypeOptions: CaseTypeOption[] = [
  { id: 'standard', title: 'Standard', subtitle: 'posterior single unit' },
  { id: 'sinus', title: 'Sinus', subtitle: 'posterior maxilla, ≤9mm bone' },
  { id: 'esthetic', title: 'Esthetic', subtitle: 'anterior zone' },
  { id: 'full_arch', title: 'Full Arch', subtitle: '4+ implants' },
  { id: 'immediate', title: 'Immediate', subtitle: 'placement at extraction' },
];

function normalizeCaseType(value: unknown): CaseType | null {
  const normalized = String(value || '').toLowerCase();
  return caseTypeOptions.some((option) => option.id === normalized) ? (normalized as CaseType) : null;
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
  const [selectedCaseType, setSelectedCaseType] = useState<CaseType | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fromState = normalizeCaseType((location.state as { caseType?: string } | null)?.caseType);
    if (fromState) {
      setSelectedCaseType(fromState);
      return;
    }

    const localValue = normalizeCaseType(localStorage.getItem(storageKeyForCaseType(id)));
    if (localValue) {
      setSelectedCaseType(localValue);
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
    if (!selectedCaseType) return;

    localStorage.setItem(storageKeyForCaseType(id), selectedCaseType);

    setSaving(true);
    try {
      await caseApi.update(id, {
        riskAssessment: {
          caseType: selectedCaseType,
        },
      });
    } catch {
      // Non-blocking: local state is sufficient to continue flow
    } finally {
      setSaving(false);
      navigate(`/case/${id}/checklist/visit`, { state: { caseType: selectedCaseType } });
    }
  };

  return (
    <AppLayout>
      <ContentContainer className="py-6 space-y-5">
        <div className="card-clinical space-y-2">
          <h1 className="text-xl font-semibold">Routing (Case Type)</h1>
          <p className="text-sm text-gray-600">Choose a case type before selecting the visit.</p>
        </div>

        {suggestion && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            Suggested: <span className="font-semibold capitalize">{suggestion.replace('_', ' ')}</span> case based on inputs.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {caseTypeOptions.map((option) => {
            const isSelected = selectedCaseType === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedCaseType(option.id)}
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
            Back to Case Snapshot
          </Button>
          <Button onClick={onContinue} disabled={!selectedCaseType || saving}>
            {saving ? 'Saving...' : 'Continue to Visit Selection'}
          </Button>
        </div>
      </ContentContainer>
    </AppLayout>
  );
}
