import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/layout/AppLayout';
import ContentContainer from '@/components/ui/ContentContainer';
import { Button } from '@/components/ui/button';
import ChecklistPage from '@/modules/checklist/components/ChecklistPage';
import { ChecklistProvider } from '@/modules/checklist/state/checklist.store';
import { useChecklist } from '@/modules/checklist/hooks/useChecklist';
import { caseApi } from '@/services/api';
import { userApi } from '@/api/userApi';
import { deriveCaseContext, getRoutingVariant } from '@/lib/caseContext';
import VoiceAssistant from '@/components/VoiceAssistant';
import voiceService from '@/services/voiceService';

const getStorageKey = (caseId) => `case_gate_data_${caseId}`;
const getChecklistStorageKey = (caseId) => `case_checklist_progress_${caseId}`;

function normalizeGateData(gateData = {}) {
  const medicalRaw = gateData.medical || [];
  const functionalRaw = gateData.functional_risk || [];

  const normalizedMedical = medicalRaw.map((value) => {
    if (value === 'Smoker' || value === 'smoker') return 'smoker';
    return value.toLowerCase().replace(/\s+/g, '_');
  });

  const normalizedFunctional = functionalRaw.map((value) => {
    if (value === 'Bruxism' || value === 'bruxism') return 'bruxism';
    return value.toLowerCase().replace(/\s+/g, '_');
  });

  return {
    medical: normalizedMedical,
    periodontal: gateData.periodontal || '',
    functional_risk: normalizedFunctional,
    patient_expectation: gateData.patient_expectation || '',
  };
}

function normalizeVisit(visitValue) {
  const visit = String(visitValue || '').toLowerCase();
  return ['v1', 'v2', 'v3', 'v4'].includes(visit) ? visit : null;
}

function normalizeCaseContext(caseContextValue) {
  if (caseContextValue && typeof caseContextValue === 'object') {
    return caseContextValue;
  }

  const legacyVariant = String(caseContextValue || '').toLowerCase();
  if (!['standard', 'sinus', 'esthetic', 'full_arch', 'immediate'].includes(legacyVariant)) return null;
  return deriveCaseContext({}, { legacyCaseType: legacyVariant });
}

