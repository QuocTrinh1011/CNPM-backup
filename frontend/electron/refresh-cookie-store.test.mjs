// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createRefreshCookieStore } from './refresh-cookie-store.mjs';

const headers = (...values) => ({ getSetCookie: () => values });

describe('refresh cookie store', () => {
  it('captures only the cookie whose name and path match the auth audience', () => {
    const store = createRefreshCookieStore();
    store.captureSetCookies('/api/auth/login', headers(
      'refreshToken=customer-r1; HttpOnly; SameSite=Lax; Path=/api/auth',
      'adminRefreshToken=admin-r1; HttpOnly; SameSite=Lax; Path=/api/admin/auth',
    ));

    expect(store.cookieForPath('/api/auth/refresh', '')).toBe('refreshToken=customer-r1');
    expect(store.cookieForPath('/api/admin/auth/refresh', '')).toBeNull();
  });

  it('rotates and clears cookies from multiple Set-Cookie headers', () => {
    const store = createRefreshCookieStore();
    store.captureSetCookies('/api/manager/auth/login', headers(
      'managerRefreshToken=manager-r1; HttpOnly; SameSite=Lax; Path=/api/manager/auth',
      'refreshToken=wrong-scope; HttpOnly; SameSite=Lax; Path=/api/auth',
    ));
    store.captureSetCookies('/api/manager/auth/refresh', headers(
      'managerRefreshToken=manager-r2; HttpOnly; SameSite=Lax; Path=/api/manager/auth',
    ));
    expect(store.cookieForPath('/api/manager/auth/refresh', '')).toBe('managerRefreshToken=manager-r2');

    store.captureSetCookies('/api/manager/auth/logout', headers(
      'managerRefreshToken=; HttpOnly; SameSite=Lax; Path=/api/manager/auth; Max-Age=0',
    ));
    expect(store.cookieForPath('/api/manager/auth/refresh', '')).toBeNull();
  });

  it('keeps fallback cookies only in the current process and accepts the browser cookie for its matching path', () => {
    const firstProcess = createRefreshCookieStore();
    firstProcess.captureSetCookies('/api/auth/login', headers(
      'refreshToken=customer-r1; HttpOnly; SameSite=Lax; Path=/api/auth',
    ));
    expect(firstProcess.cookieForPath('/api/auth/refresh', '')).toBe('refreshToken=customer-r1');
    expect(firstProcess.cookieForPath('/api/auth/refresh', 'refreshToken=browser-r2')).toBe('refreshToken=browser-r2');
    expect(firstProcess.cookieForPath('/api/admin/auth/refresh', 'refreshToken=browser-r2')).toBeNull();

    const nextProcess = createRefreshCookieStore();
    expect(nextProcess.cookieForPath('/api/auth/refresh', '')).toBeNull();
  });
});
