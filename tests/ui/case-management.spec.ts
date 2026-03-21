import { expect, test } from '@playwright/test';
import { seedLoggedInSession } from '../helpers/login-helper';
import { expectNoHorizontalOverflow } from '../utils/layout';

test.describe('UI regression - case creation and team selection', () => {
  test('validates required fields and populates workflow dropdowns including clinician option', async ({ page }) => {
    await seedLoggedInSession(page, 'COMPLETED');
    await page.goto('/case/new');

    await expect(page.getByTestId('create-case-btn')).toBeDisabled();

    await page.getByLabel('Patient Name *').fill('Asha Verma');
    await page.getByLabel('Case Title *').fill('Implant 11');
    await page.locator('svg text', { hasText: /^11$/ }).first().click();
    await expect(page.getByTestId('create-case-btn')).toBeEnabled();

    await page.getByRole('combobox').nth(1).click();
    await expect(page.getByRole('option', { name: /Dr\. Maya Clinician • Clinician/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /Dr\. Ishaan Implant • Implantologist/i })).toBeVisible();
  });

  test('persists selected team assignments after case creation and supports editing them later', async ({ page }) => {
    await seedLoggedInSession(page, 'COMPLETED');
    await page.goto('/case/new');

    await page.getByLabel('Patient Name *').fill('Asha Verma');
    await page.getByLabel('Case Title *').fill('Maxillary implant - 11');
    await page.locator('svg text', { hasText: /^11$/ }).first().click();

    const workflowComboboxes = page.getByTestId('case-workflow-assignment').getByRole('combobox');
    await workflowComboboxes.nth(0).click();
    await page.getByRole('option', { name: /Dr\. Maya Clinician • Clinician/i }).click();
    await workflowComboboxes.nth(1).click();
    await page.getByRole('option', { name: /Dr\. Ishaan Implant • Implantologist/i }).click();
    await workflowComboboxes.nth(2).click();
    await page.getByRole('option', { name: /Dr\. Ishaan Implant • Implantologist/i }).click();
    await workflowComboboxes.nth(3).click();
    await page.getByRole('option', { name: /Dr\. Priya Prostho • Prosthodontist/i }).click();
    await workflowComboboxes.nth(4).click();
    await page.getByRole('option', { name: /Anita Assistant • Assistant/i }).click();

    await page.getByTestId('create-case-btn').click();
    await expect(page.getByText('Diagnosis Review')).toBeVisible();
    await expect(page.getByText('Dr. Maya Clinician • Clinician')).toBeVisible();
    await expect(page.getByText('Dr. Priya Prostho • Prosthodontist')).toBeVisible();

    await page.getByTestId('confirm-create-case-btn').click();
    await expect(page).toHaveURL(/\/case\/case-2/);
    await expect(page.getByText('Dr. Maya Clinician')).toBeVisible();
    await expect(page.getByText('Dr. Ishaan Implant')).toBeVisible();
    await expect(page.getByText('Dr. Priya Prostho')).toBeVisible();

    await page.getByRole('button', { name: /edit team/i }).click();
    await page.getByRole('combobox').nth(4).click();
    await page.getByRole('option', { name: /Dr\. Parth Perio • Periodontist/i }).click();
    await page.getByRole('button', { name: /save changes/i }).click();

    await expect(page.getByText('Team updated successfully')).toBeVisible();
    await expect(page.getByText('Dr. Parth Perio')).toBeVisible();
  });

  test('keeps case screens stable while scrolling on mobile layouts', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await seedLoggedInSession(page, 'COMPLETED');
    await page.goto('/case/new');

    await page.mouse.wheel(0, 1800);
    await expectNoHorizontalOverflow(page);
  });
});
