import { expect, test } from '@playwright/test';

const uniqueId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

test('customer registers, saves delivery address, and completes a COD order', async ({ page }) => {
  const id = uniqueId();
  const email = `customer-${id}@example.test`;
  const fullName = `Khách E2E ${id}`;
  const phone = `09${String(Date.now()).slice(-8)}`;

  await page.goto('http://localhost:5173/dang-ky');
  await page.getByLabel('HỌ VÀ TÊN').fill(fullName);
  await page.getByLabel('SỐ ĐIỆN THOẠI').fill(phone);
  await page.getByLabel('EMAIL').fill(email);
  await page.getByLabel('MẬT KHẨU').fill('Customer123');
  const registerResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/auth/register' && response.request().method() === 'POST',
  );
  const loginResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/auth/login' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'TẠO TÀI KHOẢN →' }).click();
  expect((await registerResponse).status()).toBe(201);
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL('http://localhost:5173/');

  await page.goto('http://localhost:5173/tai-khoan/dia-chi');
  await page.getByRole('button', { name: /Thêm địa chỉ mới/ }).click();
  await page.getByLabel('TÊN GỢI NHỚ').fill('Địa chỉ E2E');
  await page.getByLabel('NGƯỜI NHẬN').fill(fullName);
  await page.getByLabel('SỐ ĐIỆN THOẠI').last().fill(phone);
  await page.locator('.shop-address-editor input[autocomplete="street-address"]').fill('12 Đường E2E');
  await page.locator('select[id$="-province"]').selectOption({ index: 1 });
  await page.locator('select[id$="-ward"]').selectOption({ index: 1 });
  const addressResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/customers/me/addresses' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'LƯU ĐỊA CHỈ' }).click();
  expect((await addressResponse).status()).toBe(201);
  await expect(page.getByRole('region', { name: 'Địa chỉ của tôi' }).getByText(fullName)).toBeVisible();

  await page.goto('http://localhost:5173/san-pham');
  const product = page.getByRole('button', { name: 'Xem chi tiết E2E Playwright Tee', exact: true });
  await expect(product).toBeVisible();
  await product.click();
  await expect(page.getByRole('heading', { name: 'E2E Playwright Tee' })).toBeVisible();
  await page.getByRole('button', { name: 'MUA NGAY' }).click();
  await expect(page.getByRole('heading', { name: 'Hoàn tất đơn hàng' })).toBeVisible();
  await expect(page.getByText(fullName)).toBeVisible();

  const orderResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/orders' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'ĐẶT HÀNG' }).click();
  const placedOrder = await orderResponse;
  expect(placedOrder.status()).toBeGreaterThanOrEqual(200);
  expect(placedOrder.status()).toBeLessThan(300);
  const order = await placedOrder.json();
  await expect(page.getByRole('heading', { name: `Đơn hàng #${order.order.orderCode}` })).toBeVisible();
  await page.reload();
  await page.goto('http://localhost:5173/don-hang');
  await expect(page.getByText(order.order.orderCode)).toBeVisible();
});
