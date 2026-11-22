# MRP Workflow Playwright Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for native execution, or `superpowers:subagent-driven-development` if the user explicitly chooses delegated execution. Steps use checkbox syntax.

**Goal:** Prove the material-to-production-to-finished-goods workflow and period reports through Playwright on isolated data.

**Architecture:** Reuse the existing Warehouse Manager and Warehouse Employee pages plus the guarded E2E PostgreSQL database. Add one cohesive Chromium workflow that checks state changes across receipts, recipes, plans, employee actions, approvals, and reports; fix production code only when an assertion exposes a defect.

**Tech Stack:** Playwright, React, Spring Boot, PostgreSQL, existing warehouse inventory ledger.

**Spec:** `docs/superpowers/specs/2026-11-21-mrp-workflow-playwright-design.md`

## Global Constraints

- Use only the disposable local database named `crm_e2e`; never point Playwright at the shop database.
- Preserve role separation between Warehouse Manager and Warehouse Employee.
- Reuse existing E2E role fixtures and plan/material fixtures where possible; create uniquely named run data for receipts and requests.
- Keep the existing single-worker Playwright configuration because inventory fixtures are shared.

## Review Focus

- A receipt must increase available raw-material balance exactly by received quantity.
- A recipe's per-product quantities must be multiplied by the plan target, not completed quantity.
- A pending material request must not change stock until manager approval.
- A production run must consume allocated material once and add the same output quantity to finished stock.
- Finished-goods transfer approval must decrease finished stock once; reject/duplicate action must not double-decrement.
- MONTH, QUARTER, and YEAR filters must use the expected local calendar boundaries and corresponding query parameters.

---

### Task 1: Add a manager receipt/recipe/plan Playwright workflow

**Files:**
- Create: `frontend/e2e/mrp-workflows.spec.js`
- Create: `backend/src/main/java/com/cnpm/clothingstore/controller/WarehouseEmployeeDirectoryController.java`
- Create: `backend/src/main/java/com/cnpm/clothingstore/dto/warehouse/WarehouseEmployeeOptionDto.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/repository/EmployeeProfileRepository.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/service/ManagerEmployeeService.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/security/ManagerRoleAccessPolicy.java`
- Modify: `frontend/src/api/manager-api.js`
- Modify: `frontend/src/features/manager/WarehouseProductionPlans.jsx`
- Test: `backend/src/test/java/com/cnpm/clothingstore/service/ManagerEmployeeIntegrationTest.java`
- Test: `backend/src/test/java/com/cnpm/clothingstore/security/ManagerRoleAccessPolicyTest.java`
- Test: `frontend/src/features/manager/WarehouseProductionPlans.test.jsx`
- Reference: `frontend/src/features/manager/WarehouseMaterials.jsx`
- Reference: `frontend/src/features/manager/WarehouseRecipes.jsx`
- Reference: `frontend/src/features/manager/WarehouseProductionPlans.jsx`

- [x] **Step 1: Write the failing Playwright scenario** `warehouseManagerReceivesMaterialDefinesRecipeAndAssignsProductionPlan`.

  Sign in as `MANAGER_WAREHOUSE_EMAIL`; create a unique supplier through the existing supplier UI; receive a unique raw-material quantity; assert the receipt response and increased available balance; save a product recipe; create a plan assigned to the existing active warehouse employee; assert target and required material quantities.

- [x] **Step 2: Run the focused Chromium scenario and verify it fails at the first unmet behavior**

  Run from `frontend`: `npm run test:e2e -- --project=chromium e2e/mrp-workflows.spec.js` with `E2E_DATABASE_URL` set only to the guarded local `crm_e2e` database.

- [x] **Step 3: Fix only defects exposed by the manager scenario**

  Preserve supplier validation, raw-material receipt accounting, recipe versioning, and plan assignment rules.

- [x] **Step 4: Verify the manager scenario passes**

  Re-run the focused spec and assert receipt balance and plan material requirements from rendered UI/API results.

- [x] **Step 5: Commit the manager workflow task**

  Commit the E2E spec and only production files required by a reproduced failure.

### Task 2: Add employee production and manager approval coverage

**Files:**
- Modify or create: `frontend/e2e/mrp-workflows.spec.js`
- Reference: `frontend/src/features/manager/WarehouseEmployeeWorkspace.jsx`
- Reference: `frontend/src/features/manager/WarehouseApprovals.jsx`
- Reference: `backend/src/test/java/com/cnpm/clothingstore/service/WarehouseWorkIntegrationTest.java`

- [x] **Step 1: Add the scenario** `warehouseEmployeeRequestsMaterialProducesAndRequestsFinishedGoodsTransfer`.

  Sign in with the warehouse employee fixture, assert the assigned plan, submit a positive material request and confirm the balance stays unchanged while pending. Sign in as warehouse manager, approve the request, and assert the request is approved and allocated balance changes. Return as the employee, record a valid production run, submit a finished-goods transfer request, then approve it as the manager and assert the finished balance decreases once.

- [x] **Step 2: Run the focused scenario and check each workflow transition**

  The focused E2E run confirmed the existing pending/approved behavior, so no product defect needed to be introduced before the coverage change.

  Run: `npm run test:e2e -- --project=chromium e2e/mrp-workflows.spec.js`.

- [x] **Step 3: Fix only the defect identified by the state transition**

  Check pending-versus-approved movement timing, plan quantity limits, and duplicate decision handling before changing code.

- [x] **Step 4: Verify employee and manager states pass end to end**

  Re-run the scenario; assert request codes, approval notices, plan totals, and inventory balances after each decision.

- [x] **Step 5: Commit the employee/approval workflow task**

  Commit the test and any necessary minimal workflow fix.

### Task 3: Verify warehouse reports across all periods

**Files:**
- Modify: `frontend/e2e/mrp-workflows.spec.js`
- Reference: `frontend/src/features/manager/WarehouseReports.jsx`
- Test reference: `backend/src/test/java/com/cnpm/clothingstore/service/WarehouseReportIntegrationTest.java`

- [x] **Step 1: Add report assertions** `warehouseReportsRequestMonthQuarterAndYearPeriods`.

  Select a year/month and assert `period=MONTH&year=...&month=...`; select each quarter and assert `period=QUARTER&year=...&quarter=...`; select annual and assert `period=YEAR&year=...`. For a period containing the workflow movement, assert the visible material and finished-goods movement totals.

- [x] **Step 2: Run the focused scenario and check the UI/API period and movement results**

  Run: `npm run test:e2e -- --project=chromium e2e/mrp-workflows.spec.js`.

- [x] **Step 3: Fix only incorrect period selection or report rendering found by the test**

  The only failure was an incorrect expected label in the test (`2026` instead of the rendered `Năm 2026`); no product code change was needed.

- [x] **Step 4: Verify the full MRP Chromium spec passes**

  Re-run the focused spec. Preserve the backend's existing calendar-boundary integration tests.

- [x] **Step 5: Commit the period-report task**

  Commit only the E2E spec and any minimal report UI fix.

## Verification

- Existing focused backend coverage: `mvn -q -Dtest=RawMaterialReceiptIntegrationTest,ProductionPlanIntegrationTest,WarehouseWorkIntegrationTest,WarehouseReportIntegrationTest test`.
- MRP E2E: `npm run test:e2e -- --project=chromium e2e/mrp-workflows.spec.js` against local disposable `crm_e2e` only.
- Full Chromium E2E suite after workflow changes: `npm run test:e2e -- --project=chromium`.
