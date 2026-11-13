// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createActiveApiConfig } from './api-config.mjs';
import { proxyApiRequest } from './api-proxy.mjs';
import { createRefreshCookieStore } from './refresh-cookie-store.mjs';

function request({ url = 'app://desktop/api/products', method = 'GET', headers = {}, body = null } = {}) {
  return { url, method, headers: new Headers(headers), body };
}

function setCookieHeaders(...cookies) {
  const headers = new Headers();
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return headers;
}

describe('proxyApiRequest', () => {
  it.each([
    'app://desktop/outside',
    'app://attacker/api/products',
    'not a URL',
    'app://desktop/api/%2e%2e/outside',
  ])('rejects an invalid app request before contacting the backend: %s', async url => {
    const fetchImpl = vi.fn();
    const response = await proxyApiRequest(request({ url }), {
      apiBaseUrl: 'https://api.example.com',
      cookieStore: createRefreshCookieStore(),
      fetchImpl,
    });
    expect(response.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('uses only the configured origin and strips renderer and hop-by-hop headers', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    const forwardedRequest = request({
      url: 'app://desktop/api/products?next=https%3A%2F%2Fevil.example',
      method: 'POST',
      body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('payload')); controller.close(); } }),
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer access-token',
        Connection: 'keep-alive, x-hop-private',
        'Content-Length': '7',
        'Content-Type': 'application/json',
        Host: 'evil.example',
        Origin: 'https://evil.example',
        Referer: 'https://evil.example/page',
        'X-Forwarded-For': '203.0.113.5',
        'X-Hop-Private': 'must-not-forward',
      },
    });

    await proxyApiRequest(forwardedRequest, {
      apiBaseUrl: 'https://api.example.com',
      cookieStore: createRefreshCookieStore(),
      fetchImpl,
    });

    const [target, init] = fetchImpl.mock.calls[0];
    expect(target.href).toBe('https://api.example.com/api/products?next=https%3A%2F%2Fevil.example');
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('manual');
    expect(init.duplex).toBe('half');
    expect(init.headers.get('authorization')).toBe('Bearer access-token');
    expect(init.headers.get('accept')).toBe('application/json');
    expect(init.headers.get('content-type')).toBe('application/json');
    for (const name of ['connection', 'content-length', 'host', 'origin', 'referer', 'x-forwarded-for', 'x-hop-private']) {
      expect(init.headers.has(name)).toBe(false);
    }
  });

  it('forwards only the refresh cookie that matches the auth audience path', async () => {
    const cookieStore = createRefreshCookieStore();
    cookieStore.captureSetCookies('/api/auth/login', setCookieHeaders(
      'refreshToken=customer-memory; HttpOnly; SameSite=Lax; Path=/api/auth',
    ));
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    await proxyApiRequest(request({
      url: 'app://desktop/api/auth/refresh',
      headers: { Cookie: 'refreshToken=customer-browser; adminRefreshToken=wrong-audience' },
    }), { apiBaseUrl: 'https://api.example.com', cookieStore, fetchImpl });
    expect(fetchImpl.mock.calls[0][1].headers.get('cookie')).toBe('refreshToken=customer-browser');

    await proxyApiRequest(request({
      url: 'app://desktop/api/products',
      headers: { Cookie: 'refreshToken=must-not-forward' },
    }), { apiBaseUrl: 'https://api.example.com', cookieStore, fetchImpl });
    expect(fetchImpl.mock.calls[1][1].headers.has('cookie')).toBe(false);
  });

  it('blocks backend redirects without following or returning their location', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { Location: 'https://evil.example/collect' },
    }));
    const response = await proxyApiRequest(request(), {
      apiBaseUrl: 'https://api.example.com',
      cookieStore: createRefreshCookieStore(),
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][1].redirect).toBe('manual');
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ code: 'UPSTREAM_REDIRECT_BLOCKED' });
    expect(response.headers.has('location')).toBe(false);
  });

  it('passes multiple Set-Cookie headers through while rotating and clearing the matching fallback cookie', async () => {
    const cookieStore = createRefreshCookieStore();
    cookieStore.captureSetCookies('/api/auth/login', setCookieHeaders(
      'refreshToken=customer-r1; HttpOnly; SameSite=Lax; Path=/api/auth',
    ));
    const rotatedHeaders = setCookieHeaders(
      'refreshToken=customer-r2; HttpOnly; SameSite=Lax; Path=/api/auth',
      'adminRefreshToken=unrelated; HttpOnly; SameSite=Lax; Path=/api/admin/auth',
    );
    const clearedHeaders = setCookieHeaders(
      'refreshToken=; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=0',
    );
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200, headers: rotatedHeaders }))
      .mockResolvedValueOnce(new Response(null, { status: 204, headers: clearedHeaders }));

    const rotated = await proxyApiRequest(request({ url: 'app://desktop/api/auth/refresh' }), {
      apiBaseUrl: 'https://api.example.com', cookieStore, fetchImpl,
    });
    expect(fetchImpl.mock.calls[0][1].headers.get('cookie')).toBe('refreshToken=customer-r1');
    expect(cookieStore.cookieForPath('/api/auth/refresh')).toBe('refreshToken=customer-r2');
    expect(rotated.headers.getSetCookie()).toEqual(rotatedHeaders.getSetCookie());

    await proxyApiRequest(request({ url: 'app://desktop/api/auth/logout' }), {
      apiBaseUrl: 'https://api.example.com', cookieStore, fetchImpl,
    });
    expect(cookieStore.cookieForPath('/api/auth/refresh')).toBeNull();
  });

  it('filters hop-by-hop response headers and preserves multiple Set-Cookie values', async () => {
    const responseHeaders = setCookieHeaders(
      'refreshToken=customer-r1; HttpOnly; SameSite=Lax; Path=/api/auth',
      'adminRefreshToken=admin-r1; HttpOnly; SameSite=Lax; Path=/api/admin/auth',
    );
    responseHeaders.set('Connection', 'x-private-hop');
    responseHeaders.set('X-Private-Hop', 'must-not-reach-renderer');
    responseHeaders.set('Transfer-Encoding', 'chunked');
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200, headers: responseHeaders }));
    const response = await proxyApiRequest(request(), {
      apiBaseUrl: 'https://api.example.com',
      cookieStore: createRefreshCookieStore(),
      fetchImpl,
    });
    expect(response.headers.has('connection')).toBe(false);
    expect(response.headers.has('transfer-encoding')).toBe(false);
    expect(response.headers.has('x-private-hop')).toBe(false);
    expect(response.headers.getSetCookie()).toEqual(responseHeaders.getSetCookie());
  });

  it('clears browser and fallback cookies when switching from API origin A to B', async () => {
    const cookieStore = createRefreshCookieStore();
    cookieStore.captureSetCookies('/api/auth/login', setCookieHeaders(
      'refreshToken=origin-a; HttpOnly; SameSite=Lax; Path=/api/auth',
    ));
    let browserCookie = 'refreshToken=origin-a';
    const configStore = {
      load: async () => ({ apiBaseUrl: 'https://api-a.example.com' }),
      save: async apiBaseUrl => ({ apiBaseUrl }),
    };
    const activeApiConfig = createActiveApiConfig(configStore, {
      clearAuthCookies: async () => {
        cookieStore.clearAll();
        browserCookie = '';
      },
    });
    await activeApiConfig.initialize();
    await activeApiConfig.save('https://api-b.example.com');
    const fetchImpl = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));

    await proxyApiRequest(request({
      url: 'app://desktop/api/auth/refresh',
      headers: { Cookie: browserCookie },
    }), { apiBaseUrl: activeApiConfig.current(), cookieStore, fetchImpl });

    expect(fetchImpl.mock.calls[0][0].origin).toBe('https://api-b.example.com');
    expect(fetchImpl.mock.calls[0][1].headers.has('cookie')).toBe(false);
  });

  it('returns a stable backend-unreachable response', async () => {
    const response = await proxyApiRequest(request(), {
      apiBaseUrl: 'https://api.example.com',
      cookieStore: createRefreshCookieStore(),
      fetchImpl: vi.fn().mockRejectedValue(new TypeError('connection refused')),
    });
    expect(response.status).toBe(502);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({ code: 'BACKEND_UNREACHABLE' });
  });
});
