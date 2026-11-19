import { expect, test } from '@playwright/test';
import {
  ADMIN_EMAIL,
  CUSTOMER_EMAIL,
  E2E_PASSWORD,
  EMPLOYEE_SALES_EMAIL,
  MANAGER_SALES_EMAIL,
} from './credentials.js';

const uniqueId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

test('Admin creates an employee account and finds it in the employee account group', async ({ page }) => {
  const id = uniqueId();
  const email = `employee-admin-${id}@crm.test`;
  const fullName = `Nhân viên Admin E2E ${id}`;

  await page.goto('http://localhost:5174/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/mật khẩu/i).fill(E2E_PASSWORD);
  const loginResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/admin/auth/login' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /Đăng nhập Admin/i }).click();
  expect((await loginResponse).status()).toBe(200);

  await page.getByRole('link', { name: 'Tài khoản nội bộ', exact: true }).click();
  await page.getByRole('tab', { name: 'Tài khoản nhân viên' }).click();
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  await page.getByLabel('Họ tên').fill(fullName);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Vai trò').selectOption('EMPLOYEE');
  await page.getByLabel('Loại nhân viên').selectOption('WAREHOUSE');

  const createResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/admin/accounts' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  const created = await createResponse;
  expect([200, 201]).toContain(created.status());
  await expect(page.getByRole('cell', { name: fullName })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  const accountTable = page.getByRole('table');
  await page.getByRole('tab', { name: 'Tài khoản quản lý' }).click();
  await expect(accountTable.getByRole('row').filter({ hasText: ADMIN_EMAIL })).toBeVisible();
  await expect(accountTable.getByRole('row').filter({ hasText: MANAGER_SALES_EMAIL })).toBeVisible();
  await expect(accountTable.getByRole('row').filter({ hasText: EMPLOYEE_SALES_EMAIL })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Tài khoản nhân viên' }).click();
  await expect(accountTable.getByRole('row').filter({ hasText: EMPLOYEE_SALES_EMAIL })).toBeVisible();
  await expect(accountTable.getByRole('row').filter({ hasText: MANAGER_SALES_EMAIL })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Tài khoản khách hàng' }).click();
  await expect(accountTable.getByRole('row').filter({ hasText: CUSTOMER_EMAIL })).toBeVisible();
  await expect(accountTable.getByRole('row').filter({ hasText: EMPLOYEE_SALES_EMAIL })).toHaveCount(0);
});
