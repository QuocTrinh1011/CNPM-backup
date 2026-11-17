import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
import { startMockAuthBackend } from './mock-auth-backend.mjs';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appMain = path.join(frontendDir, 'electron', 'main.mjs');
const profileDir = await mkdtemp(path.join(os.tmpdir(), 'anh-lon-desktop-e2e-'));
const backend = await startMockAuthBackend();
const fakePassword = 'test-only-password';

await writeFile(path.join(profileDir, 'desktop-config.json'), `${JSON.stringify({ apiBaseUrl: backend.url })}\n`, { mode: 0o600 });

let app;
try {
  app = await electron.launch({
    args: [appMain],
    env: {
      ...process.env,
      DESKTOP_E2E_USER_DATA: profileDir,
      DESKTOP_E2E_START_ROUTE: '/manager',
    },
  });
  const window = await app.firstWindow();

  await window.getByRole('heading', { name: /Không gian/ }).waitFor();
  assert.equal(new URL(window.url()).pathname, '/manager/login', 'a direct /manager launch must render the Manager portal');
  await window.reload();
  await window.getByRole('heading', { name: /Không gian/ }).waitFor();
  assert.equal(new URL(window.url()).pathname, '/manager/login', 'reloading /manager must stay inside the Manager portal');

  await signIn(window, {
    email: 'manager@example.test',
    button: /ĐĂNG NHẬP QUẢN LÝ/,
  });
  await window.getByRole('heading', { name: 'Danh sách đơn hàng' }).waitFor();
  assert.equal(new URL(window.url()).pathname, '/manager/orders', 'Sales login must land on the order list');
  await verifyAuthLifecycle(window, backend, 'manager', '/api/manager/auth');

  await selectPortal(app, window, 'Quản trị', '/admin');
  await window.getByRole('heading', { name: 'Admin hệ thống' }).waitFor();
  await signIn(window, {
    email: 'admin@example.test',
    button: 'Đăng nhập Admin',
  });
  await window.getByText('System Admin', { exact: true }).waitFor();
  await verifyAuthLifecycle(window, backend, 'admin', '/api/admin/auth');

  await selectPortal(app, window, 'Khách hàng', '/');
  await window.goto('app://desktop/dang-nhap');
  await window.getByRole('heading', { name: 'Chào mừng trở lại.' }).waitFor();
  await signIn(window, {
    email: 'customer@example.test',
    button: /Đăng nhập/i,
  });
  await window.getByText('Chào mừng E2E Customer!').waitFor();
  await verifyAuthLifecycle(window, backend, 'customer', '/api/auth');

  await selectPortal(app, window, 'Quản lý', '/manager');
  await window.getByRole('heading', { name: /Không gian/ }).waitFor();
  backend.setUnavailable(true);
  await window.reload();
  await window.getByRole('heading', { name: 'Không kết nối được máy chủ' }).waitFor();

  await window.getByRole('button', { name: 'Thử lại' }).click();
  await window.getByRole('heading', { name: 'Không kết nối được máy chủ' }).waitFor();
  await window.getByRole('button', { name: 'Đổi địa chỉ máy chủ' }).click();
  await window.getByRole('heading', { name: 'Kết nối máy chủ CRM' }).waitFor();
  const apiOrigin = window.getByLabel('Địa chỉ API');
  await apiOrigin.fill('http://192.0.2.10');
  await window.getByRole('button', { name: 'Lưu và kết nối' }).click();
  await window.getByRole('alert').getByText('Máy chủ bên ngoài máy này phải sử dụng HTTPS.').waitFor();

  backend.setUnavailable(false);
  await apiOrigin.fill(backend.url);
  await window.getByRole('button', { name: 'Lưu và kết nối' }).click();
  await window.getByRole('heading', { name: /Không gian/ }).waitFor();
  await window.locator('input[type="password"]').waitFor();
  assert.equal(new URL(window.url()).pathname, '/manager/login', 'reconnecting after logout must return to Manager sign-in');

  console.info('Desktop E2E passed: all portal auth flows, direct /manager routing, native menu switching, outage retry, and server reconfiguration.');
} finally {
  backend.setUnavailable(false);
  if (app) await app.close();
  await backend.close();
  await rm(profileDir, { recursive: true, force: true });
}

async function signIn(window, { email, button }) {
  await window.locator('input[type="email"]').last().fill(email);
  await window.locator('input[type="password"]').last().fill(fakePassword);
  await window.locator('form').last().getByRole('button', { name: button }).click();
}

async function selectPortal(app, window, label, route) {
  const activated = await app.evaluate(({ BrowserWindow, Menu }, targetLabel) => {
    const menuItem = Menu.getApplicationMenu()?.items
      .flatMap(item => item.submenu?.items || [])
      .find(item => item.label === targetLabel);
    if (!menuItem?.click) return false;
    menuItem.click(menuItem, BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0], null);
    return true;
  }, label);
  assert.equal(activated, true, `native menu must contain ${label}`);
  await window.waitForFunction(expected => window.location.pathname === expected, route);
}

async function verifyAuthLifecycle(window, backend, audience, prefix) {
  assert.ok(backend.requests.some(request => request.audience === audience && request.action === 'login'), `${audience} login must reach the mock API`);
  const actionOffset = backend.requests.filter(request => request.audience === audience).length;
  const refreshPath = `${prefix}/refresh`;
  const logoutPath = `${prefix}/logout`;
  const statuses = await window.evaluate(async ({ refreshPath, logoutPath }) => {
    const refresh = async () => {
      const response = await fetch(refreshPath, { method: 'POST' });
      return response.status;
    };
    const firstRefresh = await refresh();
    const logoutResponse = await fetch(logoutPath, { method: 'POST' });
    const afterLogout = await refresh();
    return { firstRefresh, logout: logoutResponse.status, afterLogout, visibleCookies: document.cookie };
  }, { refreshPath, logoutPath });

  assert.deepEqual(statuses, { firstRefresh: 200, logout: 204, afterLogout: 401, visibleCookies: '' }, `${audience} refresh cookies must stay HttpOnly and be cleared at logout`);
  const authRequests = backend.requests
    .filter(request => request.audience === audience)
    .slice(actionOffset);
  assert.deepEqual(authRequests.map(request => request.action), ['refresh', 'logout', 'refresh']);
  assert.match(authRequests[0].cookie, new RegExp(`${audience === 'customer' ? 'refreshToken' : audience === 'admin' ? 'adminRefreshToken' : 'managerRefreshToken'}=${audience}-r1`));
  assert.match(authRequests[1].cookie, new RegExp(`${audience === 'customer' ? 'refreshToken' : audience === 'admin' ? 'adminRefreshToken' : 'managerRefreshToken'}=${audience}-r2`));
  assert.equal(authRequests[2].cookie, '', `${audience} must not send the cleared refresh cookie again`);
}
