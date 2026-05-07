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
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#E5E7EB]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/case/${caseId}`)}
              className="p-2 -ml-2 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1A1A1A] transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-[#1A1A1A] tracking-tight">Case Reflection</h1>
              <p className="text-sm text-[#6B7280]">Capture insights to improve future outcomes</p>
            </div>
          </div>
        </div>
      }
      footerActions={
        canEdit ? (
          <ContentContainer>
            <Button onClick={handleSave} disabled={saving} className="w-full bg-[#1F7A63] hover:bg-[#17604D] text-white min-h-[44px]">
              {saving ? 'Saving...' : 'Save Reflection'}
            </Button>
          </ContentContainer>
        ) : null
      }
    >
      <ContentContainer className="py-6 space-y-6">
        {!isCaseCompleted && (
          <div className="p-4 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
            <p className="text-sm font-medium">Reflection unlocks after case completion.</p>
          </div>
        )}

        {!isClinician && (
          <div className="p-4 rounded-xl bg-blue-50 text-blue-800 border border-blue-200">
            <p className="text-sm font-medium">Read-only view: only clinicians can edit this reflection.</p>
          </div>
        )}

        <div className="card-clinical space-y-6">
          {[
            ['wentWell', '1. What went well?'],
            ['issues', '2. What did not go as expected?'],
            ['improvements', '3. What could have been done better?'],
            ['keyLearning', '4. Key clinical learning'],
            ['repeatChange', '5. Would you change your plan if repeating this case?'],
          ].map(([key, label]) => (
            <div className="space-y-2" key={key}>
              <Label className="text-sm font-semibold text-[#1A1A1A]">{label}</Label>
              <Textarea
                value={reflection[key]}
                onChange={(e) => setReflection((prev) => ({ ...prev, [key]: e.target.value }))}
                className="min-h-[110px] bg-[#F9FAFB] border-[#E5E7EB] focus:bg-white focus:border-[#1F7A63] focus:ring-[#1F7A63]"
                disabled={!canEdit}
                placeholder={canEdit ? 'Type your response here...' : 'No response provided.'}
              />
            </div>
          ))}
        </div>
      </ContentContainer>
    </AppLayout>
  );
}
