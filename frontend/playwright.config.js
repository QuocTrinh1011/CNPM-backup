import { defineConfig } from '@playwright/test';
import { getE2EDatabaseSettings } from './e2e/database.js';

const database = getE2EDatabaseSettings();
const backendEnv = {
  ...process.env,
  DB_URL: database.jdbcUrl,
  DB_USERNAME: database.username,
  DB_PASSWORD: database.password,
  JWT_SECRET: 'playwright-e2e-only-secret-at-least-32-bytes',
  SERVER_PORT: '8082',
  SPRING_JPA_HIBERNATE_DDL_AUTO: 'create-drop',
  CORS_ORIGINS: 'http://localhost:5173,http://localhost:5175',
  SECURE_REFRESH_COOKIE: 'false',
};
const frontendEnv = { ...process.env, VITE_API_BASE_URL: 'http://localhost:8082' };
const backendCommand = 'mvn -B -ntp -f ../backend/pom.xml spring-boot:run';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.js',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: backendCommand,
      url: 'http://localhost:8082/api/auth/password-recovery',
      env: backendEnv,
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
      command: 'npm run dev:manager',
      url: 'http://localhost:5175',
      env: frontendEnv,
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
