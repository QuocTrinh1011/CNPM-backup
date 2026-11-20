# Manager Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Restore a Manager reports page for captured income, stock-receipt expense, product-variant sales, customer purchases, and receipt activity by employee.

**Architecture:** Add a read-only `/api/manager/reports` endpoint that aggregates orders and posted stock receipts in PostgreSQL with `NamedParameterJdbcTemplate`. Add a focused Manager feature page that requests one API payload per year/month filter, and link it from the existing Manager shell.

**Tech Stack:** Spring Boot 3.4, Java, PostgreSQL, Spring JDBC, React, Vite, existing Manager API/hooks, CSS.

**Spec:** `docs/superpowers/specs/2026-11-15-manager-reports-design.md`

## Global Constraints

- Do not add a database migration or schema field; migration 020 removed legacy reporting columns, including `paid_at` and `salesperson_id`.
- Count non-canceled orders with `payment_status = 'PAID'`, or COD orders with non-null `cod_collected_at`.
- Use `created_at` for non-COD paid orders and `COALESCE(cod_collected_at, created_at)` for COD income period dates.
- Calculate all period instants in `Asia/Ho_Chi_Minh`; use `[from, to)` boundaries.
- Group products by `(product_id, color, size)` and rank by `SUM(quantity * unit_price)` descending.
- Group expenses by posted receipt `received_at`; group employees by receipt `created_by`, with unresolved creators under “Hệ thống / Không xác định”.
- Do not add a chart library or restore care, support, task, or refund reporting.
- Keep year and month in `/manager/reports` query parameters; default to the current year and all months.

## Review Focus

- Invalid year or month is rejected before SQL execution; owned by Task 1 input validation.
- COD collected across a local calendar boundary is assigned by `cod_collected_at`; owned by Task 1 period predicates.
- December/January UTC timestamps map to Vietnam calendar periods correctly; owned by Task 1 boundaries.
- Null color and size remain separate valid variant groups; owned by Task 1 product aggregation.
- Null/unresolved receipt creator remains included in expense and employee totals; owned by Task 1 employee aggregation.

---

### Task 1: Add the Manager reports aggregation API

**Files:**
- Create: `backend/src/main/java/com/cnpm/clothingstore/service/ManagerReportsService.java`
- Create: `backend/src/main/java/com/cnpm/clothingstore/controller/ManagerReportsController.java`
- Create: `backend/src/test/java/com/cnpm/clothingstore/service/ManagerReportsServiceTest.java`
- Modify: `backend/src/test/java/com/cnpm/clothingstore/service/ManagerQueryIntegrationTest.java` (exercise SQL aggregation with H2 PostgreSQL mode)

**Interfaces:**
- `ManagerReportsController.get(@RequestParam(required=false) Integer year, @RequestParam(required=false) Integer month): ManagerReportsService.ReportView`
- `ManagerReportsService.report(Integer year, Integer month): ReportView`
- `ReportView(int year, Integer month, List<Integer> availableYears, Summary summary, List<TrendBucket> trend, List<ProductVariant> topProducts, List<CustomerSpend> topCustomers, List<EmployeeActivity> employeeActivities)`
- `Summary(BigDecimal totalIncome, BigDecimal totalExpense, BigDecimal netBalance, long paidOrdersCount, long stockReceiptsCount)`
- `TrendBucket(String label, BigDecimal income, BigDecimal expense)`
- `ProductVariant(Long productId, String productName, String categoryName, String color, String size, long quantitySold, BigDecimal totalRevenue)`
- `CustomerSpend(Long customerId, String fullName, String email, long orderCount, BigDecimal totalSpent)`
- `EmployeeActivity(Long employeeId, String fullName, String email, long receiptCount, BigDecimal totalReceiptCost)`
- `periodWindow(Integer year, Integer month, Clock clock): PeriodWindow`, where `PeriodWindow(int year, Integer month, Instant fromInclusive, Instant toExclusive)` is a package-private pure helper used by report queries.
- `trendBuckets(int year, Integer month): List<TrendBucket>`, which zero-fills annual months or local calendar days. Annual labels are `Tháng 1`…`Tháng 12`; monthly labels are `dd/MM`.