function ChecklistFlowScreen({
  caseId,
  gateData,
  caseData,
  visit,
  onVisitChange,
  onEditGate,
  onChangeVisit,
  onCompleteCase,
}) {
  const { state, dispatch } = useChecklist();

  useEffect(() => {
    dispatch({
        type: 'SET_PATIENT_DATA',
        payload: {
        caseContext: caseData?.selectedCaseContext || deriveCaseContext({}),
        medical: gateData.medical || [],
        functional_risk: gateData.functional_risk || [],
        periodontal: gateData.periodontal || '',
        patient_expectation: gateData.patient_expectation || '',
      },
    });
  }, [caseData, dispatch, gateData]);

  useEffect(() => {
    let mounted = true;

    async function loadRole() {
      try {
        const response = await userApi.getProfile();
        const backendRole = String(response?.data?.role || 'clinician').toLowerCase();
        if (mounted) {
          dispatch({ type: 'SET_ROLE', payload: backendRole });
        }
      } catch {
        if (mounted) {
          dispatch({ type: 'SET_ROLE', payload: 'clinician' });
        }
      }
    }

    loadRole();
    return () => {
      mounted = false;
    };
  }, [dispatch]);

  useEffect(() => {
    if (visit) {
      dispatch({ type: 'SET_ACTIVE_VISIT', payload: visit });
    }
  }, [dispatch, visit]);

  useEffect(() => {
    if (visit) {
      console.log('Current visit:', visit);
    }
  }, [visit]);

  // Build a minimal procedure context for the Intent Engine. Intentionally
  // tiny: just the active phase's checklist for the current visit, split
  // into pending/completed using the existing responses map. No patient data.
  const voiceContext = useMemo(() => {
    const activeVisit = visit || state.activeVisit;
    const activePhase = state.activePhase;
    const responses = state.responses || {};
    const filtered = (state.checklist || []).filter(
      (item) =>
        (!activeVisit || item.visit === activeVisit) &&
        (!activePhase || item.phase === activePhase),
    );
    const pendingItems = filtered.filter((i) => !responses[i.id]).map((i) => i.text);
    const completedItems = filtered.filter((i) => !!responses[i.id]).map((i) => i.text);
    const currentStep = pendingItems[0] || null;

    const visitLabels = {
      v1: 'Visit 1 — Surgery',
      v2: 'Visit 2 — Impression',
      v3: 'Visit 3 — Delivery',
      v4: 'Visit 4 — Maintenance',
    };
    const caseName = caseData?.caseName || 'Implant Procedure';
    const procedureName = activeVisit
      ? `${caseName} — ${visitLabels[activeVisit] || activeVisit}`
      : caseName;

    return { procedureName, currentStep, pendingItems, completedItems };
  }, [
    visit,
    state.activeVisit,
    state.activePhase,
    state.checklist,
    state.responses,
    caseData?.caseName,
  ]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onChangeVisit(undefined, state)}>Change Visit</Button>
        <Button variant="outline" onClick={onEditGate}>Edit Case Snapshot</Button>
      </div>
      <ChecklistPage
        state={state}
        dispatch={dispatch}
        totalVisits={3}
        activeVisit={visit}
        onVisitChange={onVisitChange}
        onChangeVisit={(visitNumber) => onChangeVisit(visitNumber, state)}
        onCompleteCase={() => onCompleteCase(state)}
      />

      <VoiceAssistant
        processVoice={(audioBlob, meta) =>
          // VoiceAssistant stays a pure UI component. All network + provider
          // work lives in voiceService.processVoice. The minimal procedure
          // context is computed here from local state — no patient record
          // is ever sent.
          voiceService.processVoice(
            audioBlob,
            {
              procedureId: caseId,
              context: voiceContext,
              recordingMs: meta?.recordingMs,
            },
          )
        }
        confirmAction={({ intent, entity, parameters, transcript }) =>
          voiceService.confirmVoiceAction({
            procedureId: caseId,
            intent,
            entity,
            parameters,
            transcript,
          })
        }
        onAction={(result) => {
          // The backend just mutated server-side state. Mirror the change
          // locally so the UI updates instantly without a refetch.
          if (!result || !result.success) return;
          const actionType = result.action?.type;
          const data = result.action?.data || {};

          if (actionType === 'checklist_item_completed') {
            const completedText =
              data?.item?.text || result.entity || '';
            if (!completedText) return;

            // Match the server-side item against our local checklist by text
            // (case-insensitive). If we find it, mark it complete locally so
            // the checklist UI advances without a page refresh.
            const localMatch = (state.checklist || []).find(
              (i) => String(i.text || '').trim().toLowerCase() ===
                     String(completedText).trim().toLowerCase(),
            );
            if (localMatch) {
              dispatch({
                type: 'SET_RESPONSES',
                payload: { [localMatch.id]: true },
              });
            }
            return;
          }

          if (actionType === 'procedure_completed') {
            // Best-effort: try to navigate to a summary screen if it exists,
            // otherwise stay on the page (the toast already confirms).
            // We DO NOT navigate eagerly to avoid losing user context; the
            // existing "Complete Case" flow remains the canonical exit.
            return;
          }
        }}
        onError={(error) => {
          console.warn('Voice processing failed', error);
        }}
      />
    </div>
  );
}

