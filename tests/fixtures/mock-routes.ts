import { Page, Route } from '@playwright/test';
import {
  AUTH_SESSION,
  CASE_PAYLOAD,
  CASES,
  CLINIC,
  CLINICIAN,
  NEW_MEMBER,
  OTP,
  PROFILE_PAYLOAD,
  TEAM_MEMBERS,
  TeamMember,
  WorkflowAssignment,
  type CaseRecord,
  type OnboardingStage,
} from './mock-data';

type MockStateOptions = {
  onboardingStage?: OnboardingStage;
  teamMembers?: TeamMember[];
  cases?: CaseRecord[];
};

export type MockAppState = ReturnType<typeof createMockAppState>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const toWorkflowResponse = (stageAssignments: WorkflowAssignment[], teamMembers: TeamMember[]) =>
  stageAssignments.map((assignment) => ({
    stage: assignment.stage,
    user: [CLINICIAN, ...teamMembers].find((member) => member.id === assignment.userId) || CLINICIAN,
  }));

export function createMockAppState(options: MockStateOptions = {}) {
  const onboardingStage = options.onboardingStage || AUTH_SESSION.onboardingStage;
  const teamMembers = clone(options.teamMembers || TEAM_MEMBERS);
  const clinic = clone(CLINIC);
  const userProfile = {
    id: CLINICIAN.id,
    mobileNumber: CLINICIAN.mobileNumber,
    name: CLINICIAN.name,
    role: CLINICIAN.role,
    clinicName: clinic.name,
    clinicAddress: clinic.address,
    onboardingStage,
  };
  const authSession = { ...AUTH_SESSION, onboardingStage };
  const cases = clone(options.cases || CASES);

  return {
    otp: clone(OTP),
    clinic,
    authSession,
    userProfile,
    teamMembers,
    cases,
  };
}

