import { expect, test } from '@playwright/test';
import { OTP } from '../fixtures/mock-data';
import { loginViaOtp, prepareMockedPage } from '../helpers/login-helper';

test.describe('UI regression - login (OTP flow)', () => {
  test('validates phone and OTP inputs and completes OTP login flow', async ({ page }) => {
    await prepareMockedPage(page, { onboardingStage: 'PROFILE' });
    await page.goto('/login');

    await expect(page.getByRole('button', { name: /send otp/i })).toBeDisabled();

    await page.getByLabel('Phone Number').fill('12345');
    await expect(page.getByRole('button', { name: /send otp/i })).toBeDisabled();

    await page.getByLabel('Phone Number').fill(OTP.phoneNumber.replace('+91', ''));
    await expect(page.getByRole('button', { name: /send otp/i })).toBeEnabled();
    await page.getByRole('button', { name: /send otp/i }).click();

    await expect(page.getByRole('button', { name: /verify & login/i })).toBeDisabled();
    await page.getByRole('textbox').first().click();
    await page.keyboard.type('123');
    await expect(page.getByRole('button', { name: /verify & login/i })).toBeDisabled();

    await page.getByRole('button', { name: /change number/i }).click();
    await page.getByLabel('Phone Number').fill(OTP.phoneNumber.replace('+91', ''));
    await page.getByRole('button', { name: /send otp/i }).click();
    await page.getByRole('textbox').first().click();
    await page.keyboard.type(OTP.value);
    await page.getByRole('button', { name: /verify & login/i }).click();

    await expect(page).toHaveURL(/\/setup-profile/);
  });

  test('supports resend and navigation back to phone entry', async ({ page }) => {
    await prepareMockedPage(page, { onboardingStage: 'PROFILE' });
    await page.goto('/login');
    await page.getByLabel('Phone Number').fill(OTP.phoneNumber.replace('+91', ''));
    await page.getByRole('button', { name: /send otp/i }).click();

    await expect(page.getByRole('button', { name: /change number/i })).toBeVisible();
    await page.getByRole('button', { name: /change number/i }).click();
    await expect(page.getByLabel('Phone Number')).toBeVisible();
  });

  test('exposes reusable login helper for downstream specs', async ({ page }) => {
    await loginViaOtp(page, { onboardingStage: 'PROFILE' });
    await expect(page).toHaveURL(/\/setup-profile/);
  });
});
