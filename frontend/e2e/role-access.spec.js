import { expect, test } from '@playwright/test';
import { E2E_PASSWORD, ROLE_FIXTURES } from './credentials.js';

const MANAGER_ORIGIN = 'http://localhost:5175';
const ADMIN_ORIGIN = 'http://localhost:5174';
const API_ORIGIN = 'http://localhost:8082';
const byName = (name) => ROLE_FIXTURES.find((fixture) => fixture.name === name);

async function signInManager(page, fixture) {
  await page.goto(`${MANAGER_ORIGIN}/manager/login`);
  await page.getByLabel('EMAIL').fill(fixture.email);
  await page.getByLabel('MẬT KHẨU').fill(E2E_PASSWORD);
  const responsePromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/manager/auth/login' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /ĐĂNG NHẬP QUẢN LÝ/i }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  return response.json();
}

const managerRoleChecks = [
  {
    name: 'Manager Sales',
    path: '/manager/orders',
    heading: 'Đơn hàng',
    allowed: ['Đơn hàng', 'Sản phẩm', 'Báo cáo'],
    hidden: ['Nhân viên', 'Nhập kho', 'Bảng lương'],
    forbidden: '/manager/warehouse-reports',
    deniedApi: '/api/manager/warehouse/reports',
    sharedProductRead: true,
  },
  {
    name: 'Manager Warehouse',
    path: '/manager/products',
    heading: 'Sản phẩm',
    allowed: ['Sản phẩm', 'Nhập kho', 'Nguyên liệu', 'Báo cáo kho'],
    hidden: ['Đơn hàng', 'Nhân viên', 'Bảng lương'],
    forbidden: '/manager/orders',
    deniedApi: '/api/manager/orders',
    sharedProductRead: true,
  },
  {
    name: 'Manager HR',
    path: '/manager/employees',
    heading: 'Nhân viên',
    allowed: ['Nhân viên', 'Duyệt đơn nghỉ', 'Chấm công', 'Bảng lương', 'Báo cáo nhân sự'],
    hidden: ['Đơn hàng', 'Nhập kho', 'Khách hàng'],
    forbidden: '/manager/warehouse-reports',
    deniedApi: '/api/manager/warehouse/reports',
  },
  {
    name: 'Employee Sales',
    path: '/manager/my-profile',
    heading: 'Thông tin của tôi',
    allowed: ['Thông tin của tôi', 'Đơn nghỉ của tôi', 'Chấm công của tôi', 'Phiếu lương của tôi'],
    hidden: ['Nhân viên', 'Đơn hàng', 'Công việc kho'],
    forbidden: '/manager/employees',
    deniedApi: '/api/manager/employees',
  },
  {
    name: 'Employee Warehouse',
    path: '/manager/my-profile',
    heading: 'Thông tin của tôi',
    allowed: ['Thông tin của tôi', 'Công việc kho'],
    hidden: ['Đơn hàng', 'Duyệt yêu cầu kho', 'Bảng lương'],
    forbidden: '/manager/warehouse-approvals',
    deniedApi: '/api/manager/warehouse/material-requests',
  },
  {
    name: 'Employee Team Lead',
    path: '/manager/my-team',
    heading: 'Nhân viên trong nhóm',
    allowed: ['Nhân viên trong nhóm', 'Chấm công nhóm', 'Thông tin của tôi'],
    hidden: ['Bảng lương', 'Nhập kho', 'Đơn hàng'],
    forbidden: '/manager/payroll',
    deniedApi: '/api/manager/hr/payroll-periods',
  },
];

