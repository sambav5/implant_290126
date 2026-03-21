import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

dotenv.config();

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
const apiBaseURL = process.env.PLAYWRIGHT_API_BASE_URL || process.env.PLAYWRIGHT_BACKEND_URL || 'http://127.0.0.1:8001/api';
const shouldStartFrontend = process.env.PLAYWRIGHT_START_WEB_SERVER === 'true';
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 2 : 0,
  workers: ci ? 2 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ['list'],
    ['./tests/reporters/execution-summary.ts'],
    ['html', { outputFolder: 'test-results/html-report', open: 'never' }],
  ],
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 1024 },
    ignoreHTTPSErrors: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      testMatch: /tests\/ui\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'api',
      testMatch: /tests\/api\/.*\.spec\.ts/,
      use: {
        baseURL: apiBaseURL,
      },
    },
  ],
  webServer: shouldStartFrontend
    ? {
        command: 'npm --prefix frontend start',
        url: baseURL,
        reuseExistingServer: !ci,
        timeout: 120_000,
      }
    : undefined,
});