export default function CaseChecklistFlow() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visit, setVisit] = useState(() => {
    const fromRoute = normalizeVisit(location.state?.currentVisit);
    if (fromRoute) return fromRoute;

    const fromStorage = normalizeVisit(localStorage.getItem('currentVisit'));
    return fromStorage || 'v1';
  });
  const persistedChecklistState = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(getChecklistStorageKey(id)) || 'null') || {};
    } catch {
      return {};
    }
  }, [id]);
  const selectedVisit = useMemo(
    () => normalizeVisit(location.state?.currentVisit),
    [location.state?.currentVisit],
  );

  useEffect(() => {
    if (selectedVisit) {
      setVisit(selectedVisit);
    }
  }, [selectedVisit]);

  useEffect(() => {
    localStorage.setItem('currentVisit', visit);
  }, [visit]);

  const selectedCaseContext = useMemo(() => {
    const fromState = normalizeCaseContext(location.state?.caseContext);
    if (fromState) return fromState;

    try {
      const fromLocal = normalizeCaseContext(JSON.parse(localStorage.getItem(`case_routing_context_${id}`) || 'null'));
      if (fromLocal) return fromLocal;
    } catch {
      // Ignore malformed local storage and fall back to case data
    }

    return caseData?.planningData?.caseContext || deriveCaseContext(caseData?.planningData || {}, { legacyCaseType: caseData?.riskAssessment?.['case' + 'Type'] });
  }, [caseData?.planningData, caseData?.riskAssessment, id, location.state?.caseContext]);

  useEffect(() => {
    async function loadCase() {
      try {
        const response = await caseApi.getById(id);
        setCaseData(response.data);
      } catch {
        navigate(`/case/${id}`);
      } finally {
        setLoading(false);
      }
    }
    loadCase();
  }, [id, navigate]);

  const gateData = useMemo(() => {
    const fromCase = normalizeGateData(caseData?.gateData || {});
    if (fromCase.medical.length || fromCase.functional_risk.length || fromCase.periodontal || fromCase.patient_expectation) {
      return fromCase;
    }

    try {
      const local = JSON.parse(localStorage.getItem(getStorageKey(id)) || '{}');
      return normalizeGateData(local);
    } catch {
      return normalizeGateData({});
    }
  }, [caseData, id]);

  const initialState = useMemo(() => ({
      patientData: {
      caseContext: selectedCaseContext,
      medical: gateData.medical || [],
      functional_risk: gateData.functional_risk || [],
      periodontal: gateData.periodontal || '',
      patient_expectation: gateData.patient_expectation || '',
      torque: null,
    },
    responses: persistedChecklistState.responses || {},
    activeVisit: visit,
  }), [gateData, persistedChecklistState.responses, selectedCaseContext, visit]);

  const saveChecklist = useCallback((checklistState, nextVisit) => {
    const snapshot = {
      responses: checklistState?.responses || {},
      lastVisit: nextVisit || visit,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(getChecklistStorageKey(id), JSON.stringify(snapshot));
  }, [id, visit]);

  const goToVisit = useCallback((visitNumber, checklistState) => {
    const normalizedVisit = normalizeVisit(`v${visitNumber}`);
    if (!normalizedVisit) return;
    setVisit(normalizedVisit);
    saveChecklist(checklistState, normalizedVisit);
  }, [saveChecklist]);

  const handleCompleteCase = useCallback((checklistState) => {
    saveChecklist(checklistState, visit);
    navigate(`/case/${id}`);
  }, [id, navigate, saveChecklist, visit]);


  if (loading) {
    return (
      <AppLayout>
        <ContentContainer className="py-6">Loading checklist…</ContentContainer>
      </AppLayout>
    );
  }


  return (
    <AppLayout>
      <ContentContainer className="py-4">
        <ChecklistProvider initialState={initialState}>
          <ChecklistFlowScreen
            caseId={id}
            gateData={gateData}
            caseData={{ ...caseData, selectedCaseContext }}
            visit={visit}
            onVisitChange={(visitNumber) => goToVisit(visitNumber)}
            onEditGate={() => navigate(`/case/${id}/gate`)}
            onChangeVisit={(visitNumber, checklistState) => {
              if (typeof visitNumber === 'number') {
                goToVisit(visitNumber, checklistState);
                return;
              }
              saveChecklist(checklistState, visit);
              navigate(`/case/${id}/checklist/visit`, {
                state: { currentVisit: visit, caseContext: selectedCaseContext, routingVariant: getRoutingVariant(selectedCaseContext) },
              });
            }}
            onCompleteCase={handleCompleteCase}
          />
        </ChecklistProvider>
      </ContentContainer>
    </AppLayout>
  );
}