for (const check of managerRoleChecks) {
  test(`${check.name} sees allowed areas and is blocked from restricted routes and APIs`, async ({ page }) => {
    const fixture = byName(check.name);
    const session = await signInManager(page, fixture);

    await expect(page).toHaveURL(`${MANAGER_ORIGIN}${check.path}`);
    await expect(page.locator('.admin-page-heading h1')).toHaveText(check.heading);
    for (const label of check.allowed) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    for (const label of check.hidden) {
      await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0);
    }

    const forbiddenResponse = await page.request.get(`${API_ORIGIN}${check.deniedApi}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    expect(forbiddenResponse.status()).toBe(403);

    if (check.sharedProductRead) {
      const productsResponse = await page.request.get(`${API_ORIGIN}/api/manager/products`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      expect(productsResponse.status()).toBe(200);
    }

    if (check.name === 'Manager Sales') {
      const warehouseWrite = await page.request.post(`${API_ORIGIN}/api/manager/products`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        data: {},
      });
      expect(warehouseWrite.status()).toBe(403);

      const adminApi = await page.request.get(`${API_ORIGIN}/api/admin/accounts`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      expect([401, 403]).toContain(adminApi.status());
    }

    if (check.name === 'Employee Team Lead') {
      const rosterResponse = await page.request.get(`${API_ORIGIN}/api/manager/me/team`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      expect(rosterResponse.status()).toBe(200);
      const roster = await rosterResponse.json();
      expect(roster.some((employee) => employee.employeeCode === 'E2E-SALES-STAFF')).toBe(true);

      const month = new Date();
      const attendanceResponse = await page.request.get(
        `${API_ORIGIN}/api/manager/me/team/attendance?year=${month.getFullYear()}&month=${month.getMonth() + 1}`,
        { headers: { Authorization: `Bearer ${session.accessToken}` } },
      );
      expect(attendanceResponse.status()).toBe(200);
      await page.goto(`${MANAGER_ORIGIN}/manager/my-team-attendance`);
      await expect(page.locator('.admin-page-heading h1')).toHaveText('Chấm công nhóm');
      await expect(page.locator('.hr-team-roster')).toContainText('E2E Employee Sales');
    }

    await page.goto(`${MANAGER_ORIGIN}${check.forbidden}`);
    await expect(page).toHaveURL(`${MANAGER_ORIGIN}${check.path}`);
    await expect(page.locator('.admin-page-heading h1')).toHaveText(check.heading);
  });
}

test('Admin portal session cannot authenticate against the Manager API', async ({ page }) => {
  const fixture = byName('Admin');
  await page.goto(`${ADMIN_ORIGIN}/admin/login`);
  await page.getByLabel(/email/i).fill(fixture.email);
  await page.getByLabel(/mật khẩu/i).fill(E2E_PASSWORD);
  const loginPromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/admin/auth/login' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /Đăng nhập Admin/i }).click();
  const login = await loginPromise;
  expect(login.status()).toBe(200);
  const session = await login.json();
  await expect(page).toHaveURL(`${ADMIN_ORIGIN}/admin`);
  for (const label of ['Tài khoản nội bộ', 'Sản phẩm', 'Nhật ký thao tác']) {
    await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  await page.getByRole('link', { name: 'Tài khoản nội bộ', exact: true }).click();
  await expect(page).toHaveURL(`${ADMIN_ORIGIN}/admin/accounts`);
  await expect(page.getByRole('heading', { name: 'Tài khoản nội bộ', exact: true })).toBeVisible();

  const managerResponse = await page.request.get(`${API_ORIGIN}/api/manager/orders`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  expect([401, 403]).toContain(managerResponse.status());
});

test('unauthenticated direct access to Admin accounts redirects to login', async ({ page }) => {
  await page.goto(`${ADMIN_ORIGIN}/admin/accounts`);
  await expect(page).toHaveURL(`${ADMIN_ORIGIN}/admin/login`);
  await expect(page.getByRole('button', { name: /Đăng nhập Admin/i })).toBeVisible();
});

test('Manager session cannot authenticate against the customer profile API', async ({ page }) => {
  const manager = byName('Manager Sales');
  const session = await signInManager(page, manager);
  const response = await page.request.get(`${API_ORIGIN}/api/customers/me`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  expect(response.status()).toBe(403);
});
