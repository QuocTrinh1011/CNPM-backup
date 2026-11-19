import { expect, test } from '@playwright/test';
import {
  E2E_PASSWORD,
  EMPLOYEE_WAREHOUSE_EMAIL,
  MANAGER_HR_EMAIL,
  MANAGER_WAREHOUSE_EMAIL,
  WORKFLOW_EMPLOYEE_SALES_EMAILS,
} from './credentials.js';

const MANAGER_ORIGIN = 'http://localhost:5175';

async function signIn(page, email) {
  await page.goto(`${MANAGER_ORIGIN}/manager/login`);
  await page.getByLabel('EMAIL').fill(email);
  await page.getByLabel('MẬT KHẨU').fill(E2E_PASSWORD);
  const response = page.waitForResponse(request =>
    new URL(request.url()).pathname === '/api/manager/auth/login' && request.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /ĐĂNG NHẬP QUẢN LÝ/i }).click();
  expect((await response).status()).toBe(200);
}

const apiGet = (page, path) => page.waitForResponse(response =>
  new URL(response.url()).pathname === path && response.request().method() === 'GET',
);
const dateInDays = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

test('employee leave request is approved by HR; HR and employee workspaces load', async ({ page, browser }, testInfo) => {
  const employeePage = await browser.newPage();
  const marker = `leave-e2e-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
  try {
    await signIn(employeePage, WORKFLOW_EMPLOYEE_SALES_EMAILS[testInfo.project.name]);
    await employeePage.goto(`${MANAGER_ORIGIN}/manager/my-requests`);
    await expect(employeePage.locator('.admin-page-heading h1')).toHaveText('Đơn nghỉ của tôi');
    const retryOffset = testInfo.retry * 3;
    const withdrawnMarker = `${marker}-withdrawn`;
    await employeePage.getByLabel('Từ ngày').fill(dateInDays(1 + retryOffset));
    await employeePage.getByLabel('Đến ngày').fill(dateInDays(1 + retryOffset));
    await employeePage.getByLabel('Ghi chú').fill(withdrawnMarker);
    const submitResponse = employeePage.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/manager/me/leave-requests' && response.request().method() === 'POST',
    );
    await employeePage.getByRole('button', { name: 'Gửi đơn' }).click();
    const submitted = await submitResponse;
    expect([200, 201]).toContain(submitted.status());
    const withdrawnCard = employeePage.locator('.hr-request-card').filter({ hasText: withdrawnMarker });
    await expect(withdrawnCard).toBeVisible();
    const withdrawResponse = employeePage.waitForResponse(response =>
      new URL(response.url()).pathname.match(/^\/api\/manager\/me\/leave-requests\/\d+\/withdraw$/) && response.request().method() === 'PATCH',
    );
    await withdrawnCard.getByRole('button', { name: 'Rút đơn' }).click();
    expect((await withdrawResponse).status()).toBe(200);
    await expect(withdrawnCard).toContainText('WITHDRAWN');

    const markerApproved = `${marker}-approved`;
    await employeePage.getByLabel('Từ ngày').fill(dateInDays(2 + retryOffset));
    await employeePage.getByLabel('Đến ngày').fill(dateInDays(2 + retryOffset));
    await employeePage.getByLabel('Ghi chú').fill(markerApproved);
    const approvedSubmitResponse = employeePage.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/manager/me/leave-requests' && response.request().method() === 'POST',
    );
    await employeePage.getByRole('button', { name: 'Gửi đơn' }).click();
    expect([200, 201]).toContain((await approvedSubmitResponse).status());
    await expect(employeePage.locator('.hr-request-card').filter({ hasText: markerApproved })).toBeVisible();

    await signIn(page, MANAGER_HR_EMAIL);
    const hrLeaveResponse = apiGet(page, '/api/manager/hr/leave-requests');
    await page.goto(`${MANAGER_ORIGIN}/manager/leave-requests`);
    expect((await hrLeaveResponse).status()).toBe(200);
    const requestCard = page.locator('.hr-request-card').filter({ hasText: markerApproved });
    await expect(requestCard).toBeVisible();
    const decision = page.waitForResponse(response =>
      new URL(response.url()).pathname.match(/^\/api\/manager\/hr\/leave-requests\/\d+\/decision$/) && response.request().method() === 'PATCH',
    );
    await requestCard.getByRole('button', { name: 'Duyệt' }).click();
    expect((await decision).status()).toBe(200);
    await expect(page.getByText('Đã lưu thay đổi.', { exact: true })).toBeVisible();

    await employeePage.goto(`${MANAGER_ORIGIN}/manager/my-requests`);
    await expect(employeePage.locator('.hr-request-card').filter({ hasText: markerApproved })).toContainText('APPROVED');

    const attendanceResponse = apiGet(page, '/api/manager/hr/attendance');
    await page.goto(`${MANAGER_ORIGIN}/manager/attendance`);
    expect((await attendanceResponse).status()).toBe(200);
    await expect(page.locator('.admin-page-heading h1')).toHaveText('Chấm công');

    const payrollPeriodsResponse = apiGet(page, '/api/manager/hr/payroll-periods');
    await page.goto(`${MANAGER_ORIGIN}/manager/payroll`);
    expect((await payrollPeriodsResponse).status()).toBe(200);
    await expect(page.locator('.admin-page-heading h1')).toHaveText('Bảng lương');

    const reportResponse = apiGet(page, '/api/manager/hr/reports');
    await page.goto(`${MANAGER_ORIGIN}/manager/hr-reports`);
    expect((await reportResponse).status()).toBe(200);
    await expect(page.locator('.admin-page-heading h1')).toHaveText('Báo cáo nhân sự');

    const attendanceSelfResponse = apiGet(employeePage, '/api/manager/me/attendance');
    await employeePage.goto(`${MANAGER_ORIGIN}/manager/my-attendance`);
    expect((await attendanceSelfResponse).status()).toBe(200);
    const payslipsResponse = apiGet(employeePage, '/api/manager/me/payslips');
    await employeePage.goto(`${MANAGER_ORIGIN}/manager/my-payslips`);
    expect((await payslipsResponse).status()).toBe(200);
    await expect(employeePage.locator('.admin-page-heading h1')).toHaveText('Phiếu lương của tôi');
  } finally {
    await employeePage.close();
  }
});

test('warehouse employee requests material and Warehouse Manager approves it', async ({ page, browser }) => {
  const employeePage = await browser.newPage();
  const marker = `material-e2e-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
  try {
    await signIn(employeePage, EMPLOYEE_WAREHOUSE_EMAIL);
    const plansResponse = apiGet(employeePage, '/api/manager/warehouse/me/plans');
    await employeePage.goto(`${MANAGER_ORIGIN}/manager/warehouse-tasks`);
    expect((await plansResponse).status()).toBe(200);
    const planCard = employeePage.locator('.warehouse-employee-plan').filter({ hasText: 'E2E-WAREHOUSE-PLAN' });
    await expect(planCard).toBeVisible();
    await planCard.getByRole('button', { name: /Đề nghị nguyên liệu/ }).click();
    await employeePage.getByLabel('Số lượng xin cấp Vải E2E').fill('1');
    await employeePage.locator('.warehouse-employee-form textarea').fill(marker);
    const createResponse = employeePage.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/manager/warehouse/me/material-requests' && response.request().method() === 'POST',
    );
    await employeePage.getByRole('button', { name: 'Gửi đề nghị nguyên liệu' }).click();
    const created = await createResponse;
    expect([200, 201]).toContain(created.status());
    const createdRequest = await created.json().catch(() => ({}));

    await signIn(page, MANAGER_WAREHOUSE_EMAIL);
    const approvalsResponse = apiGet(page, '/api/manager/warehouse/material-requests');
    await page.goto(`${MANAGER_ORIGIN}/manager/warehouse-approvals`);
    expect((await approvalsResponse).status()).toBe(200);
    const requestCard = page.locator('.warehouse-approval-card').filter({ hasText: marker });
    await expect(requestCard).toBeVisible();
    const requestCode = createdRequest.requestCode || (await requestCard.locator('b').innerText()).trim();
    await expect(requestCard).toContainText(requestCode);
    await expect(requestCard.getByRole('button', { name: new RegExp(`Duyệt ${requestCode}`) })).toBeVisible();
    const decision = page.waitForResponse(response =>
      Boolean(new URL(response.url()).pathname.match(/^\/api\/manager\/warehouse\/material-requests\/\d+\/decision$/)) && response.request().method() === 'PATCH',
    );
    await requestCard.getByRole('button', { name: new RegExp(`Duyệt ${requestCode}`) }).click();
    expect((await decision).status()).toBe(200);
    await expect(page.getByRole('status').filter({ hasText: `Đã duyệt yêu cầu ${requestCode}` })).toBeVisible();
    await employeePage.goto(`${MANAGER_ORIGIN}/manager/warehouse-tasks`);
    await expect(employeePage.locator('.warehouse-employee-history').filter({ hasText: requestCode })).toContainText('Đã duyệt');
  } finally {
    await employeePage.close();
  }
});
