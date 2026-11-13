import { app, BrowserWindow, Menu, net, protocol, session } from 'electron';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { proxyApiRequest } from './api-proxy.mjs';
import { createRefreshCookieStore } from './refresh-cookie-store.mjs';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(currentDir, '..');
const testFixture = process.argv.includes('--desktop-test-fixture');
const testUserData = process.env.DESKTOP_E2E_USER_DATA;
if (testUserData) app.setPath('userData', testUserData);

protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);

const cookieStore = createRefreshCookieStore();
const apiBaseUrl = testFixture ? process.env.DESKTOP_E2E_API_URL : 'http://localhost:8080';
const authCookieObservations = [];

function testPage() {
  return readFile(path.join(currentDir, 'test', 'auth-fixture.html'), 'utf8');
}

async function appProtocolResponse(request) {
  const url = new URL(request.url);
  if (url.protocol !== 'app:' || url.hostname !== 'desktop') return new Response('Not found', { status: 404 });
  if (testFixture && url.pathname === '/__test/observations') {
    return Response.json(authCookieObservations);
  }
  if (url.pathname.startsWith('/api/')) {
    if (testFixture && url.pathname.endsWith('/refresh')) {
      authCookieObservations.push({ pathname: url.pathname, browserCookiePresent: Boolean(request.headers.get('cookie')) });
    }
    return proxyApiRequest(request, { apiBaseUrl, cookieStore, fetchImpl: net.fetch });
  }

  if (testFixture) {
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(await testPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    return new Response('Not found', { status: 404 });
  }

  const requestedPath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = path.resolve(frontendDir, 'dist', `.${requestedPath}`);
  const distRoot = path.resolve(frontendDir, 'dist') + path.sep;
  if (!filePath.startsWith(distRoot)) return new Response('Not found', { status: 404 });
  try {
    const body = await readFile(filePath);
    const contentType = filePath.endsWith('.html') ? 'text/html; charset=utf-8' : undefined;
    return new Response(body, { headers: contentType ? { 'Content-Type': contentType } : undefined });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      partition: 'desktop-session',
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  if (!testFixture) {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: 'Cổng',
        submenu: [
          { label: 'Khách hàng', click: () => window.loadURL('app://desktop/') },
          { label: 'Quản trị', click: () => window.loadURL('app://desktop/admin') },
          { label: 'Quản lý', click: () => window.loadURL('app://desktop/manager') },
        ],
      },
    ]));
  }
  void window.loadURL('app://desktop/');
  return window;
}

app.whenReady().then(async () => {
  const desktopSession = session.fromPartition('desktop-session');
  await desktopSession.protocol.handle('app', appProtocolResponse);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
