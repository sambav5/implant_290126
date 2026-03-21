import { expect, test } from '@playwright/test';
import { DEFAULT_NEW_MEMBER } from '../fixtures/mock-routes';
import { seedLoggedInSession } from '../helpers/login-helper';
import { expectNoHorizontalOverflow } from '../utils/layout';

test.describe('UI regression - team management', () => {
  test('loads team members and supports add, edit, and delete flows', async ({ page }) => {
    const state = await seedLoggedInSession(page, 'COMPLETED');
    await page.goto('/team');

    await expect(page.getByText('Team Members (4)')).toBeVisible();
    await expect(page.getByText('Dr. Ishaan Implant')).toBeVisible();

    await page.getByRole('button', { name: /add team member/i }).click();
    const addDialog = page.getByRole('dialog');
    await addDialog.getByLabel('Name *').fill(DEFAULT_NEW_MEMBER.name);
    await addDialog.getByLabel('Mobile Number *').fill(DEFAULT_NEW_MEMBER.mobileNumber);
    await addDialog.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Implantologist' }).click();
    await addDialog.getByRole('button', { name: /add member/i }).click();

    await expect(page.getByText(DEFAULT_NEW_MEMBER.name)).toBeVisible();
    expect(state.teamMembers.length).toBe(5);

    await page.locator('tbody tr', { hasText: 'Dr. Ishaan Implant' }).getByRole('button').first().click();
    const editDialog = page.getByRole('dialog');
    await editDialog.getByLabel('Name *').fill('Dr. Ishaan Updated');
    await editDialog.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText('Dr. Ishaan Updated')).toBeVisible();

    await page.locator('tbody tr', { hasText: 'Anita Assistant' }).getByRole('button').nth(1).click();
    await page.getByRole('button', { name: /remove/i }).click();
    await expect(page.getByText('Anita Assistant')).toHaveCount(0);
  });

  test('remains scroll-safe on narrow screens', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await seedLoggedInSession(page, 'COMPLETED');
    await page.goto('/team');
    await expectNoHorizontalOverflow(page);
  });
});
