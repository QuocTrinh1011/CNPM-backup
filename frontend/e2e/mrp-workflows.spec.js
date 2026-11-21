import { expect, test } from '@playwright/test';
import { E2E_PASSWORD, EMPLOYEE_WAREHOUSE_EMAIL, MANAGER_WAREHOUSE_EMAIL } from './credentials.js';

const MANAGER_ORIGIN = 'http://localhost:5175';
const API_ORIGIN = 'http://localhost:8082';
const PRODUCT_NAME = 'E2E Playwright Tee';
const MATERIAL_QUANTITY = 24;
const QUANTITY_PER_PRODUCT = 2.5;
const PLAN_TARGET = 4;

const apiResponse = (page, path, method) => page.waitForResponse(response =>
  new URL(response.url()).pathname === path && response.request().method() === method,
);

async function signIn(page, email = MANAGER_WAREHOUSE_EMAIL) {
  await page.goto(`${MANAGER_ORIGIN}/manager/login`);
  await page.getByLabel('EMAIL').fill(email);
  await page.getByLabel('MẬT KHẨU').fill(E2E_PASSWORD);
  const login = apiResponse(page, '/api/manager/auth/login', 'POST');
  await page.getByRole('button', { name: /ĐĂNG NHẬP QUẢN LÝ/i }).click();
  const response = await login;
  const responseText = await response.text();
  expect(response.status(), responseText).toBe(200);
  return JSON.parse(responseText);
}

