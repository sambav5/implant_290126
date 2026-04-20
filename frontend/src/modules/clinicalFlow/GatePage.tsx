import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/layout/AppLayout';
import ContentContainer from '@/components/ui/ContentContainer';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { caseApi } from '@/services/api';
import { toast } from 'sonner';

const medicalOptions = [
  'Healthy',
  'Controlled diabetes',
  'Uncontrolled diabetes',
  'Hypertension',
  'Anticoagulants',
  'Smoker',
  'IV bisphosphonates / Denosumab',
  'Cancer therapy',
  'Recent MI',
  'Immunocompromised',
];

const periodontalOptions = ['Healthy', 'Treated & stable', 'Active disease'];
const functionalOptions = ['Normal', 'Bruxism', 'TMJ disorder', 'Heavy occlusion'];
const expectationOptions = ['Aligned', 'Cost concern', 'Esthetic mismatch', 'Timeline mismatch'];

const storageKeyForCase = (caseId: string) => `case_gate_data_${caseId}`;

function toStoredMedical(values: string[]) {
  const map: Record<string, string> = {
    Smoker: 'smoker',
    'Controlled diabetes': 'controlled_diabetes',
    'Uncontrolled diabetes': 'uncontrolled_diabetes',
    Hypertension: 'hypertension',
    Anticoagulants: 'anticoagulants',
    'IV bisphosphonates / Denosumab': 'iv_bisphosphonates_or_denosumab',
    'Cancer therapy': 'cancer_therapy',
    'Recent MI': 'recent_mi',
    Immunocompromised: 'immunocompromised',
    Healthy: 'healthy',
  };
  return values.map((value) => map[value] || value.toLowerCase().replace(/\s+/g, '_'));
}

function getRiskLevel(gateData: { medical: string[]; periodontal: string; functional_risk: string[]; patient_expectation: string }) {
  const hasRed =
    gateData.medical.includes('Uncontrolled diabetes') ||
    gateData.medical.includes('IV bisphosphonates / Denosumab') ||
    gateData.medical.includes('Recent MI') ||
    gateData.periodontal === 'Active disease';

  const hasAmber =
    gateData.medical.some((m) => ['Controlled diabetes', 'Hypertension', 'Anticoagulants', 'Smoker', 'Cancer therapy', 'Immunocompromised'].includes(m)) ||
    gateData.functional_risk.some((item) => item !== 'Normal') ||
    gateData.patient_expectation !== 'Aligned';

  if (hasRed) return 'red';
  if (hasAmber) return 'amber';
  return 'green';
}

export default function GatePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [gateData, setGateData] = useState({
    medical: [],
    periodontal: '',
    functional_risk: [],
    patient_expectation: '',
  });

  useEffect(() => {
    const stored = localStorage.getItem(storageKeyForCase(id));
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);
      setGateData((prev) => ({ ...prev, ...parsed }));
    } catch {
      // Ignore malformed local cache
    }
  }, [id]);

  const riskLevel = useMemo(() => getRiskLevel(gateData), [gateData]);

  const toggleMulti = (key: 'medical' | 'functional_risk', value: string) => {
    setGateData((prev) => {
      const values = prev[key] || [];
      const exists = values.includes(value);
      const next = exists ? values.filter((entry) => entry !== value) : [...values, value];
      return { ...prev, [key]: next };
    });
  };

  const submitGate = async () => {
    const payload = {
      medical: gateData.medical,
      periodontal: gateData.periodontal,
      functional_risk: gateData.functional_risk,
      patient_expectation: gateData.patient_expectation,
    };

    localStorage.setItem(storageKeyForCase(id), JSON.stringify(payload));

    setSaving(true);
    try {
      await caseApi.update(id, {
        gateData: {
          ...payload,
          medical_normalized: toStoredMedical(payload.medical),
        },
      });
    } catch {
      toast.info('Snapshot saved locally. Backend save can be added later.');
    } finally {
      setSaving(false);
      navigate(`/case/${id}/routing`);
    }
  };

  return (
    <AppLayout>
      <ContentContainer className="py-6 space-y-5">
        <div className="card-clinical space-y-2">
          <h1 className="text-xl font-semibold">Case Snapshot</h1>
          <p className="text-sm text-gray-600">Quick overview before checklist generation.</p>
        </div>

        <div className={`rounded-lg border px-3 py-2 text-sm ${riskLevel === 'red' ? 'bg-red-50 border-red-200 text-red-800' : riskLevel === 'amber' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
          <p>
            {riskLevel === 'red'
              ? 'Clinical insights: Higher risk factors identified. Careful planning recommended.'
              : riskLevel === 'amber'
                ? 'Clinical insights: Some risk factors identified. Review before proceeding.'
                : 'Clinical insights: No significant risk factors identified.'}
          </p>
          <p className="text-xs mt-1">{riskLevel === 'green' ? 'For guidance in planning.' : 'For guidance.'}</p>
        </div>

        <div className="card-clinical space-y-4">
          <h2 className="font-semibold">Medical Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {medicalOptions.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <Checkbox checked={gateData.medical.includes(option)} onCheckedChange={() => toggleMulti('medical', option)} />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="card-clinical space-y-4">
          <h2 className="font-semibold">Periodontal Status</h2>
          <Select value={gateData.periodontal || undefined} onValueChange={(value) => setGateData((prev) => ({ ...prev, periodontal: value }))}>
            <SelectTrigger className="max-w-sm"><SelectValue placeholder="Select periodontal status" /></SelectTrigger>
            <SelectContent>
              {periodontalOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
            </SelectContent>
          </Select>
          {gateData.periodontal === 'Active disease' && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              Treat periodontal disease before implant recommended
            </div>
          )}
        </div>

        <div className="card-clinical space-y-4">
          <h2 className="font-semibold">Occlusion & Function</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {functionalOptions.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <Checkbox checked={gateData.functional_risk.includes(option)} onCheckedChange={() => toggleMulti('functional_risk', option)} />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="card-clinical space-y-4">
          <h2 className="font-semibold">Patient Considerations</h2>
          <Select value={gateData.patient_expectation || undefined} onValueChange={(value) => setGateData((prev) => ({ ...prev, patient_expectation: value }))}>
            <SelectTrigger className="max-w-sm"><SelectValue placeholder="Select expectation alignment" /></SelectTrigger>
            <SelectContent>
              {expectationOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={submitGate} disabled={saving} className="w-full md:w-auto" data-testid="gate-continue-btn">
          {saving ? 'Saving...' : 'Continue to Case Type'}
        </Button>
      </ContentContainer>
    </AppLayout>
  );
}
