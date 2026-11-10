import { beforeEach, afterEach, it, expect, vi } from 'vitest';
beforeEach(() => { vi.resetModules(); vi.stubEnv('VITE_API_BASE_URL', ''); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const response = (status, body) => ({ ok: status < 400, status, json: async () => body });
it('uses the configured backend origin for all three portals', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8082/');
  const { api, adminApi } = await import('./api');
  const { adminApi: managerApi } = await import('./manager-api');
  fetch.mockResolvedValue(response(200, []));
  await api('/api/products');
  await adminApi('/api/admin/products');
  await managerApi('/api/manager/products');
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    'http://localhost:8082/api/products',
    'http://localhost:8082/api/admin/products',
    'http://localhost:8082/api/manager/products',
  ]);
});
it('uses port 8080 and preserves structured API errors', async () => {
  const { api, endpoints } = await import('./api');
  expect(endpoints.orders({ page: 2, size: 8, tab: 'TO_PAY', keyword: 'mã áo' })).toBe('/api/orders?page=2&size=8&tab=TO_PAY&keyword=m%C3%A3+%C3%A1o');
  fetch.mockResolvedValue(response(409, { message: 'Hết hàng', code: 'OUT_OF_STOCK' }));
  await expect(api('/api/orders')).rejects.toMatchObject({ status:409, code:'OUT_OF_STOCK' });
  expect(fetch.mock.calls[0][0]).toBe('http://localhost:8080/api/orders');
});
it('does not treat network failure during refresh as logout or discard token', async () => {
  const { signIn, refreshSession, api } = await import('./api');
  fetch.mockResolvedValueOnce(response(200, {accessToken:'customer-token'}));
  await signIn({});
  fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await expect(refreshSession()).rejects.toMatchObject({code:'NETWORK_ERROR'});
  fetch.mockResolvedValueOnce(response(200, []));
  await api('/api/cart');
  expect(fetch.mock.calls.at(-1)[1].headers.Authorization).toBe('Bearer customer-token');
});
it('clears expired customer token without using admin refresh', async () => {
  const { signIn, refreshSession, api } = await import('./api');
  fetch.mockResolvedValueOnce(response(200, {accessToken:'expired'})); await signIn({});
  fetch.mockResolvedValueOnce(response(401, {})); expect(await refreshSession()).toBe(null);
  fetch.mockResolvedValueOnce(response(200, [])); await api('/api/products');
  expect(fetch.mock.calls.at(-1)[1].headers.Authorization).toBeUndefined();
  expect(fetch.mock.calls.some(([url]) => url.includes('/admin/'))).toBe(false);
});
it('keeps customer and admin bearer tokens separate', async () => {
  const {signIn,adminSignIn,api,adminApi}=await import('./api');
  fetch.mockResolvedValueOnce(response(200,{accessToken:'user'})); await signIn({});
  fetch.mockResolvedValueOnce(response(200,{accessToken:'admin'})); await adminSignIn({});
  fetch.mockResolvedValue(response(200,[])); await api('/api/cart'); await adminApi('/api/admin/users');
  expect(fetch.mock.calls.at(-2)[1].headers.Authorization).toBe('Bearer user');
  expect(fetch.mock.calls.at(-1)[1].headers.Authorization).toBe('Bearer admin');
});
