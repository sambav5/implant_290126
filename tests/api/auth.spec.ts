import { expect, test } from '@playwright/test';
import { OTP } from '../fixtures/mock-data';
import { PlaywrightApiClient } from '../helpers/api-client';

test.describe('API regression - authentication', () => {
  test('requests and verifies OTP authentication', async () => {
    const client = await PlaywrightApiClient.create();

    const requestOtp = await client.requestOtp(OTP.phoneNumber);
    expect(requestOtp.status).toBe(200);
    expect(requestOtp.data).toMatchObject({ expiresIn: 300 });

    const verifyOtp = await client.verifyOtp(OTP.phoneNumber, OTP.value);
    expect(verifyOtp.status).toBe(200);
    expect(verifyOtp.data).toMatchObject({ token: expect.any(String) });

    await client.dispose();
  });

  test('rejects invalid OTP submissions', async () => {
    const client = await PlaywrightApiClient.create();
    const result = await client.verifyOtp(OTP.phoneNumber, '000000');
    expect(result.status).toBe(401);
    expect(result.data).toMatchObject({ detail: expect.stringContaining('Invalid OTP') });
    await client.dispose();
  });
});
