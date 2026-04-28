import { useCallback, useEffect, useRef, useState } from 'react';
import { caseReflectionApi } from '@/services/api';
import { userApi } from '@/api/userApi';
import { toast } from 'sonner';

const initialForm = {
  wentWell: '',
  issues: '',
  improvements: '',
  learning: '',
  repeatChange: '',
};

export default function CaseReflection({ caseId }) {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [user, setUser] = useState({ role: '' });
  const skipAutoSaveRef = useRef(true);
  const saveTimeoutRef = useRef(null);

  const isEditable = user.role === 'clinician';

  useEffect(() => {
    let mounted = true;

    const loadReflection = async () => {
      try {
        const [profileResponse, reflectionResponse] = await Promise.all([
          userApi.getProfile(),
          caseReflectionApi.getByCase(caseId),
        ]);

        if (!mounted) return;

        const profile = profileResponse?.data || {};
        const existing = reflectionResponse?.data?.reflection?.reflections || {};
        setUser(profile);
        setForm({
          wentWell: existing.wentWell || '',
          issues: existing.issues || '',
          improvements: existing.improvements || '',
          learning: existing.keyLearning || existing.learning || '',
          repeatChange: existing.repeatChange || '',
        });
      } catch {
        if (mounted) toast.error('Failed to load case reflection');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadReflection();

    return () => {
      mounted = false;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [caseId]);

  const saveReflection = useCallback(async () => {
    if (!isEditable || saving) return;
    setSaving(true);
    try {
      await caseReflectionApi.create({
        caseId,
        reflections: {
          wentWell: form.wentWell,
          issues: form.issues,
          improvements: form.improvements,
          keyLearning: form.learning,
          repeatChange: form.repeatChange,
        },
      });
      setSavedAt(new Date());
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to save reflection');
    } finally {
      setSaving(false);
    }
  }, [caseId, form, isEditable, saving]);

  useEffect(() => {
    if (!isEditable || loading) return;

    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveReflection();
    }, 900);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [form, isEditable, loading, saveReflection]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <div className="card-clinical mt-4">Loading reflection…</div>;
  }

  return (
    <div className="card-clinical space-y-4 mt-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Learning Reflection</h2>
        <span className="text-xs text-muted-foreground">
          {saving ? 'Saving…' : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : 'Not saved yet'}
        </span>
      </div>

      {!isEditable && (
        <p className="text-sm text-muted-foreground">
          Read-only view: only clinicians can edit this reflection.
        </p>
      )}

      <textarea
        placeholder="What went well?"
        value={form.wentWell}
        disabled={!isEditable}
        onChange={(e) => handleChange('wentWell', e.target.value)}
        className="w-full min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm"
      />

      <textarea
        placeholder="What did not go as expected?"
        value={form.issues}
        disabled={!isEditable}
        onChange={(e) => handleChange('issues', e.target.value)}
        className="w-full min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm"
      />

      <textarea
        placeholder="What could have been done better?"
        value={form.improvements}
        disabled={!isEditable}
        onChange={(e) => handleChange('improvements', e.target.value)}
        className="w-full min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm"
      />

      <textarea
        placeholder="Key clinical learning"
        value={form.learning}
        disabled={!isEditable}
        onChange={(e) => handleChange('learning', e.target.value)}
        className="w-full min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm"
      />

      <textarea
        placeholder="If repeating this case, what would you change?"
        value={form.repeatChange}
        disabled={!isEditable}
        onChange={(e) => handleChange('repeatChange', e.target.value)}
        className="w-full min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm"
      />

      <button onClick={saveReflection} className="btn-primary" disabled={!isEditable || saving}>
        {saving ? 'Saving…' : 'Save Reflection'}
      </button>
    </div>
  );
}
