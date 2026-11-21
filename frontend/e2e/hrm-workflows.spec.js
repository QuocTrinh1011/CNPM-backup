import { expect, test } from '@playwright/test';
import { E2E_PASSWORD, MANAGER_HR_EMAIL } from './credentials.js';

const MANAGER_ORIGIN = 'http://localhost:5175';
const API_ORIGIN = 'http://localhost:8082';
const EMPLOYEE_PASSWORD = 'E2E_HR_Test123!';

const apiResponse = (page, path, method) => page.waitForResponse(response =>
  new URL(response.url()).pathname === path && response.request().method() === method,
);

async function signIn(page, email, password = E2E_PASSWORD) {
  await page.goto(`${MANAGER_ORIGIN}/manager/login`);
  await page.getByLabel('EMAIL').fill(email);
  await page.getByLabel('MẬT KHẨU').fill(password);
  const login = apiResponse(page, '/api/manager/auth/login', 'POST');
  await page.getByRole('button', { name: /ĐĂNG NHẬP QUẢN LÝ/i }).click();
  const response = await login;
  const responseBody = await response.text();
  expect(response.status(), responseBody).toBe(200);
  return JSON.parse(responseBody);
}

function uniqueKey(testInfo) {
  return `${testInfo.project.name}-${testInfo.retry}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
}

async function createEmployee(page, employee, reportsToEmployeeId) {
  await page.getByRole('button', { name: 'Thêm nhân viên' }).click();
  await page.getByLabel('Họ và tên').fill(employee.fullName);
  await page.getByLabel('Email').fill(employee.email);
  await page.getByLabel('Điện thoại', { exact: true }).fill('0901234567');
  await page.getByLabel('Mật khẩu tạm thời').fill(EMPLOYEE_PASSWORD);
  await page.getByLabel('Mã nhân viên').fill(employee.employeeCode);
  await page.getByLabel('Trình độ').fill('Đại học');
  await page.getByLabel('Chức danh').fill('Nhân viên kiểm thử HR');
  await page.getByLabel('Ngày nhận việc').fill('2025-01-01');
  await page.getByLabel('Lương tháng').fill('12000000');
  await page.getByLabel('Mức lương đóng bảo hiểm').fill('10000000');
  await page.getByLabel('Khu vực làm việc').selectOption('SALES');
  if (reportsToEmployeeId) {
    await page.getByLabel('Trưởng nhóm trực tiếp').selectOption(String(reportsToEmployeeId));
  }
  const created = apiResponse(page, '/api/manager/employees', 'POST');
  await page.getByRole('button', { name: 'Tạo hồ sơ' }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  return (await response.json()).id;
}

async function editEmployee(page, employee, update) {
  const row = page.locator('tr').filter({ hasText: employee.email });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: `Sửa ${employee.fullName}` }).click();
  await update();
  const saved = page.waitForResponse(response =>
    /^\/api\/manager\/employees\/\d+$/.test(new URL(response.url()).pathname)
      && response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Lưu hồ sơ' }).click();
  const response = await saved;
  expect(response.status()).toBe(200);
}

test('HR manages employee access, reports, attendance, payroll, and employee self-service', async ({ page, browser }, testInfo) => {
  test.setTimeout(90_000);
  const key = uniqueKey(testInfo);
  const stamp = key.replaceAll('-', '').slice(-14).toUpperCase();
  const leader = { fullName: `Trưởng nhóm ${key}`, email: `hr-lead-${key}@crm.test`, employeeCode: `HL${stamp}` };
  const member = { fullName: `Nhân viên ${key}`, email: `hr-member-${key}@crm.test`, employeeCode: `HM${stamp}` };
  const resignee = { fullName: `Nghỉ việc ${key}`, email: `hr-resign-${key}@crm.test`, employeeCode: `HX${stamp}` };
  const archived = { fullName: `Lưu trữ ${key}`, email: `hr-archive-${key}@crm.test`, employeeCode: `HA${stamp}` };
  const marker = `hr-flow-${key}`;
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const dateInReportMonth = `${year}-${String(month).padStart(2, '0')}-02`;
  const attendanceDate = `${year}-${String(month).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const memberPage = await browser.newPage();
  const leaderPage = await browser.newPage();
  const resigneePage = await browser.newPage();

  try {
    await signIn(page, MANAGER_HR_EMAIL);
    await page.goto(`${MANAGER_ORIGIN}/manager/employees`);
    await expect(page.locator('.admin-page-heading h1')).toHaveText('Nhân viên');

    const leaderId = await createEmployee(page, leader);
    await editEmployee(page, leader, async () => {
      await page.getByLabel('Quyền trong nhóm').selectOption('TEAM_LEAD');
    });

    await createEmployee(page, member, leaderId);
    await createEmployee(page, resignee);
    await createEmployee(page, archived);

    const archivedRow = page.locator('tr').filter({ hasText: archived.email });
    await archivedRow.getByRole('button', { name: `Ngừng hoạt động ${archived.fullName}` }).click();
    const deactivate = apiResponse(page, `/api/manager/employees/${await archivedRow.locator('td').first().innerText()}`, 'DELETE');
    await page.getByRole('button', { name: 'Xác nhận ngừng hoạt động' }).click();
    expect((await deactivate).status()).toBe(204);
    await page.getByLabel('Tình trạng nhân viên').selectOption('INACTIVE');
    await page.getByRole('searchbox', { name: 'Tìm nhân viên' }).fill(archived.email);
    await expect(page.locator('tr').filter({ hasText: archived.email })).toContainText('Đã lưu trữ');
    await expect(page.getByRole('button', { name: `Sửa ${archived.fullName}` })).toHaveCount(0);

    const memberSession = await signIn(memberPage, member.email, EMPLOYEE_PASSWORD);
    await memberPage.goto(`${MANAGER_ORIGIN}/manager/my-profile`);
    await memberPage.getByLabel('Họ và tên').fill(`${member.fullName} cập nhật`);
    await memberPage.getByLabel('Điện thoại', { exact: true }).fill('0912345678');
    await memberPage.getByLabel('Người liên hệ khẩn cấp').fill('Người thân E2E');
    const profileUpdate = apiResponse(memberPage, '/api/manager/me/profile', 'PUT');
    await memberPage.getByRole('button', { name: 'Lưu thông tin' }).click();
    expect((await profileUpdate).status()).toBe(200);
    await expect(memberPage.getByRole('status')).toHaveText('Đã cập nhật thông tin cá nhân.');

    await memberPage.goto(`${MANAGER_ORIGIN}/manager/my-team`);
    await expect(memberPage).toHaveURL(`${MANAGER_ORIGIN}/manager/my-profile`);
    const blockedTeam = await memberPage.request.get(`${API_ORIGIN}/api/manager/me/team`, {
      headers: { Authorization: `Bearer ${memberSession.accessToken}` },
    });
    expect(blockedTeam.status()).toBe(403);
    const blockedApproval = await memberPage.request.get(`${API_ORIGIN}/api/manager/warehouse/material-requests`, {
      headers: { Authorization: `Bearer ${memberSession.accessToken}` },
    });
    expect(blockedApproval.status()).toBe(403);

    await memberPage.goto(`${MANAGER_ORIGIN}/manager/my-requests`);
    await memberPage.getByLabel('Loại đơn').selectOption('ANNUAL');
    await memberPage.getByLabel('Từ ngày').fill(dateInReportMonth);
    await memberPage.getByLabel('Đến ngày').fill(dateInReportMonth);
    await memberPage.getByLabel('Ghi chú').fill(`${marker}-annual`);
    const annualRequest = apiResponse(memberPage, '/api/manager/me/leave-requests', 'POST');
    await memberPage.getByRole('button', { name: 'Gửi đơn' }).click();
    expect((await annualRequest).status()).toBe(201);

    await page.goto(`${MANAGER_ORIGIN}/manager/leave-requests`);
    const annualCard = page.locator('.hr-request-card').filter({ hasText: `${marker}-annual` });
    await expect(annualCard).toBeVisible();
    const approveAnnual = page.waitForResponse(response =>
      /^\/api\/manager\/hr\/leave-requests\/\d+\/decision$/.test(new URL(response.url()).pathname)
        && response.request().method() === 'PATCH',
    );
    await annualCard.getByRole('button', { name: 'Duyệt' }).click();
    expect((await approveAnnual).status()).toBe(200);

    await signIn(resigneePage, resignee.email, EMPLOYEE_PASSWORD);
    await resigneePage.goto(`${MANAGER_ORIGIN}/manager/my-requests`);
    await resigneePage.getByLabel('Loại đơn').selectOption('RESIGNATION');
    await resigneePage.getByLabel('Từ ngày').fill(`${year}-${String(month).padStart(2, '0')}-03`);
    await resigneePage.getByLabel('Đến ngày').fill(`${year}-${String(month).padStart(2, '0')}-03`);
    await resigneePage.getByLabel('Ghi chú').fill(`${marker}-resignation`);
    const resignationRequest = apiResponse(resigneePage, '/api/manager/me/leave-requests', 'POST');
    await resigneePage.getByRole('button', { name: 'Gửi đơn' }).click();
    expect((await resignationRequest).status()).toBe(201);

    await page.goto(`${MANAGER_ORIGIN}/manager/leave-requests`);
    const resignationCard = page.locator('.hr-request-card').filter({ hasText: `${marker}-resignation` });
    await expect(resignationCard).toBeVisible();
    const approveResignation = page.waitForResponse(response =>
      /^\/api\/manager\/hr\/leave-requests\/\d+\/decision$/.test(new URL(response.url()).pathname)
        && response.request().method() === 'PATCH',
    );
    await resignationCard.getByRole('button', { name: 'Duyệt' }).click();
    expect((await approveResignation).status()).toBe(200);

    await page.goto(`${MANAGER_ORIGIN}/manager/employees`);
    await page.getByLabel('Tình trạng nhân viên').selectOption('INACTIVE');
    await page.getByRole('searchbox', { name: 'Tìm nhân viên' }).fill(resignee.email);
    await expect(page.locator('tr').filter({ hasText: resignee.email })).toContainText('Nghỉ việc');

    const attendanceGet = apiResponse(page, '/api/manager/hr/attendance', 'GET');
    const directoryGet = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === '/api/manager/employees'
        && url.searchParams.get('size') === '100'
        && !url.searchParams.has('permissionProfile')
        && response.request().method() === 'GET';
    });
    await page.goto(`${MANAGER_ORIGIN}/manager/attendance`);
    expect((await attendanceGet).status()).toBe(200);
    const directoryResponse = await directoryGet;
    expect(directoryResponse.status()).toBe(200);
    const directory = await directoryResponse.json();
    expect(directory.content.some(employee => employee.employeeCode === member.employeeCode)).toBe(true);
    const attendanceEmployee = page.getByRole('combobox', { name: 'Nhân viên', exact: true });
    await attendanceEmployee.selectOption({ label: `${member.employeeCode} · ${member.fullName} cập nhật` });
    await page.getByRole('textbox', { name: 'Ngày', exact: true }).fill(attendanceDate);
    const attendanceSave = apiResponse(page, '/api/manager/hr/attendance', 'PUT');
    await page.getByRole('button', { name: 'Lưu chấm công' }).click();
    expect((await attendanceSave).status()).toBe(200);
    await expect(page.locator('tr').filter({ hasText: member.employeeCode })).toContainText(attendanceDate);

    const report = apiResponse(page, '/api/manager/hr/reports', 'GET');
    await page.goto(`${MANAGER_ORIGIN}/manager/hr-reports`);
    expect((await report).status()).toBe(200);
    const approvedLeaveKpi = page.locator('.hr-kpi-grid article').filter({ hasText: 'Đang nghỉ được duyệt' });
    const resignationKpi = page.locator('.hr-kpi-grid article').filter({ hasText: 'Nghỉ việc trong kỳ' });
    await expect(approvedLeaveKpi.locator('b')).toHaveText('1');
    await expect(resignationKpi.locator('b')).toHaveText('1');
    const memberReportRow = page.locator('tr').filter({ hasText: member.employeeCode });
    await expect(memberReportRow).toContainText(`${member.fullName} cập nhật`);
    await expect(memberReportRow).toContainText('ANNUAL');
    await expect(memberReportRow).toContainText('Đại học');
    await expect(memberReportRow).toContainText('12.000.000');
    await expect(memberReportRow).toContainText(/\d+ tháng/);
    const educationSummary = page.locator('.hr-report-summaries article').filter({ hasText: 'Học vấn' });
    await expect(educationSummary).toContainText('Đại học');
    await expect(page.locator('.hr-report-summaries article').filter({ hasText: 'Lương tháng' })).toContainText('12.000.000');
    await expect(page.locator('.hr-report-summaries article').filter({ hasText: 'Thâm niên' })).toContainText('tháng');

    const payrollSettings = apiResponse(page, '/api/manager/hr/payroll-settings', 'GET');
    const payrollPeriods = apiResponse(page, '/api/manager/hr/payroll-periods', 'GET');
    await page.goto(`${MANAGER_ORIGIN}/manager/payroll`);
    expect((await payrollSettings).status()).toBe(409);
    await expect(page.locator('.hr-settings-form .admin-list-error')).toContainText('Chưa có đúng một bộ PAYROLL_RULES');
    expect((await payrollPeriods).status()).toBe(200);
    await page.getByRole('button', { name: 'Dùng cấu hình đề xuất 2026' }).click();
    const saveRules = apiResponse(page, '/api/manager/hr/payroll-settings', 'PUT');
    await page.getByRole('button', { name: 'Lưu cấu hình' }).click();
    expect((await saveRules).status()).toBe(201);
    const generatePayroll = apiResponse(page, '/api/manager/hr/payroll-periods', 'POST');
    await page.getByRole('button', { name: 'Tạo kỳ lương nháp' }).click();
    expect((await generatePayroll).status()).toBe(201);
    await expect(page.locator('.hr-period-actions')).toContainText('DRAFT');
    const reviewPayroll = apiResponse(page, `/api/manager/hr/payroll-periods/${year}/${month}/review`, 'POST');
    await page.getByRole('button', { name: 'Duyệt kỳ lương' }).click();
    expect((await reviewPayroll).status()).toBe(200);
    await expect(page.locator('.hr-period-actions')).toContainText('REVIEWED');
    const publishPayroll = apiResponse(page, `/api/manager/hr/payroll-periods/${year}/${month}/publish`, 'POST');
    await page.getByRole('button', { name: 'Công bố phiếu lương' }).click();
    expect((await publishPayroll).status()).toBe(200);
    await expect(page.locator('.hr-period-actions')).toContainText('PUBLISHED');

    const leaderSession = await signIn(leaderPage, leader.email, EMPLOYEE_PASSWORD);
    const teamResponse = await leaderPage.request.get(`${API_ORIGIN}/api/manager/me/team`, {
      headers: { Authorization: `Bearer ${leaderSession.accessToken}` },
    });
    expect(teamResponse.status()).toBe(200);
    await leaderPage.goto(`${MANAGER_ORIGIN}/manager/my-team`);
    await expect(leaderPage.locator('.admin-page-heading h1')).toHaveText('Nhân viên trong nhóm');
    await expect(leaderPage.locator('.hr-team-roster')).toContainText(member.employeeCode);
    await expect(leaderPage.locator('.hr-team-roster')).toContainText(`${member.fullName} cập nhật`);

    await memberPage.addInitScript(() => {
      window.__printSnapshots = [];
      window.print = () => {
        const list = document.querySelector('.hr-payslip-list');
        window.__printSnapshots.push({
          className: list?.className || '',
          targetCount: list?.querySelectorAll('.is-print-target').length || 0,
          slipCount: list?.querySelectorAll('.hr-payslip').length || 0,
        });
      };
    });
    const payslips = apiResponse(memberPage, '/api/manager/me/payslips', 'GET');
    await memberPage.goto(`${MANAGER_ORIGIN}/manager/my-payslips`);
    expect((await payslips).status()).toBe(200);
    await expect(memberPage.locator('.hr-payslip').filter({ hasText: member.employeeCode })).toContainText('PUBLISHED');
    await memberPage.locator('.hr-payslip').filter({ hasText: member.employeeCode }).getByRole('button', { name: 'In phiếu tháng' }).click();
    await memberPage.waitForFunction(() => window.__printSnapshots?.length === 1);
    expect(await memberPage.evaluate(() => window.__printSnapshots[0])).toMatchObject({ targetCount: 1, slipCount: 1 });
    expect((await memberPage.evaluate(() => window.__printSnapshots[0].className))).toContain('hr-print-monthly');
    await memberPage.getByRole('button', { name: `In bảng lương năm ${year}` }).click();
    await memberPage.waitForFunction(() => window.__printSnapshots?.length === 2);
    expect(await memberPage.evaluate(() => window.__printSnapshots[1])).toMatchObject({ targetCount: 0, slipCount: 1 });
    expect((await memberPage.evaluate(() => window.__printSnapshots[1].className))).toContain('hr-print-annual');
  } finally {
    await memberPage.close();
    await leaderPage.close();
    await resigneePage.close();
  }
});
