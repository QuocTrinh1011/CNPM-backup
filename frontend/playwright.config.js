import { defineConfig } from '@playwright/test';
import { getE2EDatabaseSettings } from './e2e/database.js';

getE2EDatabaseSettings();
process.env.E2E_RUN_ID ||= `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const frontendEnv = { ...process.env, VITE_API_BASE_URL: 'http://localhost:8082' };
const backendCommand = 'node e2e/start-backend.js';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.js',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Role workflows share disposable inventory and employee fixtures.
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: [
    {
      command: backendCommand,
      url: 'http://localhost:8082/api/auth/password-recovery',
      timeout: 240_000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev:user',
      url: 'http://localhost:5173',
      env: frontendEnv,
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev:admin',
      url: 'http://localhost:5174',
      env: frontendEnv,
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev:manager',
      url: 'http://localhost:5175',
      env: frontendEnv,
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
