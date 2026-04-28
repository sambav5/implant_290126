import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { caseApi, caseReflectionApi } from '@/services/api';
import { userApi } from '@/api/userApi';
import { toast } from 'sonner';
import ContentContainer from '@/components/ui/ContentContainer';
import AppLayout from '@/layout/AppLayout';

export default function CaseReflection() {
  const { caseId = '' } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reflection, setReflection] = useState({
    wentWell: '',
    issues: '',
    improvements: '',
    keyLearning: '',
    repeatChange: '',
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [caseResponse, userResponse, reflectionResponse] = await Promise.all([
          caseApi.getById(caseId),
          userApi.getProfile(),
          caseReflectionApi.getByCase(caseId),
        ]);

        setCaseData(caseResponse.data);
        setUser(userResponse.data);

        const existing = reflectionResponse?.data?.reflection;
        if (existing?.reflections) {
          setReflection({
            wentWell: existing.reflections.wentWell || '',
            issues: existing.reflections.issues || '',
            improvements: existing.reflections.improvements || '',
            keyLearning: existing.reflections.keyLearning || '',
            repeatChange: existing.reflections.repeatChange || '',
          });
        }
      } catch (error) {
        toast.error('Failed to load case reflection data');
        navigate(`/case/${caseId}`);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [caseId, navigate]);

  const isClinician = useMemo(() => {
    const role = String(user?.role || '').toLowerCase();
    return role === 'clinician';
  }, [user?.role]);

  const isCaseCompleted = caseData?.status === 'completed';

  const canEdit = isClinician && isCaseCompleted;

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await caseReflectionApi.create({
        caseId,
        clinicianId: user?.id || user?.userId || '',
        reflections: reflection,
        createdAt: new Date().toISOString(),
      });
      toast.success('Case reflection saved');
      navigate(`/case/${caseId}`);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to save reflection');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AppLayout><ContentContainer className="py-6">Loading reflection…</ContentContainer></AppLayout>;
  }

  return (
    <AppLayout
      headerContent={
        <div className="px-4 py-4" style={{ background: 'var(--card)' }}>
          <ContentContainer>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/case/${caseId}`)}
                className="p-2 -ml-2 rounded-lg touch-target"
                style={{ background: 'transparent', border: 'none' }}
              >
                <ArrowLeft className="h-5 w-5" style={{ color: 'var(--t2)' }} />
              </button>
              <div>
                <h1 className="text-xl font-semibold" style={{ fontFamily: "'Lora', serif", color: 'var(--t1)' }}>Case Reflection</h1>
                <p className="text-sm" style={{ color: 'var(--t2)' }}>Capture insights to improve future outcomes</p>
              </div>
            </div>
          </ContentContainer>
        </div>
      }
      footerActions={
        canEdit ? (
          <ContentContainer>
            <Button onClick={handleSave} disabled={saving} className="w-full btn-clinical btn-primary-endo min-h-[44px]">
              {saving ? 'Saving...' : 'Save Reflection'}
            </Button>
          </ContentContainer>
        ) : null
      }
    >
      <ContentContainer className="py-6 space-y-6">
        {!isCaseCompleted && (
          <div className="p-3 rounded-lg text-sm" style={{ background: 'var(--amber-1)', color: 'var(--amber)' }}>
            Reflection unlocks after case completion.
          </div>
        )}

        {!isClinician && (
          <div className="p-3 rounded-lg text-sm" style={{ background: 'var(--blue-1)', color: 'var(--blue)' }}>
            Read-only view: only clinicians can edit this reflection.
          </div>
        )}

        {[
          ['wentWell', '1. What went well?'],
          ['issues', '2. What did not go as expected?'],
          ['improvements', '3. What could have been done better?'],
          ['keyLearning', '4. Key clinical learning (optional structured checklist)'],
          ['repeatChange', '5. Would you change your plan if repeating this case? (Yes/No + text)'],
        ].map(([key, label]) => (
          <div className="space-y-2" key={key}>
            <Label className="text-sm font-medium" style={{ color: 'var(--t1)' }}>{label}</Label>
            <Textarea
              value={reflection[key]}
              onChange={(e) => setReflection((prev) => ({ ...prev, [key]: e.target.value }))}
              className="min-h-[110px] input-clinical"
              disabled={!canEdit}
            />
          </div>
        ))}
      </ContentContainer>
    </AppLayout>
  );
}
