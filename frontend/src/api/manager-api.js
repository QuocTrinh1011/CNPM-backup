import { beginManagerMutation } from './manager-sync';
import {managerQuery} from '../shared/hooks/useManagerFilters';
import { buildApiUrl } from './api-url';
import { emitDesktopBackendUnavailable } from './api-errors';

const API_BASE = import.meta.env.MODE === 'desktop'
  ? (import.meta.env.VITE_DESKTOP_API_BASE_URL || '/api')
  : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
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
  emitDesktopBackendUnavailable(data.code, import.meta.env.MODE);
  const error = new Error(data.message || `Yêu cầu thất bại (${response.status})`);
  error.code = data.code;
  error.status = response.status;
  error.fields = data.fields;
  throw error;
}

export async function adminRefreshSession() {
  if (!adminRefreshing) {
    adminRefreshing = request(buildApiUrl(API_BASE, '/api/manager/auth/refresh'), { method: 'POST', credentials: 'include' })
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
  const response = await request(buildApiUrl(API_BASE, path), { ...options, headers, body, credentials: 'include' });
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

export async function managerChangePassword(currentPassword, newPassword) {
  return await adminApi('/api/manager/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  }, false);
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
  reports: ({ year, month } = {}) => {
    const params = new URLSearchParams();
    if (year != null) params.set('year', String(year));
    if (month != null && month !== '') params.set('month', String(month));
    return `/api/manager/reports?${params}`;
  },
  employees: ({ q = '', page = 0, size = 15 } = {}) => `/api/manager/employees?${managerQuery({ q, page, size })}`,
  rawMaterials: () => '/api/manager/raw-materials',
  rawMaterial: id => `/api/manager/raw-materials/${id}`,
  createRawMaterial: () => '/api/manager/raw-materials',
  updateRawMaterial: id => `/api/manager/raw-materials/${id}`,
  rawMaterialReceipts: ({ page = 0, size = 20 } = {}) => `/api/manager/raw-material-receipts?${managerQuery({ page, size })}`,
  rawMaterialReceipt: id => `/api/manager/raw-material-receipts/${id}`,
  createRawMaterialReceipt: () => '/api/manager/raw-material-receipts',
  productRecipe: productId => `/api/manager/products/${productId}/recipe`,
  productionPlans: ({ page = 0, size = 20 } = {}) => `/api/manager/production-plans?${managerQuery({ page, size })}`,
  productionPlan: id => `/api/manager/production-plans/${id}`,
  createProductionPlan: () => '/api/manager/production-plans',
  cancelProductionPlan: id => `/api/manager/production-plans/${id}/cancel`,
  warehouseMaterialRequests: ({ page = 0, size = 20 } = {}) => `/api/manager/warehouse/material-requests?${managerQuery({ page, size })}`,
  decideWarehouseMaterialRequest: id => `/api/manager/warehouse/material-requests/${id}/decision`,
  warehouseMaterialReturns: ({ page = 0, size = 20 } = {}) => `/api/manager/warehouse/material-returns?${managerQuery({ page, size })}`,
  decideWarehouseMaterialReturn: id => `/api/manager/warehouse/material-returns/${id}/decision`,
  warehouseFinishedGoodsRequests: ({ page = 0, size = 20 } = {}) => `/api/manager/warehouse/finished-goods-requests?${managerQuery({ page, size })}`,
  decideWarehouseFinishedGoodsRequest: id => `/api/manager/warehouse/finished-goods-requests/${id}/decision`,
  warehouseReport: ({ period = 'MONTH', year, month, quarter } = {}) => {
    const params = new URLSearchParams({ period });
    if (year != null && year !== '') params.set('year', String(year));
    if (month != null && month !== '') params.set('month', String(month));
    if (quarter != null && quarter !== '') params.set('quarter', String(quarter));
    return `/api/manager/warehouse/reports?${params}`;
  },
  warehouseEmployeePlans: ({ page = 0, size = 20 } = {}) => `/api/manager/warehouse/me/plans?${managerQuery({ page, size })}`,
  warehouseEmployeeMaterialRequests: ({ page = 0, size = 20 } = {}) => `/api/manager/warehouse/me/material-requests?${managerQuery({ page, size })}`,
  createWarehouseEmployeeMaterialRequest: () => '/api/manager/warehouse/me/material-requests',
  submitWarehouseProductionRun: planId => `/api/manager/warehouse/me/plans/${planId}/production-runs`,
  warehouseEmployeeMaterialReturns: ({ page = 0, size = 20 } = {}) => `/api/manager/warehouse/me/material-returns?${managerQuery({ page, size })}`,
  createWarehouseEmployeeMaterialReturn: planId => `/api/manager/warehouse/me/plans/${planId}/material-returns`,
  warehouseEmployeeFinishedGoodsRequests: ({ page = 0, size = 20 } = {}) => `/api/manager/warehouse/me/finished-goods-requests?${managerQuery({ page, size })}`,
  createWarehouseEmployeeFinishedGoodsRequest: () => '/api/manager/warehouse/me/finished-goods-requests',
  employee: id => `/api/manager/employees/${id}`,
  createEmployee: () => '/api/manager/employees',
  updateEmployee: id => `/api/manager/employees/${id}`,
  deactivateEmployee: id => `/api/manager/employees/${id}`,
  myProfile: () => '/api/manager/me/profile',
  myLeaveRequests: ({ page = 0, size = 50 } = {}) => `/api/manager/me/leave-requests?${managerQuery({ page, size })}`,
  submitMyLeave: () => '/api/manager/me/leave-requests',
  withdrawMyLeave: id => `/api/manager/me/leave-requests/${id}/withdraw`,
  hrLeaveRequests: ({ status = '', employeeId, page = 0, size = 50 } = {}) => `/api/manager/hr/leave-requests?${managerQuery({ status, employeeId, page, size })}`,
  decideLeave: id => `/api/manager/hr/leave-requests/${id}/decision`,
  hrAttendance: ({ year, month, employeeId } = {}) => `/api/manager/hr/attendance?${managerQuery({ year, month, employeeId })}`,
  upsertAttendance: () => '/api/manager/hr/attendance',
  myAttendance: ({ year, month } = {}) => `/api/manager/me/attendance?${managerQuery({ year, month })}`,
  myTeam: () => '/api/manager/me/team',
  myTeamAttendance: ({ year, month } = {}) => `/api/manager/me/team/attendance?${managerQuery({ year, month })}`,
  payrollSettings: ({ asOf } = {}) => `/api/manager/hr/payroll-settings${asOf ? `?${managerQuery({ asOf })}` : ''}`,
  payrollPeriods: ({ year } = {}) => `/api/manager/hr/payroll-periods${year ? `?${managerQuery({ year })}` : ''}`,
  payrollPeriod: (year, month) => `/api/manager/hr/payroll-periods/${year}/${month}`,
  generatePayroll: () => '/api/manager/hr/payroll-periods',
  reviewPayroll: (year, month) => `/api/manager/hr/payroll-periods/${year}/${month}/review`,
  publishPayroll: (year, month) => `/api/manager/hr/payroll-periods/${year}/${month}/publish`,
  adjustPayroll: (year, month) => `/api/manager/hr/payroll-periods/${year}/${month}/adjustments`,
  correctPayslip: (year, month, employeeId) => `/api/manager/hr/payroll-periods/${year}/${month}/revisions/${employeeId}`,
  myPayslips: year => `/api/manager/me/payslips?${managerQuery({ year })}`,
  myPayslip: (year, month) => `/api/manager/me/payslips/${year}/${month}`,
  hrReports: ({ year, month } = {}) => `/api/manager/hr/reports?${managerQuery({ year, month })}`,
};

export const currentApiBase = API_BASE;
