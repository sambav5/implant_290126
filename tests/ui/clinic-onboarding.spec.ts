import { expect, test } from '@playwright/test';
import { PROFILE_PAYLOAD } from '../fixtures/mock-data';
import { seedLoggedInSession } from '../helpers/login-helper';
import { expectNoHorizontalOverflow } from '../utils/layout';

test.describe('UI regression - clinic onboarding', () => {
  test('validates setup profile form and advances clinic onboarding', async ({ page }) => {
    await seedLoggedInSession(page, 'PROFILE');
    await page.goto('/setup-profile');

    await page.getByRole('button', { name: /continue to team setup/i }).click();
    await expect(page.getByText('Name must be at least 2 characters')).toBeVisible();
    await expect(page.getByText('Clinic name must be at least 2 characters')).toBeVisible();
    await expect(page.getByText('Address must be at least 5 characters')).toBeVisible();

    await page.getByLabel('Full Name *').fill(PROFILE_PAYLOAD.name);
    await page.getByLabel('Clinic Name *').fill(PROFILE_PAYLOAD.clinicName);
    await page.getByLabel('Clinic Address *').fill(PROFILE_PAYLOAD.clinicAddress);
    await page.getByRole('button', { name: /continue to team setup/i }).click();

    await expect(page).toHaveURL(/\/setup-team/);
  });

  test('maintains layout stability without horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedLoggedInSession(page, 'PROFILE');
    await page.goto('/setup-profile');

    await page.getByLabel('Full Name *').fill('Dr. A');
    await page.getByLabel('Clinic Name *').fill('A');
    await page.getByLabel('Clinic Address *').fill('12');
    await expectNoHorizontalOverflow(page);
  });
});
