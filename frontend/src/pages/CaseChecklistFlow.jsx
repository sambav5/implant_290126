import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/layout/AppLayout';
import ContentContainer from '@/components/ui/ContentContainer';
import { Button } from '@/components/ui/button';
import ChecklistPage from '@/modules/checklist/components/ChecklistPage';
import { ChecklistProvider } from '@/modules/checklist/state/checklist.store';
import { useChecklist } from '@/modules/checklist/hooks/useChecklist';
import { caseApi } from '@/services/api';
import { userApi } from '@/api/userApi';

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

function ChecklistFlowScreen({ caseId, gateData, caseData, onEditGate }) {
  const { state, dispatch } = useChecklist();

  useEffect(() => {
    dispatch({
      type: 'SET_PATIENT_DATA',
      payload: {
        caseType: (caseData?.planningData?.restorativeContext || caseData?.riskAssessment?.caseType || 'standard').toLowerCase(),
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={onEditGate}>Edit Case Snapshot</Button>
      </div>
      <ChecklistPage state={state} dispatch={dispatch} />
    </div>
  );
}

export default function CaseChecklistFlow() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);

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
      caseType: 'standard',
      medical: gateData.medical || [],
      functional_risk: gateData.functional_risk || [],
      periodontal: gateData.periodontal || '',
      patient_expectation: gateData.patient_expectation || '',
      torque: null,
    },
  }), [gateData]);

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
          <ChecklistFlowScreen caseId={id} gateData={gateData} caseData={caseData} onEditGate={() => navigate(`/case/${id}/gate`)} />
        </ChecklistProvider>
      </ContentContainer>
    </AppLayout>
  );
}
