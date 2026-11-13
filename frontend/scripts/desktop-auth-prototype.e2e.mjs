import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
import { startMockAuthBackend } from './mock-auth-backend.mjs';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appMain = path.join(frontendDir, 'electron', 'main.mjs');
const profileDir = await mkdtemp(path.join(os.tmpdir(), 'anh-lon-desktop-auth-'));
const backend = await startMockAuthBackend();

async function launchApp() {
  return electron.launch({
    args: [appMain, '--desktop-test-fixture'],
    env: {
      ...process.env,
      DESKTOP_E2E_API_URL: backend.url,
      DESKTOP_E2E_USER_DATA: profileDir,
    },
  });
}

let app;
try {
  app = await launchApp();
  const window = await app.firstWindow();
  await window.waitForFunction(() => typeof window.runAuthFlows === 'function');
  const result = await window.evaluate(() => window.runAuthFlows());

  assert.deepEqual(result.flows.map(flow => [flow.name, flow.login.status, flow.refresh.status, flow.logout.status]), [
    ['customer', 200, 200, 204],
    ['admin', 200, 200, 204],
    ['manager', 200, 200, 204],
  ]);
  assert.equal(result.visibleCookies, '', 'HttpOnly refresh cookies must not be visible to renderer JavaScript');
  const cookieObservations = await window.evaluate(async () => (await fetch('/__test/observations')).json());
  const nativeCookieCount = cookieObservations.filter(item => item.browserCookiePresent).length;
  console.info(`app://desktop Chromium cookie handling: ${nativeCookieCount}/${cookieObservations.length} refresh requests carried a browser cookie`);

  for (const audience of ['customer', 'admin', 'manager']) {
    assert.deepEqual(backend.requests.filter(item => item.audience === audience).map(item => item.action), ['login', 'refresh', 'logout']);
    assert.ok(backend.requests.find(item => item.audience === audience && item.action === 'refresh')?.cookie, `${audience} refresh must forward its cookie`);
  }

  await window.evaluate(() => window.loginCustomerOnly());
  await app.close();
  app = await launchApp();
  const freshWindow = await app.firstWindow();
  await freshWindow.waitForFunction(() => typeof window.refreshCustomer === 'function');
  const freshRefresh = await freshWindow.evaluate(() => window.refreshCustomer());
  assert.equal(freshRefresh.status, 401, 'a new app process must not retain refresh cookies');
  assert.equal(backend.requests.at(-1).cookie, '', 'the next process must send no cookie from the prior launch');
} finally {
  if (app) await app.close();
  await backend.close();
  await rm(profileDir, { recursive: true, force: true });
}
