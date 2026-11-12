import { beginManagerMutation } from './manager-sync';
import {managerQuery} from '../shared/hooks/useManagerFilters';
const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
async function request(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const cancel = () => controller.abort();
  options?.signal?.addEventListener('abort', cancel, { once: true });
  if (options?.signal?.aborted) controller.abort();
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  catch (cause) {
    if (options?.signal?.aborted) throw cause;
    const error = new Error(controller.signal.aborted ? 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.' : 'Không kết nối được máy chủ. Kiểm tra kết nối và thử lại.');
    error.code = controller.signal.aborted ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR';
    throw error;
  }
  finally { clearTimeout(timer); options?.signal?.removeEventListener('abort', cancel); }
}
let adminAccessToken = null;
let adminRefreshing = null;

async function parseResponse(response) {
  if (response.ok) return response.status === 204 ? null : response.json();
  const data = await response.json().catch(() => ({}));
  const error = new Error(data.message || `Yêu cầu thất bại (${response.status})`);
  error.code = data.code;
  error.status = response.status;
  error.fields = data.fields;
  throw error;
}

export async function adminRefreshSession() {
  if (!adminRefreshing) {
    adminRefreshing = request(`${API_BASE}/api/manager/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(parseResponse)
      .then(data => { adminAccessToken = data.accessToken; return data; })
      .catch(error => { if ([401,403,423].includes(error.status)) { adminAccessToken=null; return null; } throw error; })
      .finally(() => { adminRefreshing = null; });
  }
  return adminRefreshing;
}

export async function adminApi(path, options = {}, canRefresh = true) {
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes((options.method || 'GET').toUpperCase()) && !path.startsWith('/api/manager/auth/');
  const finish = mutating ? beginManagerMutation() : null;
  try {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  if (adminAccessToken) headers.Authorization = `Bearer ${adminAccessToken}`;
  const body = options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body;
  const response = await request(`${API_BASE}${path}`, { ...options, headers, body, credentials: 'include' });
  if (response.status === 401 && canRefresh && !path.startsWith('/api/manager/auth/')) {
    const session = await adminRefreshSession();
    if (session) return await adminApi(path, options, false);
  }
  return await parseResponse(response);
  } finally { finish?.(); }
}

export async function adminSignIn(payload) {
  const data = await adminApi('/api/manager/auth/login', { method: 'POST', body: payload }, false);
  adminAccessToken = data.accessToken;
  return data;
}

export async function adminSignOut() {
  await adminApi('/api/manager/auth/logout', { method: 'POST' }, false).catch(() => null);
  adminAccessToken = null;
}

export const adminEndpoints = {
  users: ({ q = '', page = 0, size = 10, ...filters } = {}) => `/api/manager/users?q=${encodeURIComponent(q)}&page=${page}&size=${size}${Object.entries(filters).filter(([,v])=>v!==''&&v!=null).map(([k,v])=>`&${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('')}`,
  user: id => `/api/manager/users/${id}`,
  lockUser: id => `/api/manager/users/${id}/lock`,
  deleteUser: id => `/api/manager/users/${id}`,
  products: ({ q = '', page = 0, size = 10,...filters } = {}) => `/api/manager/products?${managerQuery({q,page,size,...filters})}`,
  product: id => `/api/manager/products/${id}`,
  productStock: id => `/api/manager/products/${id}/stock`,
  orders: ({ status = '', page = 0, size = 10,...filters } = {}) => `/api/manager/orders?${managerQuery({status,page,size,...filters})}`,
  order: id => `/api/manager/orders/${id}`,
  orderStatus: id => `/api/manager/orders/${id}/status`,
  feedback: ({ status = '', page = 0, size = 10 } = {}) => `/api/manager/feedback${status ? `?status=${encodeURIComponent(status)}&page=${page}&size=${size}` : `?page=${page}&size=${size}`}`,
  feedbackItem: id => `/api/manager/feedback/${id}`,
  surveys: ({ status = '', page = 0, size = 10 } = {}) => `/api/manager/surveys${status ? `?status=${encodeURIComponent(status)}&page=${page}&size=${size}` : `?page=${page}&size=${size}`}`,
  survey: id => `/api/manager/surveys/${id}`,
  surveyPublish: id => `/api/manager/surveys/${id}/publish`,
  promotions: ({ search = '', page = 0, size = 10 } = {}) => `/api/manager/promotions?${new URLSearchParams({ search, page: String(page), size: String(size) })}`,
  promotion: id => `/api/manager/promotions/${id}`,
  createPromotion: () => '/api/manager/promotions',
  updatePromotion: id => `/api/manager/promotions/${id}`,
  deletePromotion: id => `/api/manager/promotions/${id}`,
};

export const currentApiBase = API_BASE;
