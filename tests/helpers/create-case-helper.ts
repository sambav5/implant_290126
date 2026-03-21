import { expect, Page } from '@playwright/test';
import { CASE_PAYLOAD } from '../fixtures/mock-data';
import { PlaywrightApiClient } from './api-client';

export async function createCaseThroughUi(page: Page, overrides: Partial<typeof CASE_PAYLOAD> = {}) {
  const payload = { ...CASE_PAYLOAD, ...overrides };

  await page.goto('/case/new');
  await page.getByLabel('Patient Name *').fill(payload.patientName);
  await page.getByLabel('Case Title *').fill(payload.caseTitle);
  await page.locator('svg text', { hasText: new RegExp(`^${payload.toothNumber}$`) }).first().click();

  if (payload.optionalAge) {
    await page.getByLabel(/Age \(Optional\)/).fill(String(payload.optionalAge));
  }

  await page.getByTestId('create-case-btn').click();
  await expect(page.getByText('Case Summary')).toBeVisible();
  await page.getByTestId('confirm-create-case-btn').click();
}

export async function createCaseViaApi(client: PlaywrightApiClient, overrides: Record<string, unknown> = {}) {
  return client.createCase({ ...CASE_PAYLOAD, ...overrides });
}