export async function installMockRoutes(page: Page, state: MockAppState) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    const method = request.method();

    if (pathname.endsWith('/api/auth/whatsapp/request-otp') && method === 'POST') {
      return json(route, 200, { message: 'OTP sent successfully to your WhatsApp', expiresIn: 300 });
    }

    if (pathname.endsWith('/api/auth/whatsapp/verify-otp') && method === 'POST') {
      const payload = request.postDataJSON() as { phoneNumber: string; otp: string };
      if (payload.phoneNumber !== state.otp.phoneNumber || payload.otp !== state.otp.value) {
        return json(route, 401, { detail: 'Invalid OTP. 4 attempts remaining.' });
      }
      return json(route, 200, state.authSession);
    }

    if (pathname.endsWith('/api/user/me') && method === 'GET') {
      return json(route, 200, state.userProfile);
    }

    if (pathname.endsWith('/api/user/profile') && method === 'POST') {
      const payload = request.postDataJSON() as typeof PROFILE_PAYLOAD;
      state.userProfile = {
        ...state.userProfile,
        name: payload.name,
        clinicName: payload.clinicName,
        clinicAddress: payload.clinicAddress,
        onboardingStage: 'TEAM',
      };
      state.clinic = {
        ...state.clinic,
        name: payload.clinicName,
        address: payload.clinicAddress,
        updatedAt: new Date().toISOString(),
      };
      state.authSession.onboardingStage = 'TEAM';
      return json(route, 200, { message: 'Profile updated successfully', onboardingStage: 'TEAM' });
    }

    if (pathname.endsWith('/api/user/skip-team') && method === 'POST') {
      state.userProfile.onboardingStage = 'COMPLETED';
      state.authSession.onboardingStage = 'COMPLETED';
      return json(route, 200, { message: 'Onboarding completed successfully', onboardingStage: 'COMPLETED' });
    }

    if (pathname.endsWith('/api/clinic') && method === 'GET') {
      return json(route, 200, state.clinic);
    }

    if (pathname.endsWith('/api/clinic') && method === 'PUT') {
      const payload = request.postDataJSON() as { name: string; address: string };
      state.clinic = { ...state.clinic, ...payload, updatedAt: new Date().toISOString() };
      return json(route, 200, state.clinic);
    }

    if (pathname.endsWith('/api/team') && method === 'GET') {
      return json(route, 200, state.teamMembers);
    }

    if (pathname.endsWith('/api/team/member') && method === 'POST') {
      const payload = request.postDataJSON() as Omit<TeamMember, 'id'>;
      const newMember: TeamMember = { id: `tm-${state.teamMembers.length + 1}`, ...payload };
      state.teamMembers.push(newMember);
      state.userProfile.onboardingStage = 'COMPLETED';
      state.authSession.onboardingStage = 'COMPLETED';
      return json(route, 201, { ...newMember, createdAt: new Date().toISOString() });
    }

    const updateMemberMatch = pathname.match(/\/api\/team\/member\/([^/]+)$/);
    if (updateMemberMatch && method === 'PUT') {
      const memberId = updateMemberMatch[1];
      const payload = request.postDataJSON() as Omit<TeamMember, 'id'>;
      state.teamMembers = state.teamMembers.map((member) =>
        member.id === memberId ? { ...member, ...payload } : member,
      );
      const updatedMember = state.teamMembers.find((member) => member.id === memberId) || { id: memberId, ...payload };
      return json(route, 200, { ...updatedMember, createdAt: new Date().toISOString() });
    }

    if (updateMemberMatch && method === 'DELETE') {
      const memberId = updateMemberMatch[1];
      state.teamMembers = state.teamMembers.filter((member) => member.id !== memberId);
      return json(route, 204, {});
    }

    if (pathname.endsWith('/api/cases/my') && method === 'GET') {
      return json(route, 200, { cases: state.cases });
    }

    if (pathname.endsWith('/api/cases') && method === 'POST') {
      const payload = request.postDataJSON() as typeof CASE_PAYLOAD;
      const newCase: CaseRecord = {
        id: `case-${state.cases.length + 1}`,
        caseName: payload.caseTitle,
        caseTitle: payload.caseTitle,
        patientName: payload.patientName,
        toothNumber: payload.toothNumber,
        status: 'planning',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clinician: CLINICIAN,
        stageAssignments: toWorkflowResponse(payload.stageAssignments, state.teamMembers),
        preTreatmentChecklist: [],
        treatmentChecklist: [],
        postTreatmentChecklist: [],
      };
      state.cases.push(newCase);
      return json(route, 201, newCase);
    }

    const caseByIdMatch = pathname.match(/\/api\/cases\/([^/]+)$/);
    if (caseByIdMatch && method === 'GET') {
      const caseId = caseByIdMatch[1];
      const caseRecord = state.cases.find((item) => item.id === caseId);
      return caseRecord ? json(route, 200, caseRecord) : json(route, 404, { detail: 'Case not found' });
    }

    const updateWorkflowMatch = pathname.match(/\/api\/cases\/([^/]+)\/stage-assignments$/);
    if (updateWorkflowMatch && method === 'PUT') {
      const caseId = updateWorkflowMatch[1];
      const payload = request.postDataJSON() as { stageAssignments: WorkflowAssignment[] };
      const caseRecord = state.cases.find((item) => item.id === caseId);
      if (!caseRecord) {
        return json(route, 404, { detail: 'Case not found' });
      }
      caseRecord.stageAssignments = toWorkflowResponse(payload.stageAssignments, state.teamMembers);
      caseRecord.updatedAt = new Date().toISOString();
      return json(route, 200, caseRecord);
    }

    const updateStatusMatch = pathname.match(/\/api\/cases\/([^/]+)\/status$/);
    if (updateStatusMatch && method === 'PUT') {
      const caseId = updateStatusMatch[1];
      const status = url.searchParams.get('status') as CaseRecord['status'];
      const caseRecord = state.cases.find((item) => item.id === caseId);
      if (!caseRecord) {
        return json(route, 404, { detail: 'Case not found' });
      }
      caseRecord.status = status || caseRecord.status;
      caseRecord.updatedAt = new Date().toISOString();
      return json(route, 200, caseRecord);
    }

    if (pathname.includes('/api/cases/') && method === 'DELETE') {
      return json(route, 204, {});
    }

    return route.continue();
  });
}

export async function seedAuthenticatedSession(page: Page, stage: OnboardingStage = 'COMPLETED') {
  const session = { ...AUTH_SESSION, onboardingStage: stage };
  await page.addInitScript(([sessionValue]) => {
    window.localStorage.setItem('clinician_auth_session', JSON.stringify(sessionValue));
    window.localStorage.setItem('session_id', 'playwright-session');
  }, [session]);
}

async function json(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: status === 204 ? '' : JSON.stringify(body),
  });
}

export const DEFAULT_NEW_MEMBER = NEW_MEMBER;
