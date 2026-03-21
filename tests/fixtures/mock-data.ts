export type OnboardingStage = 'PROFILE' | 'TEAM' | 'COMPLETED';

export type TeamMember = {
  id: string;
  name: string;
  role: 'Clinician' | 'Assistant' | 'Implantologist' | 'Prosthodontist' | 'Periodontist';
  mobileNumber?: string;
};

export type WorkflowStage = 'DIAGNOSIS' | 'IMPLANT_PLANNING' | 'SURGERY' | 'PROSTHETIC_DESIGN' | 'ASSISTANT_SUPPORT';

export type WorkflowAssignment = {
  stage: WorkflowStage;
  userId: string;
};

export type CaseRecord = {
  id: string;
  caseName: string;
  caseTitle: string;
  patientName: string;
  toothNumber: string;
  status: 'planning' | 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
  clinician: TeamMember;
  stageAssignments: Array<{ stage: WorkflowStage; user: TeamMember }>;
  preTreatmentChecklist: Array<{ label: string; completed: boolean }>;
  treatmentChecklist: Array<{ label: string; completed: boolean }>;
  postTreatmentChecklist: Array<{ label: string; completed: boolean }>;
};

export const AUTH_SESSION = {
  token: 'mock-jwt-token',
  tokenType: 'bearer',
  onboardingStage: 'COMPLETED' as OnboardingStage,
  expiresIn: 3600,
};

export const CLINICIAN: TeamMember = {
  id: 'user-clinician',
  name: 'Dr. Maya Clinician',
  role: 'Clinician',
  mobileNumber: '+919876543210',
};

export const TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'tm-implantologist',
    name: 'Dr. Ishaan Implant',
    role: 'Implantologist',
    mobileNumber: '+919800000001',
  },
  {
    id: 'tm-prosthodontist',
    name: 'Dr. Priya Prostho',
    role: 'Prosthodontist',
    mobileNumber: '+919800000002',
  },
  {
    id: 'tm-assistant',
    name: 'Anita Assistant',
    role: 'Assistant',
    mobileNumber: '+919800000003',
  },
  {
    id: 'tm-periodontist',
    name: 'Dr. Parth Perio',
    role: 'Periodontist',
    mobileNumber: '+919800000004',
  },
];

export const CLINIC = {
  id: 'clinic-001',
  name: 'Seamless Dental Studio',
  address: '12 Clinical Street, Bengaluru 560001',
  ownerId: CLINICIAN.id,
  createdAt: '2026-03-21T09:00:00.000Z',
  updatedAt: '2026-03-21T09:00:00.000Z',
};

export const WORKFLOW_ASSIGNMENTS: WorkflowAssignment[] = [
  { stage: 'DIAGNOSIS', userId: CLINICIAN.id },
  { stage: 'IMPLANT_PLANNING', userId: 'tm-implantologist' },
  { stage: 'SURGERY', userId: 'tm-implantologist' },
  { stage: 'PROSTHETIC_DESIGN', userId: 'tm-prosthodontist' },
  { stage: 'ASSISTANT_SUPPORT', userId: 'tm-assistant' },
];

export const CASES: CaseRecord[] = [
  {
    id: 'case-001',
    caseName: 'Implant 46 - Ramesh Kumar',
    caseTitle: 'Implant 46 - Ramesh Kumar',
    patientName: 'Ramesh Kumar',
    toothNumber: '46',
    status: 'planning',
    createdAt: '2026-03-20T10:00:00.000Z',
    updatedAt: '2026-03-20T10:00:00.000Z',
    clinician: CLINICIAN,
    stageAssignments: WORKFLOW_ASSIGNMENTS.map((assignment) => ({
      stage: assignment.stage,
      user: [CLINICIAN, ...TEAM_MEMBERS].find((member) => member.id === assignment.userId)!,
    })),
    preTreatmentChecklist: [{ label: 'Medical review', completed: true }],
    treatmentChecklist: [{ label: 'Guide approved', completed: false }],
    postTreatmentChecklist: [{ label: 'Follow-up planned', completed: false }],
  },
];

export const OTP = {
  phoneNumber: '+919876543210',
  value: '123456',
};

export const PROFILE_PAYLOAD = {
  name: CLINICIAN.name,
  clinicName: CLINIC.name,
  clinicAddress: CLINIC.address,
};

export const NEW_MEMBER = {
  name: 'Dr. Nisha New',
  role: 'Implantologist' as const,
  mobileNumber: '+919811111111',
};

export const CASE_PAYLOAD = {
  patientName: 'Asha Verma',
  caseTitle: 'Maxillary implant - 11',
  toothNumber: '11',
  optionalAge: 44,
  optionalSex: 'female',
  stageAssignments: WORKFLOW_ASSIGNMENTS,
};
