import { expect, test } from '@playwright/test';
import { E2E_PASSWORD, MANAGER_SALES_EMAIL, MANAGER_WAREHOUSE_EMAIL } from './credentials.js';

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

async function expectRouteAndApi(page, path, heading, apiPath) {
  const response = page.waitForResponse(request =>
    new URL(request.url()).pathname === apiPath && request.request().method() === 'GET',
  );
  await page.goto(`${MANAGER_ORIGIN}${path}`);
  const result = await response;
  expect(result.status(), `${apiPath}: ${await result.text()}`).toBe(200);
  await expect(page.locator('.admin-page-heading h1')).toHaveText(heading);
}

test('Sales manager loads orders, invoices, vouchers, promotion campaigns, and reports', async ({ page }) => {
  await signIn(page, MANAGER_SALES_EMAIL);
  await expectRouteAndApi(page, '/manager/orders', 'Đơn hàng', '/api/manager/orders');
  await expectRouteAndApi(page, '/manager/invoices', 'Hóa đơn', '/api/manager/orders');
  await expectRouteAndApi(page, '/manager/vouchers', 'Voucher', '/api/manager/vouchers');
  await expectRouteAndApi(page, '/manager/promotions', 'Chiến dịch khuyến mãi', '/api/manager/promotions');
  await expectRouteAndApi(page, '/manager/reports', 'Báo cáo', '/api/manager/reports');
  await expect(page.getByRole('heading', { name: 'Xu hướng thu chi' })).toBeVisible();
});

test('Warehouse manager creates a supplier and opens warehouse reports', async ({ page }) => {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
  const supplierCode = `E2E-${id}`;
  const supplierName = `Nhà cung cấp E2E ${id}`;
  await signIn(page, MANAGER_WAREHOUSE_EMAIL);

  await page.goto(`${MANAGER_ORIGIN}/manager/stock-receipts`);
  await expect(page.locator('.stock-page-heading h2')).toHaveText('Nhập kho');
  await page.getByRole('button', { name: '+ Thêm nhà cung cấp' }).click();
  await page.getByLabel('Mã nhà cung cấp').fill(supplierCode);
  await page.getByLabel('Tên nhà cung cấp').fill(supplierName);
  const supplierResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/manager/suppliers' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Lưu nhà cung cấp' }).click();
  expect([200, 201]).toContain((await supplierResponse).status());
  await expect(page.locator('.stock-form-meta select')).toContainText(supplierName);

  await expectRouteAndApi(page, '/manager/warehouse-reports', 'Báo cáo kho', '/api/manager/warehouse/reports');
});
