# Warehouse and Production Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auditable raw-material, production, finished-goods transfer, and warehouse reporting workflows to the existing Manager portal.

**Architecture:** Keep `products.stock` as storefront sellable stock, and add distinct raw-material available stock, plan-allocated material, and warehouse finished stock. Route every new balance change and all existing sellable-stock changes through an append-only inventory movement ledger; enforce warehouse manager and warehouse employee permissions in backend services and the Manager UI.

**Tech Stack:** Java 21, Spring Boot 3.4, Spring Data JPA, PostgreSQL, H2 integration tests, React 19, Vite, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-16-warehouse-management-design.md`

## Global Constraints

- Keep the existing single `/manager` portal and login flow.
- Backend authorization is required; hiding a menu item alone is not authorization.
- Only HR-maintained `employee_profiles.work_area = WAREHOUSE` grants warehouse employee access; never infer access from `job_title`.
- Approved raw-material requests transfer quantities from available stock to the assigned production plan; production consumes allocated stock, and unused allocation must be returned before plan closure.
- Finished-goods approval moves quantity from warehouse finished stock to existing sellable `products.stock`; checkout continues to reduce sellable stock.
- Record every committed stock balance change in the append-only `inventory_movements` ledger in the same transaction as the balance update.
- Use decimal quantities for raw materials and integer quantities for finished units; reject negative balances and duplicate decisions/postings.
- Report periods use `Asia/Ho_Chi_Minh`; history starts at the migration cutover, with current sellable product stock recorded as opening balances.
- Add migration `026_warehouse_inventory_and_production.sql`; do not edit earlier migrations or modify the active `cnpm` database.
- Do not add dependencies or change unrelated portal, checkout, HR, or payroll behavior.

## Review Focus

- **Employee scope:** A valid Employee token with `GENERAL` or `SALES` work area, or a warehouse employee assigned to another plan, must not read or mutate warehouse data. Pin this in Tasks 2 and 5.
- **Concurrent stock decisions:** Two approvals against the same material/product balance must not overspend it, and a repeated decision must not post a second movement. Pin this in Tasks 3, 5, and 6.
- **Recipe changes:** A plan created on recipe version N must keep its N consumption after version N+1 is activated. Pin this in Task 4.
- **Decimal and unit limits:** Raw-material quantities retain three decimal places in the material's catalog unit; finished product quantities remain whole numbers. Pin this in Task 3.
- **Period cutover:** Opening + incoming - outgoing must reconcile at month, quarter, and year boundaries in Vietnam time; pre-cutover periods must not be presented as complete history. Pin this in Task 7.

---

### Task 1: Warehouse schema, migration, and demo profile assignment

**Files:**
- Create: `database/migrations/026_warehouse_inventory_and_production.sql`
- Create: `database/migrations/tests/026_warehouse_inventory_and_production_postconditions.sql`
- Modify: `database/schema.sql`
- Modify: `database/seed/seed_data.sql`
- Modify: `database/migrations/README.md`
- Modify: `database/README.md`

**Interfaces:**
- Add `employee_profiles.work_area VARCHAR(20) NOT NULL DEFAULT 'GENERAL' CHECK (work_area IN ('GENERAL','SALES','WAREHOUSE'))`.
- Add raw materials and receipts; versioned product recipes; production plans and per-plan recipe/material snapshots; material issue requests; production runs/consumption; material returns; finished-goods issue requests; warehouse finished balances; and append-only inventory movements. A database trigger rejects `UPDATE` and `DELETE` on `inventory_movements`; corrections use compensating rows.
- `inventory_movements` stores `item_type`, `item_id`, `location`, nullable `scope_id`, `quantity_delta`, `quantity_after`, `movement_type`, `reference_type`, `reference_id`, nullable actor snapshot for migration-created opening rows, and `created_at`. `scope_id` is a foreign key to `production_plans(id)` only for `PRODUCTION_ALLOCATED` location; global locations require null scope.
- Use `NUMERIC(15,3)` for material quantities and `INTEGER` for finished product quantities. Keep current product stock as sellable stock.
- Snapshot each existing `products.quantity_remaining` (Java `Product.stock`) value as a sellable `OPENING` movement exactly once when migration 026 runs. New warehouse finished stock begins at zero.
- Seed existing `nvkho01@shop.com`–`nvkho03@shop.com` profiles with `work_area='WAREHOUSE'`; other employee profiles remain `GENERAL` unless explicitly assigned.

- [x] **Step 1: Add failing PostgreSQL postcondition assertions** for work-area constraint/default, required tables/foreign keys/indexes, nonnegative balances, movement immutability prerequisites, and one opening movement per product.
- [x] **Step 2: Run the postconditions against a scratch database before migration 026** and confirm they fail for the missing schema.
- [x] **Step 3: Add the migration and fresh-install schema** with checks, indexes, unique request/decision keys, non-cascading historical rows, and opening sellable-stock snapshots. Keep all stock tables transactional.
- [x] **Step 4: Update the demo seed** to assign the three warehouse employees explicitly and record opening movements for seeded products added after the fresh-install schema snapshot; never add a second opening movement on upgrade databases. Keep repeated seed execution idempotent and demo credentials marked local-only.
- [x] **Step 5: Document migration 026, dependencies, cutover reporting limits, and backup-first rollout** in database READMEs.
- [x] **Step 6: Verify both PostgreSQL paths in disposable databases**: load the pre-026 schema from `git show HEAD:database/schema.sql` and apply migration 026 in an upgrade database; load the working-tree `schema.sql` in a fresh-install database; run postconditions and two seed passes on both. Verify opening snapshots, constraints, and exactly three warehouse work areas. Do not connect to or write to `cnpm`.
- [x] **Step 7: Commit** as `feat(warehouse): add inventory and production schema`.

### Task 2: Employee work area and backend authorization

**Files:**
- Modify: `backend/src/main/java/com/cnpm/clothingstore/entity/EmployeeProfile.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/dto/hr/CreateEmployeeRequest.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/dto/hr/UpdateEmployeeRequest.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/dto/hr/EmployeeProfileDto.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/service/ManagerEmployeeService.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/service/AuditTrail.java`
- Create: `backend/src/main/java/com/cnpm/clothingstore/service/WarehouseEmployeeAccessService.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/security/ManagerRoleAccessPolicy.java`
- Test: `backend/src/test/java/com/cnpm/clothingstore/service/ManagerEmployeeIntegrationTest.java`
- Test: `backend/src/test/java/com/cnpm/clothingstore/security/ManagerRoleAccessPolicyTest.java`
- Test: `backend/src/test/java/com/cnpm/clothingstore/service/WarehouseEmployeeAccessIntegrationTest.java`

**Interfaces:**
- HR create/update DTOs and profile response expose `workArea` with allowed values `GENERAL`, `SALES`, `WAREHOUSE`; absent values normalize to `GENERAL`.
- `WarehouseEmployeeAccessService.requireWarehouseEmployee()` resolves the authenticated account and current employee profile from the database; it rejects missing, inactive, non-Employee, or non-warehouse profiles.
- Manager routes are allowed by role `MANAGER_WAREHOUSE`; Employee warehouse routes are admitted by role policy only as `EMPLOYEE`, then every controller/service call invokes the work-area and ownership check.

- [x] **Step 1: Add failing employee integration tests** for HR assigning/clearing a work area, response serialization, default `GENERAL`, and employee profile updates being unable to change work area.
- [x] **Step 2: Add failing access tests** proving `GENERAL` and `SALES` employees are forbidden and a warehouse employee is identified from database profile state, not JWT-supplied data or title text.
- [x] **Step 3: Implement work-area persistence and DTO validation** in the HR employee module.
- [x] **Step 4: Implement `WarehouseEmployeeAccessService`** and add explicit `/api/manager/warehouse/**` role-policy rules while leaving unknown routes denied.
- [x] **Step 5: Run `mvn -q -Dtest=ManagerEmployeeIntegrationTest,ManagerRoleAccessPolicyTest,WarehouseEmployeeAccessIntegrationTest test`**; all focused tests pass, including employee profile ownership checks.
- [x] **Step 6: Commit** as `feat(warehouse): scope employee access by work area`.

### Task 3: Raw-material catalog, receipts, and movement writer

**Files:**
- Create: `backend/src/main/java/com/cnpm/clothingstore/entity/RawMaterial.java`
- Create: `backend/src/main/java/com/cnpm/clothingstore/entity/RawMaterialReceipt.java`
- Create: `backend/src/main/java/com/cnpm/clothingstore/entity/RawMaterialReceiptItem.java`
- Create: matching repositories under `backend/src/main/java/com/cnpm/clothingstore/repository/`
- Create: `backend/src/main/java/com/cnpm/clothingstore/service/InventoryMovementService.java`
- Create: `backend/src/main/java/com/cnpm/clothingstore/service/RawMaterialService.java`
- Create: `backend/src/main/java/com/cnpm/clothingstore/service/RawMaterialReceiptService.java`
- Create: `backend/src/main/java/com/cnpm/clothingstore/controller/RawMaterialController.java`
- Create: `backend/src/main/java/com/cnpm/clothingstore/controller/RawMaterialReceiptController.java`
- Test: `backend/src/test/java/com/cnpm/clothingstore/service/RawMaterialReceiptIntegrationTest.java`

**Interfaces:**
- Manager endpoints: `GET/POST /api/manager/raw-materials`, `PUT /api/manager/raw-materials/{id}`, `GET/POST /api/manager/raw-material-receipts`, `GET /api/manager/raw-material-receipts/{id}`.
- Receipt body: `{ supplierId, receivedAt, note, items: [{ materialId, quantity, unitCost }] }`; duplicate material lines are rejected and each line uses the catalog unit.
- Material code and unit are immutable after catalog creation because they identify historical ledger and recipe quantities; HR/warehouse users may update material name and active state.
- `InventoryMovementService.recordChange(InventoryItemType itemType, long itemId, InventoryLocation location, Long scopeId, BigDecimal delta, BigDecimal balanceAfter, MovementType movementType, String referenceType, long referenceId)` records one balance change. `recordTransfer(InventoryItemType itemType, long itemId, InventoryLocation from, Long fromScope, BigDecimal fromAfter, InventoryLocation to, Long toScope, BigDecimal toAfter, BigDecimal quantity, MovementType type, String referenceType, long referenceId)` records balanced source/destination rows in the same transaction. Both require an existing transaction and obtain actor identity from the authenticated server context.
- Locations: `RAW_MATERIAL_AVAILABLE`, `PRODUCTION_ALLOCATED` (scoped by plan ID), `FINISHED_WAREHOUSE`, and `SELLABLE`.

- [x] **Step 1: Add failing receipt tests** for successful supplier receipt and ledger creation, invalid/duplicate lines, unknown/inactive supplier or material, excessive decimal precision, and overflow-safe totals.
- [x] **Step 2: Add a concurrency test** proving simultaneous receipts/allocations preserve the exact locked available balance.
- [x] **Step 3: Implement catalog validation and pessimistic row locking** for raw-material balance updates.
- [x] **Step 4: Implement receipt posting** so stock balance, receipt lines, and movement ledger commit or roll back together.
- [x] **Step 5: Run `mvn -q -Dtest=RawMaterialReceiptIntegrationTest test`**; quantity deltas and ending balances match receipt lines exactly.
- [x] **Step 6: Commit** as `feat(warehouse): receive raw materials`.

### Task 4: Versioned recipes and assigned production plans

**Files:**
- Create: `backend/src/main/java/com/cnpm/clothingstore/entity/ProductRecipe.java`
- Create: `backend/src/main/java/com/cnpm/clothingstore/entity/ProductRecipeItem.java`
- Create: `backend/src/main/java/com/cnpm/clothingstore/entity/ProductionPlan.java`
- Create: `backend/src/main/java/com/cnpm/clothingstore/entity/ProductionPlanMaterial.java`
- Create: matching repositories and DTOs under `backend/src/main/java/com/cnpm/clothingstore/`
- Create: `backend/src/main/java/com/cnpm/clothingstore/service/ProductRecipeService.java`
- Create: `backend/src/main/java/com/cnpm/clothingstore/service/ProductionPlanService.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/service/ManagerEmployeeService.java` and `backend/src/main/java/com/cnpm/clothingstore/repository/EmployeeProfileRepository.java` to serialize HR work-area changes/offboarding with plan assignment.
- Create: `backend/src/main/java/com/cnpm/clothingstore/controller/ProductRecipeController.java`
- Create: `backend/src/main/java/com/cnpm/clothingstore/controller/ProductionPlanController.java`
- Test: `backend/src/test/java/com/cnpm/clothingstore/service/ProductionPlanIntegrationTest.java`

**Interfaces:**
- Manager endpoints: `GET/PUT /api/manager/products/{productId}/recipe`, `GET/POST /api/manager/production-plans`, and `GET /api/manager/production-plans/{id}`.
- `PUT recipe` creates a new immutable recipe version; it does not rewrite prior versions. Each plan copies the selected recipe lines and unit quantities into `production_plan_materials`.
- Plan create body: `{ productId, targetQuantity, assignedEmployeeId, dueDate, note }`. Plan is accepted only for an active product with an active recipe and an active Employee whose `work_area` is `WAREHOUSE`.
- Plan states: `PLANNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`; only a manager can assign or cancel, and completion requires no outstanding allocated materials.

- [x] **Step 1: Add failing tests** for recipe validation/version increment, duplicate materials, positive per-unit quantities, plan creation snapshots, invalid employee assignment, and inactive product rejection.
- [x] **Step 2: Add the recipe-change regression test**: after a plan snapshots recipe version N, activating N+1 leaves the plan requirement and its future consumption based on N.
- [x] **Step 3: Implement immutable recipe versions and plan material snapshots** with transactional creation.
- [x] **Step 4: Implement manager plan assignment, list, detail, and cancellation transitions** with audit events.
- [x] **Step 5: Run `mvn -q -Dtest=ProductionPlanIntegrationTest test`**; all plans retain recipe/version and employee assignment data.
- [x] **Step 6: Commit** as `feat(warehouse): add recipes and production plans`.

### Task 5: Material requests, production posting, and returns

**Files:**
- Create: `backend/src/main/java/com/cnpm/clothingstore/entity/MaterialIssueRequest.java` and request item entity
- Create: `backend/src/main/java/com/cnpm/clothingstore/entity/ProductionRun.java` and consumption entity
- Create: `backend/src/main/java/com/cnpm/clothingstore/entity/MaterialReturn.java` and return item entity
- Create: `backend/src/main/java/com/cnpm/clothingstore/service/WarehouseWorkService.java`
- Create: `backend/src/main/java/com/cnpm/clothingstore/controller/WarehouseEmployeeController.java`
- Create: `backend/src/main/java/com/cnpm/clothingstore/controller/WarehouseApprovalController.java`
- Create: `backend/src/test/java/com/cnpm/clothingstore/service/WarehouseWorkIntegrationTest.java`

**Interfaces:**
- Employee endpoints: `GET /api/manager/warehouse/me/plans`, `GET/POST /api/manager/warehouse/me/material-requests`, `POST /api/manager/warehouse/me/plans/{planId}/production-runs`, and `POST /api/manager/warehouse/me/plans/{planId}/material-returns`.
- Manager endpoints: `GET /api/manager/warehouse/material-requests`, `PATCH /api/manager/warehouse/material-requests/{id}/decision`, `GET /api/manager/warehouse/material-returns`, and `PATCH /api/manager/warehouse/material-returns/{id}/decision`.
- Request/return decision body: `{ decision: 'APPROVE'|'REJECT', note }`; full request is decided atomically, and a decided request cannot be decided again.
- Issue approval transfers available material to the plan allocation. Production posting consumes the snapshotted recipe amount for its integer output quantity and increases finished-warehouse balance. Material return approval transfers unused allocation back to available stock.
- Every employee method verifies current `WAREHOUSE` work area, authenticated identity, assigned plan ownership, active employment, and remaining plan quantity.

- [x] **Step 1: Add failing tests** for employee-only request ownership, manager-only approval, reject-without-stock-change, approve-once, insufficient available material, request exceeding remaining BOM need, and non-warehouse employee denial.
- [x] **Step 2: Add failing production tests** for exact decimal recipe consumption, plan target enforcement, insufficient allocation, production movement, and no partial balance change on failure.
- [x] **Step 3: Add failing return tests** for return quantities bounded by unconsumed allocation and plan closure blocked until all material is consumed or returned.
- [x] **Step 4: Implement request transitions, production posting, and return approvals** through `WarehouseWorkService`; lock material, plan, and balance rows in stable ID order.
- [x] **Step 5: Run `mvn -q -Dtest=WarehouseWorkIntegrationTest test`** and confirm ledger rows reconcile to each resulting balance.
- [x] **Step 6: Commit** as `feat(warehouse): approve materials and record production`.

### Task 6: Finished-goods transfer and sellable-stock ledger integration

**Files:**
- Create: `backend/src/main/java/com/cnpm/clothingstore/entity/FinishedGoodsIssueRequest.java` and item entity
- Create: `backend/src/main/java/com/cnpm/clothingstore/service/FinishedGoodsTransferService.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/service/StockReceiptService.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/service/AdminProductService.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/service/OrderService.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/service/StockService.java`
- Test: existing product/receipt/order integration suites and `backend/src/test/java/com/cnpm/clothingstore/service/FinishedGoodsTransferIntegrationTest.java`

**Interfaces:**
- Employee endpoint: `GET/POST /api/manager/warehouse/me/finished-goods-requests`.
- Manager endpoints: `GET /api/manager/warehouse/finished-goods-requests` and `PATCH /api/manager/warehouse/finished-goods-requests/{id}/decision`.
- On approval, `warehouse_finished_stock` decreases and `products.quantity_remaining` (Java `Product.stock`) increases by the same integer quantity; both movements reference the same decision. Rejection changes no balances.
- Existing sellable stock writers call the same movement writer: product creation/stock adjustment, stock receipt, order checkout reservation, and `StockService.release` on cancel/expiry. The ledger's `SELLABLE` balance must reconcile to `products.quantity_remaining` (`Product.stock`) after every operation.

- [x] **Step 1: Add failing tests** for transfer request ownership/approval/rejection/repeated decision, insufficient warehouse finished stock, and equal opposite transfer ledger deltas.
- [x] **Step 2: Add failing regression assertions** to product creation/adjustment, stock receipt, checkout, and order-release tests so each sellable stock mutation has one matching `SELLABLE` movement. Coverage is grouped in the dedicated `FinishedGoodsTransferIntegrationTest` to verify end-to-end balance reconciliation across all of these operations.
- [x] **Step 3: Implement finished-goods request approval** using ordered row locks and idempotent state transition.
- [x] **Step 4: Route all existing sellable stock increases/decreases through `InventoryMovementService`** without changing order/payment behavior.
- [x] **Step 5: Run the focused receipt, product, order, and transfer tests**; verify sellable movement sums equal persisted `products.stock` and checkout/cancel remains behaviorally unchanged.
- [x] **Step 6: Commit** as `feat(warehouse): transfer finished goods to sale`.

### Task 7: Monthly, quarterly, and yearly inventory reports

**Files:**
- Create: `backend/src/main/java/com/cnpm/clothingstore/dto/warehouse/WarehouseReportDto.java`
- Create: `backend/src/main/java/com/cnpm/clothingstore/service/WarehouseReportService.java`
- Create: `backend/src/main/java/com/cnpm/clothingstore/controller/WarehouseReportController.java`
- Test: `backend/src/test/java/com/cnpm/clothingstore/service/WarehouseReportIntegrationTest.java`

**Interfaces:**
- `GET /api/manager/warehouse/reports?period=MONTH|QUARTER|YEAR&year=YYYY&month=1..12&quarter=1..4` is available only to `MANAGER_WAREHOUSE`.
- Return period bounds, opening/incoming/outgoing/closing quantity by material and product, and totals grouped by movement type/location. Include `historyAvailableFrom` equal to the migration cutover date.
- Boundaries are local-calendar start/end in `Asia/Ho_Chi_Minh`, converted to `[fromInclusive, toExclusive)` instants. Aggregate directly from `inventory_movements` with SQL.

- [x] **Step 1: Add failing tests** for month/quarter/year validation, January UTC+7 boundary, leap-day month totals, cutover disclosure, zero-movement items, and `opening + incoming - outgoing = closing` for each location.
- [x] **Step 2: Implement typed period parsing and SQL aggregation** without loading movement rows into memory.
- [x] **Step 3: Run `mvn -q -Dtest=WarehouseReportIntegrationTest test`** and cross-check values against hand-built movement fixtures.
- [x] **Step 4: Commit** as `feat(warehouse): report inventory movements`.

### Task 8: Manager warehouse screens

**Files:**
- Modify: `frontend/src/api/manager-api.js`
- Modify: `frontend/src/app/ManagerApp.jsx`
- Modify: `frontend/src/features/manager/ManagerEmployees.jsx`
- Create: `frontend/src/features/manager/WarehouseMaterials.jsx` and colocated test
- Create: `frontend/src/features/manager/WarehouseRecipes.jsx` and colocated test
- Create: `frontend/src/features/manager/WarehouseProductionPlans.jsx` and colocated test
- Create: `frontend/src/features/manager/WarehouseApprovals.jsx` and colocated test
- Create: `frontend/src/features/manager/styles/warehouse-workspace.css`
- Modify: `frontend/src/features/manager/ManagerEmployees.test.jsx`
- Modify: `frontend/src/app/ManagerApp.test.jsx`

**Interfaces:**
- Add role-filtered manager sections for `materials`, `recipes`, `production-plans`, `warehouse-approvals`, and `warehouse-reports`; only `MANAGER_WAREHOUSE` receives them.
- HR employee form selects `GENERAL`, `SALES`, or `WAREHOUSE`; changing employee work area does not modify system account role.
- Manager APIs use `adminApi` and explicit `adminEndpoints` entries; loading/error/retry and mutation feedback follow existing Manager page patterns.

- [x] **Step 1: Add failing Vitest coverage** for Manager Warehouse navigation, HR work-area assignment, material/receipt validation, recipe version edit, plan assignment, and approval result states.
- [x] **Step 2: Add `adminEndpoints` entries** for all manager endpoints defined in Tasks 3–7.
- [x] **Step 3: Implement materials/receipt, recipe, production-plan, and approval pages** with accessible labels and the existing Manager table/form patterns.
- [x] **Step 4: Add role-filtered routes/sidebar and work-area selector** without changing other role navigation or product/order pages.
- [x] **Step 5: Run focused tests, `npx vitest run`, and `npx vite build --mode manager`**; HR, Sales, and non-warehouse Employee do not see Warehouse manager sections.
- [x] **Step 6: Commit** as `feat(warehouse): add manager warehouse workspace`.

### Task 9: Warehouse employee workspace

**Files:**
- Create: `frontend/src/features/manager/WarehouseEmployeeWorkspace.jsx`
- Create: `frontend/src/features/manager/WarehouseEmployeeWorkspace.test.jsx`
- Modify: `frontend/src/app/ManagerApp.jsx`
- Modify: `frontend/src/app/ManagerApp.test.jsx`
- Modify: `frontend/src/features/manager/styles/warehouse-workspace.css`

**Interfaces:**
- Warehouse employees receive `warehouse-tasks` only when `employeeProfile.workArea === 'WAREHOUSE'`; all employees retain their current self-service sections.
- The workspace consumes assigned-plan, material request, production-run, material-return, and finished-goods request endpoints from Task 5/6. It never accepts an employee ID from UI state for ownership.

- [x] **Step 1: Add failing tests** for warehouse-only navigation, assigned-plan display, material request, production quantity posting, return request, finished-goods transfer request, and hidden/blocked routes for other employee work areas.
- [x] **Step 2: Implement the employee task workspace** with server-derived identity, request status history, validation feedback, and retryable loading states.
- [x] **Step 3: Run `npx vitest run src/features/manager/WarehouseEmployeeWorkspace.test.jsx src/app/ManagerApp.test.jsx`** and verify existing employee profile/leave/attendance/payroll screens remain accessible.
- [x] **Step 4: Commit** as `feat(warehouse): add employee production tasks`.

### Task 10: Warehouse reports UI

**Files:**
- Create: `frontend/src/features/manager/WarehouseReports.jsx`
- Create: `frontend/src/features/manager/WarehouseReports.test.jsx`
- Modify: `frontend/src/features/manager/styles/warehouse-workspace.css`
- Modify: `frontend/src/app/ManagerApp.jsx`

**Interfaces:**
- Page supports monthly, quarterly, and yearly selectors and displays the report cutover date.
- Tables separate available raw-material stock, allocated material by plan, finished goods in warehouse, and sellable product stock; movement totals reconcile with backend report DTO values.

- [x] **Step 1: Add failing UI tests** for period selection/query construction, report table values, cutover disclosure, loading/error/retry, and empty data.
- [x] **Step 2: Implement `WarehouseReports`** using one request per selected period and no polling.
- [x] **Step 3: Run focused report tests, `npx vitest run`, and Manager build.**
- [x] **Step 4: Commit** as `feat(warehouse): add inventory reports screen`.

### Task 11: Documentation and full verification

**Files:**
- Modify: `README.md`
- Modify: `frontend/README.md`
- Modify: `database/README.md`
- Modify: `database/migrations/README.md`
- Modify: `docs/superpowers/specs/2026-11-16-warehouse-management-design.md`
- Modify: `GLOSSARY.md`

- [x] **Step 1: Document** employee work-area permissions, material/production/finished-stock transfer semantics, migration 026 backup and rollout, and report cutover in the relevant READMEs.
- [x] **Step 2: Run the full backend suite** with `cd backend && mvn -q test`; 341 cases were discovered (337 passed, 4 skipped), with 0 failures/errors. The PostgreSQL tests were opt-in and skipped in that historical run: `AuditLogPostgresTest`, `CustomerActivityPostgresTest`, `CustomerLifecyclePostgresTest`, and `ManagerPostgresSmokeTest`. They now run automatically with an isolated Testcontainers PostgreSQL database.
- [x] **Step 3: Run frontend tests and all portal builds** with `cd frontend && npx vitest run && npx vite build --mode user && npx vite build --mode admin && npx vite build --mode manager`; 60 files / 399 tests passed, and all three builds succeeded.
- [x] **Step 4: Re-run PostgreSQL migration/seed verification in a disposable database** and compare the movement ledger to raw-material, finished-warehouse, and sellable balances; never run on `cnpm` without separate authorization. Upgrade and fresh-install paths, two current seed passes, migration postconditions, warehouse demo assignment and ledger balances passed on an isolated PostgreSQL 18 cluster.
- [x] **Step 5: Review `git diff --check`, verify no earlier migration or unrelated portal behavior changed, and inspect all role-policy rules for deny-by-default coverage.**
- [x] **Step 6: Commit** as `docs(warehouse): document stock and production workflows`.

## Execution notes

- Implement one task at a time; do not start a later task until the current task's tests pass and its commit is reviewed.
- Use H2 integration tests for normal backend behavior and PostgreSQL scratch-database checks for migration/constraint behavior.
- Before applying migration 026 to any shared or user database, take a verified backup. The only database used for automated migration checks is disposable.
- Do not silently reconstruct pre-migration product history; expose the ledger cutover date in report responses and UI.

## Baseline before Task 1

- Run `cd backend && mvn -q test` and record pass/fail counts plus any PostgreSQL-dependent failures caused by unavailable services.
- Run `cd frontend && npx vitest run && npx vite build --mode user && npx vite build --mode admin && npx vite build --mode manager`; record test counts and each build result.
- Confirm the working tree contains only the approved design/glossary/plan files before implementation begins.
