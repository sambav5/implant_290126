import { useEffect, useMemo, useState } from 'react';
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

const getStorageKey = (caseId) => `case_gate_data_${caseId}`;

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
  return ['v1', 'v2', 'v3'].includes(visit) ? visit : null;
}

function normalizeCaseContext(caseContextValue) {
  if (caseContextValue && typeof caseContextValue === 'object') {
    return caseContextValue;
  }

  const legacyVariant = String(caseContextValue || '').toLowerCase();
  if (!['standard', 'sinus', 'esthetic', 'full_arch', 'immediate'].includes(legacyVariant)) return null;
  return deriveCaseContext({}, { legacyCaseType: legacyVariant });
}

const CHECKLIST_FLOW_VISITS = ['v1', 'v2', 'v3'];

function ChecklistFlowScreen({
  caseId,
  gateData,
  caseData,
  activeVisit,
  onEditGate,
  onChangeVisit,
  onPreviousVisit,
  onNextVisit,
  onCompleteTreatment,
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
    if (state.activeVisit !== activeVisit) {
      dispatch({ type: 'SET_ACTIVE_VISIT', payload: activeVisit });
    }
  }, [activeVisit, dispatch, state.activeVisit]);

  useEffect(() => {
    localStorage.setItem(
      `case_checklist_flow_state_${caseId}`,
      JSON.stringify({
        responses: state.responses,
        activeVisit: state.activeVisit,
      }),
    );
  }, [caseId, state.activeVisit, state.responses]);

  const activeVisitIndex = CHECKLIST_FLOW_VISITS.indexOf(state.activeVisit);
  const canGoPreviousVisit = activeVisitIndex > 0;
  const canGoNextVisit = activeVisitIndex >= 0 && activeVisitIndex < CHECKLIST_FLOW_VISITS.length - 1;

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onChangeVisit}>Change Visit</Button>
        <Button variant="outline" onClick={onEditGate}>Edit Case Snapshot</Button>
      </div>
      <ChecklistPage
        state={state}
        dispatch={dispatch}
        canGoPreviousVisit={canGoPreviousVisit}
        canGoNextVisit={canGoNextVisit}
        onPreviousVisit={onPreviousVisit}
        onNextVisit={onNextVisit}
        onCompleteTreatment={onCompleteTreatment}
      />
    </div>
  );
}

export default function CaseChecklistFlow() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedVisit = useMemo(
    () => normalizeVisit(location.state?.currentVisit),
    [location.state?.currentVisit],
  );
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeVisit, setActiveVisit] = useState(selectedVisit || 'v1');

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
    activeVisit,
    responses: (() => {
      try {
        const savedState = JSON.parse(localStorage.getItem(`case_checklist_flow_state_${id}`) || '{}');
        return savedState.responses || {};
      } catch {
        return {};
      }
    })(),
  }), [activeVisit, gateData, id, selectedCaseContext]);

  useEffect(() => {
    if (loading) return;
    if (!selectedVisit && !activeVisit) {
      navigate(`/case/${id}/checklist/visit`, { replace: true });
    }
  }, [activeVisit, id, loading, navigate, selectedVisit]);

  useEffect(() => {
    if (selectedVisit) {
      setActiveVisit(selectedVisit);
      return;
    }

    try {
      const savedState = JSON.parse(localStorage.getItem(`case_checklist_flow_state_${id}`) || '{}');
      const savedVisit = normalizeVisit(savedState.activeVisit);
      if (savedVisit) {
        setActiveVisit(savedVisit);
      }
    } catch {
      // Ignore malformed local storage
    }
  }, [id, selectedVisit]);

  const goToVisit = (direction) => {
    const currentIndex = CHECKLIST_FLOW_VISITS.indexOf(activeVisit);
    if (currentIndex === -1) return;

    const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= CHECKLIST_FLOW_VISITS.length) return;

    const nextVisit = CHECKLIST_FLOW_VISITS[nextIndex];
    setActiveVisit(nextVisit);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCompleteCase = () => {
    navigate(`/case/${id}/learning`, {
      state: {
        fromChecklist: true,
        caseContext: selectedCaseContext,
        currentVisit: activeVisit,
      },
    });
  };

  if (loading) {
    return (
      <AppLayout>
        <ContentContainer className="py-6">Loading checklist…</ContentContainer>
      </AppLayout>
    );
  }

  if (!activeVisit) {
    return null;
  }

  return (
    <AppLayout>
      <ContentContainer className="py-4">
        <ChecklistProvider initialState={initialState}>
          <ChecklistFlowScreen
            caseId={id}
            gateData={gateData}
            caseData={{ ...caseData, selectedCaseContext }}
            activeVisit={activeVisit}
            onEditGate={() => navigate(`/case/${id}/gate`)}
            onChangeVisit={() =>
              navigate(`/case/${id}/checklist/visit`, {
                state: { currentVisit: activeVisit, caseContext: selectedCaseContext, routingVariant: getRoutingVariant(selectedCaseContext) },
              })
            }
            onPreviousVisit={() => goToVisit('previous')}
            onNextVisit={() => goToVisit('next')}
            onCompleteTreatment={handleCompleteCase}
          />
        </ChecklistProvider>
      </ContentContainer>
    </AppLayout>
  );
}
