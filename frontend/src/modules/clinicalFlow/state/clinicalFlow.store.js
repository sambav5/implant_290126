import { createContext, useContext, useMemo, useReducer } from 'react';

const defaultState = {
  gate: { gateStatus: 'GO', blockers: [], warnings: [] },
  caseType: '',
  currentVisit: 'v1',
  patientData: {
    medicalRisk: 'low',
    periodontalStatus: 'low',
    functionalRisk: 'low',
    patientExpectation: 'low',
    medical: [],
    functional_risk: [],
  },
  tasks: [],
  responses: {},
  warnings: [],
  stopEvents: [],
  role: 'implantologist',
  myTasksOnly: true,
};

const ClinicalFlowContext = createContext({ state: defaultState, dispatch: () => null });

function reducer(state, action) {
  switch (action.type) {
    case 'SET_GATE':
      return { ...state, gate: action.payload };
    case 'SET_CASE_TYPE':
      return { ...state, caseType: action.payload };
    case 'SET_CURRENT_VISIT':
      return { ...state, currentVisit: action.payload };
    case 'SET_PATIENT_DATA':
      return { ...state, patientData: { ...state.patientData, ...action.payload } };
    case 'SET_TASKS':
      return { ...state, tasks: action.payload };
    case 'SET_RESPONSES':
      return { ...state, responses: { ...state.responses, ...action.payload } };
    case 'SET_WARNINGS':
      return { ...state, warnings: action.payload };
    case 'SET_STOP_EVENTS':
      return { ...state, stopEvents: action.payload };
    case 'SET_ROLE':
      return { ...state, role: action.payload };
    case 'SET_MY_TASKS_ONLY':
      return { ...state, myTasksOnly: action.payload };
    case 'RESET_FLOW':
      return defaultState;
    default:
      return state;
  }
}

export function ClinicalFlowProvider({ children, initialState = {} }) {
  const [state, dispatch] = useReducer(reducer, { ...defaultState, ...initialState });
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <ClinicalFlowContext.Provider value={value}>{children}</ClinicalFlowContext.Provider>;
}

export function useClinicalFlowStore() {
  return useContext(ClinicalFlowContext);
}
