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

function ChecklistFlowScreen({ gateData, caseData, visit, onVisitChange, onEditGate, onChangeVisit, onCompleteCase }) {
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
      <VoiceAssistant
        transcribeAudio={async (audioBlob, meta) => {
          // VoiceAssistant stays a pure UI component — all network/provider
          // logic lives in voiceService. When we later switch to
          // `processVoice(audio)` (STT → Intent → Checklist), only this
          // line changes.
          return voiceService.transcribeWithMetrics(audioBlob, meta);
        }}
        onRecordingStarted={() => {
          // Hook for future: e.g., analytics, UI hints. No-op for now.
        }}
        onRecordingStopped={(audioBlob) => {
          // Audio kept in memory only — no persistence.
          console.log('Voice recording captured', {
            size: audioBlob?.size,
            type: audioBlob?.type,
          });
        }}
        onTranscriptReady={(transcript) => {
          console.log('Transcript ready', transcript);
        }}
      />
    </AppLayout>
  );
}
