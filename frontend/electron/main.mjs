import squirrelStartupEvent from 'electron-squirrel-startup';
import { app, BrowserWindow, ipcMain, Menu, net, protocol, session, shell } from 'electron';
import { existsSync, statSync } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { proxyApiRequest } from './api-proxy.mjs';
import { createActiveApiConfig } from './api-config.mjs';
import { registerDesktopConfigIpc } from './config-ipc.mjs';
import { createConfigStore } from './config-store.mjs';
import { installNavigationGuards } from './external-links.mjs';
import { classifyAppRequest, resolveDistPath, withDesktopContentSecurityPolicy } from './protocol-router.mjs';
import { createRefreshCookieStore } from './refresh-cookie-store.mjs';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const appUserModelId = 'com.squirrel.AnhLonShopDesktop.AnhLonShop';
const frontendDir = path.resolve(currentDir, '..');
const distRoot = path.resolve(frontendDir, 'dist');
const testFixture = process.argv.includes('--desktop-test-fixture');
const testUserData = process.env.DESKTOP_E2E_USER_DATA;
const testStartRoute = process.env.DESKTOP_E2E_START_ROUTE;
if (testUserData) app.setPath('userData', testUserData);

protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);

const cookieStore = createRefreshCookieStore();
const authCookieObservations = [];
let desktopSession = null;
const configStore = createConfigStore(path.join(app.getPath('userData'), 'desktop-config.json'));
const apiConfig = createActiveApiConfig(configStore, {
  clearAuthCookies: async () => {
    cookieStore.clearAll();
    if (desktopSession) await desktopSession.clearStorageData({ storages: ['cookies'] });
  },
});

function desktopAssetExists(pathname) {
  if (testFixture) return pathname === '/index.html' || pathname === '/test/auth-fixture.js';
  const filePath = resolveDistPath(distRoot, pathname);
  if (!filePath || !existsSync(filePath)) return false;
  try { return statSync(filePath).isFile(); } catch { return false; }
}

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ttf', 'font/ttf'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

async function readAsset(pathname) {
  const filePath = testFixture && pathname === '/index.html'
    ? path.join(currentDir, 'test', 'auth-fixture.html')
    : testFixture && pathname === '/test/auth-fixture.js'
      ? path.join(currentDir, 'test', 'auth-fixture.js')
      : resolveDistPath(distRoot, pathname);
  if (!filePath) return new Response('Not found', { status: 404 });
  try {
    const body = await readFileAsync(filePath);
    const contentType = contentTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
    return new Response(body, { headers: { 'Content-Type': contentType } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

async function appProtocolResponse(request) {
  const classification = classifyAppRequest(request.url, desktopAssetExists);
  if (classification.kind === 'reject') return withDesktopContentSecurityPolicy(new Response('Not found', { status: 404 }));
  const url = new URL(request.url);
  if (testFixture && url.pathname === '/__test/observations') {
    return withDesktopContentSecurityPolicy(Response.json(authCookieObservations));
  }
  if (classification.kind === 'api') {
    if (testFixture && url.pathname.endsWith('/refresh')) {
      authCookieObservations.push({ pathname: url.pathname, browserCookiePresent: Boolean(request.headers.get('cookie')) });
    }
    const apiBaseUrl = testFixture ? process.env.DESKTOP_E2E_API_URL : apiConfig.current();
    if (!apiBaseUrl) {
      return withDesktopContentSecurityPolicy(Response.json({ code: 'DESKTOP_CONFIG_REQUIRED' }, { status: 503 }));
    }
    const response = await proxyApiRequest(request, { apiBaseUrl, cookieStore, fetchImpl: net.fetch });
    return withDesktopContentSecurityPolicy(response);
  }
  const response = await readAsset(classification.path);
  return withDesktopContentSecurityPolicy(response);
}

function createWindow() {
  if (process.platform === 'win32') app.setAppUserModelId(appUserModelId);
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      partition: 'desktop-session',
      preload: path.join(currentDir, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  installNavigationGuards(window.webContents, shell);
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
  const initialRoute = ['/admin', '/manager'].includes(testStartRoute) ? testStartRoute : '/';
  void window.loadURL(`app://desktop${initialRoute}`);
  return window;
}

if (!squirrelStartupEvent) {
  app.whenReady().then(async () => {
    desktopSession = session.fromPartition('desktop-session');
    await desktopSession.protocol.handle('app', appProtocolResponse);
    await apiConfig.initialize();
    registerDesktopConfigIpc(ipcMain, {
      apiConfig,
      onSaved: event => BrowserWindow.fromWebContents(event.sender)?.webContents.reload(),
    });
    createWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
