import { APIRequestContext, expect, request as playwrightRequest } from '@playwright/test';
import {
  AUTH_SESSION,
  CASE_PAYLOAD,
  CASES,
  CLINIC,
  CLINICIAN,
  OTP,
  PROFILE_PAYLOAD,
  TEAM_MEMBERS,
  type TeamMember,
  type WorkflowAssignment,
} from '../fixtures/mock-data';

type ClientOptions = {
  baseURL?: string;
  useMocks?: boolean;
};

type MockStore = {
  authSession: typeof AUTH_SESSION;
  clinic: typeof CLINIC;
  profile: {
    id: string;
    mobileNumber?: string;
    name: string;
    role: string;
    clinicName: string;
    clinicAddress: string;
    onboardingStage: 'PROFILE' | 'TEAM' | 'COMPLETED';
  };
  teamMembers: TeamMember[];
  cases: typeof CASES;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export class PlaywrightApiClient {
  private readonly useMocks: boolean;
  private readonly baseURL: string;
  private requestContext?: APIRequestContext;
  private store: MockStore;

  constructor(requestContext: APIRequestContext | undefined, options: ClientOptions = {}) {
    this.requestContext = requestContext;
    this.baseURL = options.baseURL || process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:8001/api';
    this.useMocks = options.useMocks ?? process.env.PLAYWRIGHT_USE_MOCKS !== 'false';
    this.store = {
      authSession: clone(AUTH_SESSION),
      clinic: clone(CLINIC),
      profile: {
        id: CLINICIAN.id,
        mobileNumber: CLINICIAN.mobileNumber,
        name: CLINICIAN.name,
        role: CLINICIAN.role,
        clinicName: CLINIC.name,
        clinicAddress: CLINIC.address,
        onboardingStage: 'PROFILE',
      },
      teamMembers: clone(TEAM_MEMBERS),
      cases: clone(CASES),
    };
  }

  static async create(options: ClientOptions = {}) {
    const useMocks = options.useMocks ?? process.env.PLAYWRIGHT_USE_MOCKS !== 'false';
    if (useMocks) {
      return new PlaywrightApiClient(undefined, { ...options, useMocks: true });
    }

    const requestContext = await playwrightRequest.newContext({
      baseURL: options.baseURL || process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:8001/api',
      extraHTTPHeaders: {
        Authorization: `Bearer ${AUTH_SESSION.token}`,
      },
    });

    return new PlaywrightApiClient(requestContext, { ...options, useMocks: false });
  }

  async dispose() {
    await this.requestContext?.dispose();
  }

  async requestOtp(phoneNumber = OTP.phoneNumber) {
    if (this.useMocks) {
      return response(200, { message: 'OTP sent successfully to your WhatsApp', expiresIn: 300, phoneNumber });
    }
    const result = await this.requestContext!.post(`${this.baseURL}/auth/whatsapp/request-otp`, { data: { phoneNumber } });
    return response(result.status(), await result.json());
  }

  async verifyOtp(phoneNumber = OTP.phoneNumber, otp = OTP.value) {
    if (this.useMocks) {
      const ok = phoneNumber === OTP.phoneNumber && otp === OTP.value;
      return ok
        ? response(200, { ...this.store.authSession, onboardingStage: this.store.profile.onboardingStage })
        : response(401, { detail: 'Invalid OTP. 4 attempts remaining.' });
    }
    const result = await this.requestContext!.post(`${this.baseURL}/auth/whatsapp/verify-otp`, { data: { phoneNumber, otp } });
    return response(result.status(), await result.json());
  }

  async setupProfile(payload = PROFILE_PAYLOAD) {
    if (this.useMocks) {
      this.store.profile = {
        ...this.store.profile,
        name: payload.name,
        clinicName: payload.clinicName,
        clinicAddress: payload.clinicAddress,
        onboardingStage: 'TEAM',
      };
      this.store.authSession.onboardingStage = 'TEAM';
      this.store.clinic = { ...this.store.clinic, name: payload.clinicName, address: payload.clinicAddress };
      return response(200, { message: 'Profile updated successfully', onboardingStage: 'TEAM' });
    }
    const result = await this.requestContext!.post(`${this.baseURL}/user/profile`, { data: payload });
    return response(result.status(), await result.json());
  }

  async getTeam() {
    if (this.useMocks) {
      return response(200, clone(this.store.teamMembers));
    }
    const result = await this.requestContext!.get(`${this.baseURL}/team`);
    return response(result.status(), await result.json());
  }

  async addTeamMember(payload: Omit<TeamMember, 'id'>) {
    if (this.useMocks) {
      const member = { id: `tm-${this.store.teamMembers.length + 1}`, ...payload };
      this.store.teamMembers.push(member);
      this.store.profile.onboardingStage = 'COMPLETED';
      this.store.authSession.onboardingStage = 'COMPLETED';
      return response(201, member);
    }
    const result = await this.requestContext!.post(`${this.baseURL}/team/member`, { data: payload });
    return response(result.status(), await result.json());
  }

  async updateTeamMember(id: string, payload: Omit<TeamMember, 'id'>) {
    if (this.useMocks) {
      this.store.teamMembers = this.store.teamMembers.map((member) => (member.id === id ? { ...member, ...payload } : member));
      return response(200, this.store.teamMembers.find((member) => member.id === id));
    }
    const result = await this.requestContext!.put(`${this.baseURL}/team/member/${id}`, { data: payload });
    return response(result.status(), await result.json());
  }

  async createCase(payload: typeof CASE_PAYLOAD) {
    if (this.useMocks) {
      const stageAssignments = (payload.stageAssignments || []).map((assignment: WorkflowAssignment) => ({
        stage: assignment.stage,
        user: [CLINICIAN, ...this.store.teamMembers].find((member) => member.id === assignment.userId) || CLINICIAN,
      }));
      const createdCase = {
        id: `case-${this.store.cases.length + 1}`,
        caseName: payload.caseTitle,
        caseTitle: payload.caseTitle,
        patientName: payload.patientName,
        toothNumber: payload.toothNumber,
        status: 'planning',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clinician: CLINICIAN,
        stageAssignments,
        preTreatmentChecklist: [],
        treatmentChecklist: [],
        postTreatmentChecklist: [],
      };
      this.store.cases.push(createdCase);
      return response(201, createdCase);
    }
    const result = await this.requestContext!.post(`${this.baseURL}/cases`, { data: payload });
    return response(result.status(), await result.json());
  }

  async updateCaseTeam(caseId: string, stageAssignments: WorkflowAssignment[]) {
    if (this.useMocks) {
      const targetCase = this.store.cases.find((item) => item.id === caseId);
      if (!targetCase) {
        return response(404, { detail: 'Case not found' });
      }
      targetCase.stageAssignments = stageAssignments.map((assignment) => ({
        stage: assignment.stage,
        user: [CLINICIAN, ...this.store.teamMembers].find((member) => member.id === assignment.userId) || CLINICIAN,
      }));
      return response(200, targetCase);
    }
    const result = await this.requestContext!.put(`${this.baseURL}/cases/${caseId}/stage-assignments`, { data: { stageAssignments } });
    return response(result.status(), await result.json());
  }

  async getCases() {
    if (this.useMocks) {
      return response(200, { cases: clone(this.store.cases) });
    }
    const result = await this.requestContext!.get(`${this.baseURL}/cases/my`);
    return response(result.status(), await result.json());
  }
}

function response(status: number, data: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    data,
  };
}

export async function expectOk(result: { ok: boolean; status: number; data: unknown }) {
  expect(result.ok, `Expected request to succeed, received status ${result.status}`).toBeTruthy();
}
