import { expect, test } from '@playwright/test';
import { seedLoggedInSession } from '../helpers/login-helper';
import { expectNoHorizontalOverflow } from '../utils/layout';

test.describe('UI regression - dashboard', () => {
  test('loads dashboard data and supports search filtering', async ({ page }) => {
    await seedLoggedInSession(page, 'COMPLETED');
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /case operations/i })).toBeVisible();
    await expect(page.getByTestId('case-card-case-001')).toBeVisible();

    await page.getByTestId('search-input').fill('Ramesh');
    await expect(page.getByTestId('case-card-case-001')).toBeVisible();

    await page.getByTestId('search-input').fill('No-match');
    await expect(page.getByTestId('case-card-case-001')).toHaveCount(0);
  });

  test('retains layout stability when sidebar behavior changes on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedLoggedInSession(page, 'COMPLETED');
    await page.goto('/');

    await page.getByRole('button', { name: /toggle sidebar/i }).click();
    await expectNoHorizontalOverflow(page);
  });
});