- [ ] **Step 1: Write the failing date helper unit tests**

Create `ManagerReportsServiceTest` covering Vietnam-local year/month bounds, annual `Tháng N` labels, daily `dd/MM` labels including leap February, and invalid year/month rejection. Initially resolve the planned helper methods reflectively so the red-phase test compiles before `ManagerReportsService` exists; after implementing the helper signatures, refactor the shipped test to call the package-private methods directly.

- [ ] **Step 2: Run the new tests and confirm they fail for the missing helpers**

Run `cd backend && mvn -q -Dtest=ManagerReportsServiceTest test`. Expected: failures identify the missing period-window and trend-bucket behavior; test compilation succeeds.

- [ ] **Step 3: Implement year/month validation and period bounds**

Default missing year to the current `Asia/Ho_Chi_Minh` year; accept month `null` for annual view and 1–12 for monthly view. Reject years outside 1900–9999 and months outside 1–12 with the project's `ApiException` bad-request pattern. Compute inclusive `from` and exclusive `to` `Instant` values from Vietnam-local calendar boundaries. After helpers exist, keep the test type-safe with direct calls.

- [ ] **Step 4: Implement summary and year options queries**

Aggregate non-canceled captured order income using the spec's COD/non-COD date expression; aggregate posted receipt cost by `received_at`. Return counts, `netBalance = totalIncome - totalExpense`, and distinct transaction years with the current year first and remaining years descending.

- [ ] **Step 5: Implement zero-filled trend buckets**

For annual view, emit `Tháng 1` through `Tháng 12`. For monthly view, emit `dd/MM` labels from day 1 through the month's actual last day, including zero-income/zero-expense buckets. Group both income and expense SQL results by their period bucket and fill absent dates with zero.

- [ ] **Step 6: Implement product, customer, and employee aggregates**

Use captured orders for top customers and product variants. Group product rows by product ID, color, and size; include category name and sort by total revenue descending. Return the ten highest-revenue product variants and ten highest-spend customers. Use a left join for receipt creators and group null/unresolved creators under “Hệ thống / Không xác định”; return every employee group so activity totals reconcile to total expense.

- [x] **Step 7: Add the protected controller route and verify backend**

Expose `GET /api/manager/reports` under `/api/manager/**`; rely on the existing `AdminAccessGuard` for authenticated Manager access. Run `cd backend && mvn -q -Dtest=ManagerReportsServiceTest test` and `mvn -q -DskipTests compile`; confirm the new endpoint compiles without schema changes.

- [x] **Step 8: Commit the backend API**

```bash
git add backend/src/main/java/com/cnpm/clothingstore/service/ManagerReportsService.java backend/src/main/java/com/cnpm/clothingstore/controller/ManagerReportsController.java backend/src/test/java/com/cnpm/clothingstore/service/ManagerReportsServiceTest.java
git commit -m "feat(reports): add manager report aggregation API"
```

### Task 2: Build the Manager reports page

**Files:**
- Modify: `frontend/src/api/manager-api.js`
- Create: `frontend/src/features/manager/ManagerReports.jsx`
- Create: `frontend/src/features/manager/manager-reports.css`
- Create: `frontend/src/features/manager/ManagerReports.test.jsx`

**Interfaces:**
- Add `adminEndpoints.reports({ year, month })`, returning `/api/manager/reports` with encoded year and optional month query parameters.
- `ManagerReports({ location, go })` reads `year` and optional `month` from `location`, loads through `adminApi` in an abortable `useEffect`, and uses `go` to update URL filters. Do not use `useAdminList` because it polls every five seconds and this aggregate endpoint should load only when filters change or the user retries.

- [x] **Step 1: Add the reports endpoint helper**