async function rawMaterialBalance(page, accessToken, materialCode) {
  const response = await page.request.get(`${API_ORIGIN}/api/manager/raw-materials`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(response.status()).toBe(200);
  const materials = await response.json();
  const material = materials.find(row => row.code === materialCode);
  expect(material, `${materialCode} should exist in the raw-material directory`).toBeTruthy();
  return Number(material.availableQuantity);
}

async function finishedGoodsBalance(page, accessToken, productId) {
  const today = new Date();
  const params = new URLSearchParams({
    period: 'MONTH',
    year: String(today.getFullYear()),
    month: String(today.getMonth() + 1),
  });
  const response = await page.request.get(`${API_ORIGIN}/api/manager/warehouse/reports?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(response.status()).toBe(200);
  const report = await response.json();
  const balance = report.balances.find(row => row.itemType === 'PRODUCT'
    && row.itemId === productId && row.location === 'FINISHED_WAREHOUSE');
  expect(balance, `finished-goods balance for product ${productId} should be reported`).toBeTruthy();
  return Number(balance.closingQuantity);
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

test('warehouseEmployeeRequestsMaterialProducesAndRequestsFinishedGoodsTransfer', async ({ page, browser }) => {
  test.setTimeout(90_000);
  const managerPage = await browser.newPage();
  const marker = `warehouse-flow-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;

  try {
    const managerSession = await signIn(managerPage);
    const employeeSession = await signIn(page, EMPLOYEE_WAREHOUSE_EMAIL);
    const plansResponse = apiResponse(page, '/api/manager/warehouse/me/plans', 'GET');
    await page.goto(`${MANAGER_ORIGIN}/manager/warehouse-tasks`);
    expect((await plansResponse).status()).toBe(200);
    const plansPage = await plansResponse.then(response => response.json());
    const plan = plansPage.content.find(row => row.planCode === 'E2E-WAREHOUSE-PLAN');
    expect(plan).toBeTruthy();
    const planMaterial = plan.materials.find(row => row.materialCode === 'E2E-FABRIC');
    expect(planMaterial).toBeTruthy();
    expect(Number(planMaterial.requiredQuantity)).toBe(10);
    expect(Number(planMaterial.allocatedQuantity)).toBe(0);

    const availableBeforeRequest = await rawMaterialBalance(page, managerSession.accessToken, 'E2E-FABRIC');
    const planCard = page.locator('.warehouse-employee-plan').filter({ hasText: plan.planCode });
    await expect(planCard).toBeVisible();
    await planCard.getByRole('button', { name: `Đề nghị nguyên liệu ${plan.planCode}` }).click();
    await page.getByLabel(`Số lượng xin cấp ${planMaterial.materialName}`).fill('1');
    await page.locator('.warehouse-employee-form textarea').fill(`${marker} material issue`);
    const issueCreated = apiResponse(page, '/api/manager/warehouse/me/material-requests', 'POST');
    await page.getByRole('button', { name: 'Gửi đề nghị nguyên liệu' }).click();
    const issueResponse = await issueCreated;
    expect(issueResponse.status()).toBe(201);
    const issueRequest = await issueResponse.json();
    expect(issueRequest.status).toBe('PENDING');
    expect(issueRequest.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ planMaterialId: planMaterial.id, quantity: 1 }),
    ]));
    await expect(page.locator('.warehouse-employee-history[aria-label="Yêu cầu cấp nguyên liệu"]'))
      .toContainText(issueRequest.requestCode);
    await expect(page.locator('.warehouse-employee-history[aria-label="Yêu cầu cấp nguyên liệu"]'))
      .toContainText('Chờ duyệt');
    expect(await rawMaterialBalance(managerPage, managerSession.accessToken, 'E2E-FABRIC'))
      .toBe(availableBeforeRequest);

    const issueQueue = apiResponse(managerPage, '/api/manager/warehouse/material-requests', 'GET');
    await managerPage.goto(`${MANAGER_ORIGIN}/manager/warehouse-approvals`);
    expect((await issueQueue).status()).toBe(200);
    const issueCard = managerPage.locator('.warehouse-approval-card').filter({ hasText: issueRequest.requestCode });
    await expect(issueCard).toContainText('Chờ duyệt');
    await expect(issueCard).toContainText(`${marker} material issue`);
    const issueDecision = apiResponse(managerPage, `/api/manager/warehouse/material-requests/${issueRequest.id}/decision`, 'PATCH');
    await issueCard.getByRole('button', { name: `Duyệt ${issueRequest.requestCode}` }).click();
    const issueDecisionResponse = await issueDecision;
    expect(issueDecisionResponse.status()).toBe(200);
    expect((await issueDecisionResponse.json()).status).toBe('APPROVED');
    await expect(issueCard).toContainText('Đã duyệt');
    expect(await rawMaterialBalance(managerPage, managerSession.accessToken, 'E2E-FABRIC'))
      .toBe(availableBeforeRequest - 1);

    await page.reload();
    const allocatedPlansResponse = apiResponse(page, '/api/manager/warehouse/me/plans', 'GET');
    const allocatedPlans = await allocatedPlansResponse.then(response => response.json());
    const allocatedPlan = allocatedPlans.content.find(row => row.id === plan.id);
    expect(Number(allocatedPlan.materials.find(row => row.id === planMaterial.id).allocatedQuantity)).toBe(1);
    const updatedPlanCard = page.locator('.warehouse-employee-plan').filter({ hasText: plan.planCode });
    await expect(updatedPlanCard.locator('.warehouse-material-breakdown')).toContainText('Đã cấp 1');

    await updatedPlanCard.getByRole('button', { name: `Ghi nhận sản lượng ${plan.planCode}` }).click();
    await page.getByLabel('Số lượng hoàn thành').fill('1');
    await page.locator('.warehouse-employee-form textarea').fill(`${marker} production run`);
    const productionRun = apiResponse(page, `/api/manager/warehouse/me/plans/${plan.id}/production-runs`, 'POST');
    await page.getByRole('button', { name: 'Lưu sản lượng' }).click();
    const productionResponse = await productionRun;
    expect(productionResponse.status()).toBe(201);
    const run = await productionResponse.json();
    expect(run.producedQuantity).toBe(1);
    expect(run.consumptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ materialCode: 'E2E-FABRIC', quantity: 1 }),
    ]));
    const finishedBeforeTransfer = await finishedGoodsBalance(page, managerSession.accessToken, plan.productId);
    expect(finishedBeforeTransfer).toBe(1);

    await page.reload();
    const completedPlansResponse = apiResponse(page, '/api/manager/warehouse/me/plans', 'GET');
    const completedPlans = await completedPlansResponse.then(response => response.json());
    const completedPlan = completedPlans.content.find(row => row.id === plan.id);
    expect(completedPlan.completedQuantity).toBe(1);
    expect(completedPlan.status).toBe('IN_PROGRESS');
    const completedPlanCard = page.locator('.warehouse-employee-plan').filter({ hasText: plan.planCode });
    await expect(completedPlanCard).toContainText('Đang thực hiện');
    await expect(completedPlanCard.locator('.warehouse-material-breakdown')).toContainText('Đã dùng 1');

    await page.getByRole('button', { name: 'Đề nghị chuyển thành phẩm' }).click();
    await page.getByLabel('Sản phẩm cần chuyển').selectOption(String(plan.productId));
    await page.getByLabel('Số lượng chuyển').fill('1');
    await page.locator('form.warehouse-form-card textarea').fill(`${marker} finished goods`);
    const transferCreated = apiResponse(page, '/api/manager/warehouse/me/finished-goods-requests', 'POST');
    await page.getByRole('button', { name: 'Gửi đề nghị chuyển thành phẩm' }).click();
    const transferResponse = await transferCreated;
    expect(transferResponse.status()).toBe(201);
    const transferRequest = await transferResponse.json();
    expect(transferRequest.status).toBe('PENDING');
    await expect(page.locator('.warehouse-employee-history[aria-label="Yêu cầu chuyển thành phẩm"]'))
      .toContainText(transferRequest.requestCode);
    await expect(page.locator('.warehouse-employee-history[aria-label="Yêu cầu chuyển thành phẩm"]'))
      .toContainText('Chờ duyệt');
    expect(await finishedGoodsBalance(managerPage, managerSession.accessToken, plan.productId))
      .toBe(finishedBeforeTransfer);

    const finishedQueue = apiResponse(managerPage, '/api/manager/warehouse/finished-goods-requests', 'GET');
    await managerPage.getByRole('tab', { name: 'Yêu cầu xuất thành phẩm' }).click();
    expect((await finishedQueue).status()).toBe(200);
    const transferCard = managerPage.locator('.warehouse-approval-card').filter({ hasText: transferRequest.requestCode });
    await expect(transferCard).toContainText('Chờ duyệt');
    const transferDecision = apiResponse(managerPage, `/api/manager/warehouse/finished-goods-requests/${transferRequest.id}/decision`, 'PATCH');
    await transferCard.getByRole('button', { name: `Duyệt ${transferRequest.requestCode}` }).click();
    const transferDecisionResponse = await transferDecision;
    expect(transferDecisionResponse.status()).toBe(200);
    expect((await transferDecisionResponse.json()).status).toBe('APPROVED');
    await expect(transferCard).toContainText('Đã duyệt');

    const duplicateDecision = await managerPage.request.patch(
      `${API_ORIGIN}/api/manager/warehouse/finished-goods-requests/${transferRequest.id}/decision`,
      { headers: { Authorization: `Bearer ${managerSession.accessToken}` }, data: { decision: 'APPROVE', note: '' } },
    );
    expect(duplicateDecision.status()).toBe(400);
    expect(await finishedGoodsBalance(managerPage, managerSession.accessToken, plan.productId)).toBe(0);

    await page.reload();
    await expect(page.locator('.warehouse-employee-history[aria-label="Yêu cầu chuyển thành phẩm"]'))
      .toContainText('Đã duyệt');
  } finally {
    await managerPage.close();
  }
});
