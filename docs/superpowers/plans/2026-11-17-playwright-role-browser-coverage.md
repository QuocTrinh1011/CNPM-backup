# Playwright Role and Browser Coverage Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Keep tests and database operations restricted to the guarded local `crm_e2e` database.

**Goal:** Run full-stack Playwright journeys for every portal role in Chromium, Firefox, and WebKit against Spring Boot and a disposable PostgreSQL database.

**Architecture:** Keep the existing full-stack Playwright harness. Extend it to start all three Vite portals, seed role-specific fixtures into the already guarded E2E database, and run browser projects against the real API. Separate role journeys into specs and make writes unique/idempotent. CI installs and executes the same three browser engines.

**Tech Stack:** Playwright Test, Vite, Spring Boot, PostgreSQL, GitHub Actions.

**Approved design:** `docs/superpowers/specs/2026-11-17-playwright-role-browser-coverage-design.md`

## Task 1: Enable all portals and browser projects

**Files:** `frontend/playwright.config.js`

1. Add Playwright projects for Chromium, Firefox, and WebKit.
2. Add the Admin Vite server at `http://localhost:5174` alongside the existing User and Manager servers.
3. Add port 5174 to the E2E backend's `CORS_ORIGINS` so Admin login and API requests use the same backend.
4. Preserve the guarded PostgreSQL URL and `create-drop` E2E configuration. Do not point tests to the developer database.
5. Serialize shared-database mutation tests, or ensure every created record has a unique run/browser identifier.

**Verification:** Run `npx playwright test --list` and confirm the projects enumerate all three browser engines and the existing tests still collect.

## Task 2: Seed isolated accounts and employee fixtures

**Files:** `frontend/e2e/global-setup.js`, `frontend/e2e/credentials.js`

1. Add named credentials for Admin, Manager Sales, Manager Warehouse, Manager HR, Employee Sales, Employee Warehouse, and Employee Team Lead.
2. Use a single non-production E2E password and bcrypt hashes. Upsert only the accounts with the reserved `@crm.test` E2E addresses.
3. Create/refresh `employee_profiles` fixtures for employee accounts with distinct employee codes, `work_area`, hire date, salary fields, and `STAFF` or `TEAM_LEAD` permission profile. Link the Team Lead fixture to a subordinate.
4. Verify every fixture's role, lock/deleted state, profile, and password hash during global setup; fail with a targeted error if a fixture is incomplete.
5. Do not seed production/demo accounts or execute seed data against the E2E database.

**Verification:** Run the setup against disposable `crm_e2e`, query the fixture role/profile rows, and rerun setup to prove it is idempotent.

## Task 3: Cover portal login, landing, and role boundaries

**Files:** `frontend/e2e/auth.spec.js`, `frontend/e2e/role-access.spec.js` (new)

1. Keep and run the customer registration/session-refresh test in all three browser projects.
2. Add Admin login through `/admin/login` and assert the account-management page loads.
3. Add login and landing checks for Sales, Warehouse, HR, Employee Sales, Employee Warehouse, and Employee Team Lead.
4. For each internal persona, assert representative allowed navigation is visible, disallowed navigation is absent, and direct navigation to at least one forbidden Manager route returns to an allowed route.
5. From each internal role's browser session, call a representative forbidden backend endpoint and assert the documented `403` response. Assert shared product reads are available to Sales and Warehouse, while Warehouse writes are denied to Sales.
6. Assert Admin, customer, and Manager sessions remain portal-specific and do not silently cross-authenticate.

**Verification:** Run role-access specs in Chromium first while authoring, then run them in all three projects.

## Task 4: Cover core business workflows

**Files:** `frontend/e2e/customer-workflow.spec.js` (new), `frontend/e2e/admin-workflow.spec.js` (new), `frontend/e2e/manager-workflows.spec.js` (new), `frontend/e2e/employee-workflows.spec.js` (new)

1. Customer: register a unique account, browse a seeded product, add it to cart, complete COD checkout, and verify the resulting order/session after reload.
2. Admin: exercise account tabs and create an isolated internal/employee account; verify it appears in the matching group without touching reserved Admin fixtures.
3. Sales: load Orders, Invoices, Promotions/Vouchers, and Reports; verify their key API responses succeed and assert the visible route title/content.
4. Warehouse: read products, create a unique supplier or stock receipt through the UI, and load warehouse reports. Use unique fixture names and avoid relying on mutable shared inventory quantities.
5. HR and Employee: submit a leave request as an employee, review it as HR, and verify the updated state in the employee view; load attendance, payroll/payslips, and HR reports using the isolated employee fixtures.
6. Employee Warehouse: load assigned warehouse work and submit one isolated material or finished-goods request; verify a Warehouse Manager can see the request in approvals.
7. Use COD only; no real email, PayOS, or external service calls.

**Verification:** Run each new spec in Chromium with traces on failure; correct selectors and fixture dependencies without changing product logic.

## Task 5: Run the browser matrix in CI and document usage

**Files:** `.github/workflows/backend-check.yml`, `frontend/README.md`

1. Change the E2E setup step to install Chromium, Firefox, and WebKit (with Linux dependencies).
2. Keep the existing isolated PostgreSQL service and run `npm run test:e2e` as the full three-browser matrix.
3. Preserve failure artifact upload for Playwright report, traces, screenshots, and video.
4. Document required Docker/Java/Maven/Node versions, the three browser engines, `E2E_DATABASE_URL`, and the local run command. Explicitly state the suite only accepts local disposable `crm_e2e`.

**Verification:** Review workflow YAML and confirm the path filters still cause E2E to run for frontend/backend changes.

## Task 6: Final verification

1. With Docker running, start the disposable PostgreSQL service and set `E2E_DATABASE_URL` to its local `crm_e2e` database.
2. Install the browser engines using the documented command.
3. Run `npm run test:e2e` and record per-browser/per-role results.
4. Run `npm test` to ensure the existing Vitest suite remains green.
5. Inspect `git diff --check`, the Playwright HTML report, and the working tree. Confirm no E2E database URL or credentials target `cnpm`, a remote host, or real user accounts.

## Acceptance Criteria

- Playwright projects cover Chromium, Firefox, and WebKit.
- The User, Admin, and Manager development servers are started by the E2E harness.
- Customer, Admin, Manager Sales, Manager Warehouse, Manager HR, Employee Sales, Employee Warehouse, and Employee Team Lead fixtures can authenticate in the disposable database.
- Each role has a route/access check and representative API-backed workflow; forbidden UI routes and backend endpoints are checked.
- CI installs and runs all three browser projects and uploads failure artifacts.
- `npm run test:e2e` and `npm test` pass, or any environment-only failure is reported with the exact missing prerequisite and affected browser/role.