First write `ManagerReports.test.jsx` for the initial year/month filters, the default popular-products view, combobox switching to customer/employee detail without another API request, URL filter updates, and retry after an API error. Run the focused Vitest test and confirm it fails because the feature page does not exist. Then add and verify the reports endpoint helper.

Serialize year/month as query parameters and omit month for annual view.

- [x] **Step 2: Build filter controls and summary cards**

Render year and month selectors; default to the current year/all months; preserve unrelated query parameters when changing filters. Render total income, stock-receipt expense, and net balance using `manager-data.js` currency formatting. Offer a manual retry button after request failure.

- [x] **Step 3: Build the trend visualization and report-type combobox**

Render a lightweight CSS bar chart for each monthly/daily bucket. Show popular product variants by default. Add a report-type combobox to switch the detail panel to top customers or stock-receipt activity by employee, including the system/unknown label and recorded color/size. Use the already-loaded report payload for every view. Provide loading, retryable error, empty-period, and empty-table states.

- [x] **Step 4: Add responsive light/dark styles**

Style the page in `manager-reports.css` using existing Manager theme variables. Keep cards and filter controls usable on narrow screens and allow wide tables to scroll horizontally.

- [x] **Step 5: Commit the page and API helper**

```bash
git add frontend/src/api/manager-api.js frontend/src/features/manager/ManagerReports.jsx frontend/src/features/manager/manager-reports.css frontend/src/features/manager/ManagerReports.test.jsx
git commit -m "feat(reports): add manager reports page"
```

### Task 3: Restore Manager navigation and URL route

**Files:**
- Modify: `frontend/src/app/ManagerApp.jsx`
- Modify: `frontend/src/app/ManagerApp.test.jsx` (update existing navigation/retired-route expectations; do not add a test file)

- [x] **Step 1: Register the report section and icon**

Add `reports` / “Báo cáo” to `navItems`, add a chart icon, and allow direct `/manager/reports` normalization.

- [x] **Step 2: Lazy-load the report feature**

Load `ManagerReports` with `React.lazy` and render it for the `reports` section, passing the current location and `go` callback. Keep all retired modules and routes retired.

- [x] **Step 3: Align existing Manager route expectations**

Update the existing tests that currently expect “Báo cáo” to be absent and `/manager/reports` to redirect. Retain the retired-route expectations for care, personal tasks, and support tickets.

- [x] **Step 4: Commit the Manager route**

```bash
git add frontend/src/app/ManagerApp.jsx frontend/src/app/ManagerApp.test.jsx
git commit -m "feat(reports): restore manager reports navigation"
```

### Task 4: Update documentation and verify portal builds

**Files:**
- Modify: `frontend/README.md`

- [x] **Step 1: Document the Manager report page and definitions**

Replace statements that say Manager has no report screen; explain the new read-only income/stock-receipt report and its data limits, including employee activity being based on stock receipt creators. Leave the root migration history unchanged because it correctly documents the historical removal in migration 020.

- [x] **Step 2: Build every Vite mode and backend compilation**

Run `cd backend && mvn -q test`, `cd frontend && npm test`, `npx vite build --mode user`, `npx vite build --mode admin`, and `npx vite build --mode manager`. All commands must exit successfully; report any PostgreSQL-only test that is skipped or blocked because the environment lacks a database.

- [x] **Step 3: Review the final diff and commit documentation**

Confirm no SQL schema/migration, care/support/task, refund, or checkout changes were introduced, and `git diff --check` is clean.

```bash
git add frontend/README.md
git commit -m "docs(reports): describe manager reporting"
```

## Execution Notes

- The backend and frontend share the exact response record names in Task 1; do not create parallel frontend-only aggregation rules.
- This report restores only sales and inventory reporting. It does not reinstate legacy care, support, personal-task, or refund APIs removed by migration 020.
- The user requested a focused backend unit test for time boundaries, trend buckets, and validation; update existing Manager navigation expectations because their prior report-removal assertions become obsolete.
