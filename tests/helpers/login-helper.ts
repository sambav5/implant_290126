import { expect, Page } from '@playwright/test';
import { OTP } from '../fixtures/mock-data';
import { createMockAppState, installMockRoutes, seedAuthenticatedSession, type MockAppState } from '../fixtures/mock-routes';

type LoginOptions = {
  onboardingStage?: 'PROFILE' | 'TEAM' | 'COMPLETED';
  phoneNumber?: string;
  otp?: string;
  autoSeedSession?: boolean;
};

export async function prepareMockedPage(page: Page, options: LoginOptions = {}) {
  const state = createMockAppState({ onboardingStage: options.onboardingStage });
  await installMockRoutes(page, state);
  if (options.autoSeedSession) {
    await seedAuthenticatedSession(page, options.onboardingStage || 'COMPLETED');
  }
  return state;
}

export async function loginViaOtp(page: Page, options: LoginOptions = {}): Promise<MockAppState> {
  const phoneNumber = options.phoneNumber || OTP.phoneNumber.replace('+91', '');
  const otp = options.otp || OTP.value;
  const state = await prepareMockedPage(page, { onboardingStage: options.onboardingStage || 'PROFILE' });

  await page.goto('/login');
  await page.getByLabel('Phone Number').fill(phoneNumber);
  await page.getByRole('button', { name: /send otp/i }).click();
  await expect(page.getByText(`Enter the 6-digit code sent to ${OTP.phoneNumber}`)).toBeVisible();

  await page.getByRole('textbox').first().click();
  await page.keyboard.type(otp);
  await page.getByRole('button', { name: /verify & login/i }).click();

  return state;
}

export async function seedLoggedInSession(page: Page, onboardingStage: 'PROFILE' | 'TEAM' | 'COMPLETED' = 'COMPLETED') {
  const state = createMockAppState({ onboardingStage });
  await installMockRoutes(page, state);
  await seedAuthenticatedSession(page, onboardingStage);
  return state;
}
