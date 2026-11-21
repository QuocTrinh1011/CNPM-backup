import { expect, test } from '@playwright/test';
import { E2E_PASSWORD, MANAGER_WAREHOUSE_EMAIL } from './credentials.js';

const MANAGER_ORIGIN = 'http://localhost:5175';
const PRODUCT_NAME = 'E2E Playwright Tee';
const MATERIAL_QUANTITY = 24;
const QUANTITY_PER_PRODUCT = 2.5;
const PLAN_TARGET = 4;

const apiResponse = (page, path, method) => page.waitForResponse(response =>
  new URL(response.url()).pathname === path && response.request().method() === method,
);

async function signIn(page) {
  await page.goto(`${MANAGER_ORIGIN}/manager/login`);
  await page.getByLabel('EMAIL').fill(MANAGER_WAREHOUSE_EMAIL);
  await page.getByLabel('MẬT KHẨU').fill(E2E_PASSWORD);
  const login = apiResponse(page, '/api/manager/auth/login', 'POST');
  await page.getByRole('button', { name: /ĐĂNG NHẬP QUẢN LÝ/i }).click();
  const response = await login;
  expect(response.status(), await response.text()).toBe(200);
}

test('warehouseManagerReceivesMaterialDefinesRecipeAndAssignsProductionPlan', async ({ page }) => {
  test.setTimeout(90_000);
  const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
  const suffix = runId.replaceAll('-', '').slice(-12).toUpperCase();
  const supplierCode = `SUP${suffix}`;
  const supplierName = `Nhà cung cấp nguyên liệu ${runId}`;
  const materialCode = `RM${suffix}`;
  const materialName = `Vải kiểm thử ${runId}`;

  await signIn(page);

  await page.goto(`${MANAGER_ORIGIN}/manager/stock-receipts`);
  await expect(page.locator('.stock-page-heading h2')).toHaveText('Nhập kho');
  await page.getByRole('button', { name: '+ Thêm nhà cung cấp' }).click();
  await page.getByLabel('Mã nhà cung cấp').fill(supplierCode);
  await page.getByLabel('Tên nhà cung cấp').fill(supplierName);
  const supplierCreated = apiResponse(page, '/api/manager/suppliers', 'POST');
  await page.getByRole('button', { name: 'Lưu nhà cung cấp' }).click();
  const supplierResponse = await supplierCreated;
  expect([200, 201]).toContain(supplierResponse.status());
  const supplier = await supplierResponse.json();
  await expect(page.locator('.stock-form-meta select')).toContainText(supplierName);

  const materialsLoaded = apiResponse(page, '/api/manager/raw-materials', 'GET');
  await page.goto(`${MANAGER_ORIGIN}/manager/materials`);
  expect((await materialsLoaded).status()).toBe(200);
  await page.getByLabel('Mã nguyên liệu').fill(materialCode);
  await page.getByLabel('Tên nguyên liệu').fill(materialName);
  await page.getByLabel('Đơn vị tính').fill('m');
  const materialCreated = apiResponse(page, '/api/manager/raw-materials', 'POST');
  await page.getByRole('button', { name: 'Lưu nguyên liệu' }).click();
  const materialResponse = await materialCreated;
  expect(materialResponse.status(), await materialResponse.text()).toBe(201);
  const material = await materialResponse.json();
  expect(material.availableQuantity).toBe(0);
  const materialRow = page.locator('tr').filter({ hasText: materialCode });
  await expect(materialRow).toBeVisible();

  await page.getByRole('tab', { name: 'Phiếu nhập nguyên liệu' }).click();
  await page.getByLabel('Nhà cung cấp').selectOption({ label: `${supplierCode} · ${supplierName}` });
  await page.getByLabel('Nguyên liệu', { exact: true }).selectOption(String(material.id));
  await page.getByLabel('Số lượng nhập').fill(String(MATERIAL_QUANTITY));
  await page.getByLabel('Đơn giá nhập').fill('25000');
  await page.getByLabel('Ghi chú').fill(`playwright receipt ${runId}`);
  const receiptCreated = apiResponse(page, '/api/manager/raw-material-receipts', 'POST');
  await page.getByRole('button', { name: 'Xác nhận nhập nguyên liệu' }).click();
  const receiptResponse = await receiptCreated;
  expect(receiptResponse.status(), await receiptResponse.text()).toBe(201);
  const receipt = await receiptResponse.json();
  expect(receipt.receiptCode).toBeTruthy();
  expect(receipt.supplierId).toBe(supplier.id);
  expect(receipt.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ materialId: material.id, quantity: MATERIAL_QUANTITY }),
  ]));
  await expect(page.locator('.warehouse-notice[role="status"]')).toContainText(receipt.receiptCode);

  await page.getByRole('tab', { name: 'Danh mục nguyên liệu' }).click();
  await expect(materialRow.locator('td').nth(3)).toHaveText(new RegExp(`^${MATERIAL_QUANTITY}(?:\\.000)?$`));

  await page.goto(`${MANAGER_ORIGIN}/manager/recipes`);
  const productPicker = page.getByLabel('Sản phẩm');
  await expect(productPicker).toContainText(PRODUCT_NAME);
  const productId = await productPicker.locator('option').filter({ hasText: PRODUCT_NAME }).getAttribute('value');
  const existingRecipe = page.waitForResponse(response =>
    new URL(response.url()).pathname === `/api/manager/products/${productId}/recipe`
      && response.request().method() === 'GET',
  );
  await productPicker.selectOption(productId);
  expect((await existingRecipe).status()).toBe(200);
  await page.getByLabel('Nguyên liệu dòng 1').selectOption(String(material.id));
  await page.getByLabel('Định mức dòng 1').fill(String(QUANTITY_PER_PRODUCT));
  const recipeSaved = apiResponse(page, `/api/manager/products/${productId}/recipe`, 'PUT');
  await page.getByRole('button', { name: 'Lưu phiên bản công thức' }).click();
  const recipeResponse = await recipeSaved;
  expect(recipeResponse.status(), await recipeResponse.text()).toBe(200);
  const recipe = await recipeResponse.json();
  expect(recipe.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ materialId: material.id, quantityPerProduct: QUANTITY_PER_PRODUCT }),
  ]));
  await expect(page.getByRole('status')).toContainText(`phiên bản công thức ${recipe.version}`);

  const plansLoaded = apiResponse(page, '/api/manager/production-plans', 'GET');
  await page.goto(`${MANAGER_ORIGIN}/manager/production-plans`);
  expect((await plansLoaded).status()).toBe(200);
  await page.getByRole('button', { name: 'Tạo kế hoạch sản xuất' }).click();
  await page.getByLabel('Sản phẩm').selectOption({ label: PRODUCT_NAME });
  await page.getByLabel('Số lượng cần sản xuất').fill(String(PLAN_TARGET));
  const employeeSelect = page.getByLabel('Nhân viên kho phụ trách');
  const employeeOption = employeeSelect.locator('option').filter({ hasText: 'E2E-WAREHOUSE-STAFF' });
  const employeeId = await employeeOption.getAttribute('value');
  expect(employeeId).toBeTruthy();
  await employeeSelect.selectOption(employeeId);
  await page.getByLabel('Ghi chú').fill(`playwright plan ${runId}`);
  const planCreated = apiResponse(page, '/api/manager/production-plans', 'POST');
  await page.getByRole('button', { name: 'Lưu kế hoạch' }).click();
  const planResponse = await planCreated;
  expect(planResponse.status(), await planResponse.text()).toBe(201);
  const plan = await planResponse.json();
  expect(plan.targetQuantity).toBe(PLAN_TARGET);
  expect(plan.recipeVersion).toBe(recipe.version);
  expect(plan.assignedEmployeeId).toBe(Number(employeeId));
  expect(plan.materials).toEqual(expect.arrayContaining([
    expect.objectContaining({
      materialId: material.id,
      quantityPerProduct: QUANTITY_PER_PRODUCT,
      requiredQuantity: QUANTITY_PER_PRODUCT * PLAN_TARGET,
    }),
  ]));
  const planRow = page.locator('tr').filter({ hasText: plan.planCode });
  await expect(planRow).toBeVisible();
  await expect(planRow).toContainText(PRODUCT_NAME);
  await expect(planRow).toContainText(String(PLAN_TARGET));
  await expect(planRow).toContainText('Chờ thực hiện');
});
