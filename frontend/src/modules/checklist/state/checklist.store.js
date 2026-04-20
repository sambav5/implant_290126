import { createContext, useContext, useMemo, useReducer } from 'react';

const defaultState = {
  patientData: {
    caseContext: { baseCase: 'single_tooth', modifiers: { esthetic: false, sinus: false, immediate: false, full_arch: false, gbr: false, guide: true } },
    medical: [],
    functional_risk: [],
    periodontal: '',
    patient_expectation: '',
    torque: null,
  },
  checklist: [],
  responses: {},
  warnings: [],
  inlineWarnings: {},
  role: 'implantologist',
  myTasksOnly: true,
  activePhase: 'planning',
  activeVisit: 'v1',
};

const ChecklistContext = createContext({ state: defaultState, dispatch: () => null });

function reducer(state, action) {
  switch (action.type) {
    case 'SET_PATIENT_DATA':
      return { ...state, patientData: { ...state.patientData, ...action.payload } };
    case 'SET_CHECKLIST':
      return { ...state, checklist: action.payload };
    case 'SET_WARNINGS':
      return { ...state, warnings: action.payload };
    case 'SET_INLINE_WARNINGS':
      return { ...state, inlineWarnings: action.payload };
    case 'SET_RESPONSES':
      return { ...state, responses: { ...state.responses, ...action.payload } };
    case 'SET_ROLE':
      return { ...state, role: action.payload };
    case 'SET_MY_TASKS_ONLY':
      return { ...state, myTasksOnly: action.payload };
    case 'SET_ACTIVE_PHASE':
      return { ...state, activePhase: action.payload };
    case 'SET_ACTIVE_VISIT':
      return { ...state, activeVisit: action.payload };
    default:
      return state;
  }
}

export function ChecklistProvider({ children, initialState = {} }) {
  const [state, dispatch] = useReducer(reducer, {
    ...defaultState,
    ...initialState,
    patientData: {
      ...defaultState.patientData,
      ...(initialState.patientData || {}),
    },
  });
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <ChecklistContext.Provider value={value}>{children}</ChecklistContext.Provider>;
}

export function useChecklistStore() {
  return useContext(ChecklistContext);
}
