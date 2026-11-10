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
let accessToken = null;
let refreshing = null;
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

export async function api(path, options = {}, canRefresh = true) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const body = options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body;
  const response = await request(`${API_BASE}${path}`, { ...options, headers, body, credentials: 'include' });
  if (response.status === 401 && canRefresh && !path.startsWith('/api/auth/')) {
    const session = await refreshSession();
    if (session) return api(path, options, false);
  }
  return parseResponse(response);
}

export async function refreshSession() {
  if (!refreshing) {
    refreshing = request(`${API_BASE}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(parseResponse)
      .then(data => { accessToken = data.accessToken; return data; })
      .catch(error => { if (error.status === 401 || error.status === 403 || error.status === 423) { const hadSession = Boolean(accessToken); accessToken = null; if (hadSession && typeof window !== 'undefined') window.dispatchEvent(new Event('shop-session-expired')); return null; } throw error; })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function signIn(payload) {
  const data = await api('/api/auth/login', { method: 'POST', body: payload }, false);
  accessToken = data.accessToken;
  return data;
}

export async function signUp(payload) { return api('/api/auth/register', { method: 'POST', body: payload }, false); }

export async function signOut() {
  await api('/api/auth/logout', { method: 'POST' }, false);
  accessToken = null;
}

export async function adminRefreshSession() {
  if (!adminRefreshing) {
    adminRefreshing = request(`${API_BASE}/api/admin/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(parseResponse)
      .then(data => { adminAccessToken = data.accessToken; return data; })
      .catch(error => { if ([401,403,423].includes(error.status)) { adminAccessToken=null; return null; } throw error; })
      .finally(() => { adminRefreshing = null; });
  }
  return adminRefreshing;
}

export async function adminApi(path, options = {}, canRefresh = true) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  if (adminAccessToken) headers.Authorization = `Bearer ${adminAccessToken}`;
  const body = options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body;
  const response = await request(`${API_BASE}${path}`, { ...options, headers, body, credentials: 'include' });
  if (response.status === 401 && canRefresh && !path.startsWith('/api/admin/auth/')) {
    const session = await adminRefreshSession();
    if (session) return adminApi(path, options, false);
  }
  return parseResponse(response);
}

export async function adminSignIn(payload) {
  const data = await adminApi('/api/admin/auth/login', { method: 'POST', body: payload }, false);
  adminAccessToken = data.accessToken;
  return data;
}

export async function adminSignOut() {
  await adminApi('/api/admin/auth/logout', { method: 'POST' }, false).catch(() => null);
  adminAccessToken = null;
}

export const endpoints = {
  catalog: ({ keyword = '', category = '', minPrice = '', maxPrice = '', gender = 'NAM', sort = 'newest', page = 0, size = 8 } = {}) => {
    const params = new URLSearchParams({ keyword, category, gender, sort, page, size });
    if (minPrice !== '') params.set('minPrice', minPrice);
    if (maxPrice !== '') params.set('maxPrice', maxPrice);
    return `/api/products?${params}`;
  },
  product: id => `/api/products/${id}`,
  categories: '/api/products/categories',
  profile: '/api/customers/me',
  cart: '/api/cart',
  addCart: '/api/cart/items',
  wishlist: '/api/wishlist',
  wishlistItem: id => `/api/wishlist/${id}`,
  addresses: '/api/customers/me/addresses',
  address: id => `/api/customers/me/addresses/${id}`,
  defaultAddress: id => `/api/customers/me/addresses/${id}/default`,
  validateVoucher: (code, amount) => `/api/vouchers/validate?code=${encodeURIComponent(code)}&amount=${encodeURIComponent(amount)}`,
  orders: ({ page = 0, size = 10, tab = 'ALL', keyword = '' } = {}) => {
    const params = new URLSearchParams({ page: String(page), size: String(size), tab });
    if (keyword) params.set('keyword', keyword);
    return `/api/orders?${params}`;
  },
  order: id => `/api/orders/${id}`,
  orderPayment: id => `/api/orders/${id}/payment`,
  syncOrderPayment: id => `/api/orders/${id}/payment/sync`,
  retryOrderPayment: id => `/api/orders/${id}/payment/retry`,
  cancelOrder: id => `/api/orders/${id}/cancel`,
  returnOrder: id => `/api/orders/${id}/return`,
  notifications: '/api/notifications',
  notificationRead: id => `/api/notifications/${id}/read`,
  notificationsReadAll: '/api/notifications/read-all',
  feedback: id => `/api/products/${id}/feedback`,
  surveys: '/api/surveys',
  mySurveys: '/api/surveys/mine',
  survey: id => `/api/surveys/${id}`,
  surveyResponses: id => `/api/surveys/${id}/responses`,
  changePassword: '/api/auth/change-password',
  forgotPassword: '/api/auth/forgot-password',
  resetPassword: '/api/auth/reset-password',
};

export const currentApiBase = API_BASE;
