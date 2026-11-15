# Manager Role Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Split Manager access into HR, Warehouse, and Sales roles with backend-enforced permissions, a directory-only Employee role, and role-specific Manager navigation.

**Architecture:** Keep one `/manager` portal and the separate `/admin` portal. A forward PostgreSQL migration adds the role values, maps legacy `MANAGER` accounts to `MANAGER_SALES`, and revokes their old refresh sessions. The backend uses one method-and-path policy as the authorization source; the frontend mirrors that policy for navigation and route handling.

**Tech Stack:** Spring Boot 3.4, Spring Data JPA, PostgreSQL, JUnit/MockMvc, React, Vite, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-15-manager-role-split-design.md`

## Global Constraints

- Keep one Manager portal at `/manager` and keep Admin at `/admin`.
- `MANAGER_HR`, `MANAGER_WAREHOUSE`, `MANAGER_SALES`, and `EMPLOYEE` are the new account roles; `EMPLOYEE` is directory-only and is not a refresh-token audience.
- Admin remains the only role that can create or change internal accounts and assign roles. HR receives read-only access to Employee records.
- Backend authorization is authoritative. Unknown `/api/manager/**` routes are denied by default.
- Existing `MANAGER` accounts become `MANAGER_SALES`; their old refresh sessions are revoked. Do not delete or rewrite existing audit log history.
- Warehouse owns product, supplier, and stock mutations. Sales can read product/category data for sales and promotion workflows.
- Do not add employee tables, payroll/personnel features, separate portals, or checkout discount behavior. Do not add dependencies.

## Review Focus

- A role change must invalidate existing refresh sessions and prevent old access tokens from retaining broader access; test an active token/session across a role change.
- `EMPLOYEE` must not authenticate through customer, Manager, or Admin login and must receive an unusable random password hash; test all login entry points and the persisted account.
- Product detail reads are shared while writes are Warehouse-only; test the same product path with `GET`, `PUT`, `DELETE`, stock `PATCH`, and supplier `PATCH` for each role.
- HR must see only active-directory `EMPLOYEE` rows and must not reach customer, warehouse, or sales APIs; test data filtering and forbidden cross-role calls.
- A signed-in role entering an unsupported URL must be redirected to its own landing page without mounting the restricted feature or issuing that feature's API request.

---

### Task 1: Add the role migration and fresh-schema constraints

**Files:**
- Create: `database/migrations/022_manager_role_split.sql`
- Modify: `database/schema.sql`

**Interfaces:**
- Produces the database role and refresh-audience constraints consumed by Tasks 2 and 3.

- [x] **Step 1: Prepare a PostgreSQL scratch-database migration check**

Use a disposable database initialized from the current pre-change `database/schema.sql`. Insert one `MANAGER` account and an active refresh token with audience `MANAGER` before applying the new migration.

- [x] **Step 2: Write and run post-migration assertions against the baseline**

In a temporary psql script, assert the desired account role and token state (`MANAGER_SALES`, revoked, `ROLE_MIGRATION`) and run it against the legacy fixture. Confirm it fails because the current database still has an active `MANAGER` account/token. Keep the script outside the repository.

- [x] **Step 3: Create the forward migration**

In one transaction, replace the role/audience check constraints, update every `customers.role = 'MANAGER'` to `MANAGER_SALES`, and mark every legacy `refresh_tokens.audience = 'MANAGER'` row `REVOKED` with reason `ROLE_MIGRATION`, a revocation timestamp, and audience `MANAGER_SALES`. Preserve token rows. Allow `CUSTOMER`, `ADMIN`, the three Manager roles, and `EMPLOYEE` in `customers.role`; allow `CUSTOMER`, `ADMIN`, and only the three Manager roles in `refresh_tokens.audience`.

- [x] **Step 4: Keep `database/schema.sql` consistent with the migrated schema**

Update its role and audience checks to the same allowed values as Step 3. Do not add `EMPLOYEE` to refresh audiences or change any other schema object.

- [x] **Step 5: Run the PostgreSQL migration check**

Apply the migration to the prepared scratch database and assert that the account is `MANAGER_SALES`, its token row is retained but revoked with the new audience/reason, all three Manager roles and `EMPLOYEE` pass the account check, and `EMPLOYEE`/legacy `MANAGER` fail the refresh-audience check.

- [x] **Step 6: Commit**

```bash
git add database/schema.sql database/migrations/022_manager_role_split.sql
git commit -m "feat(database): add manager role migration"
```

### Task 2: Enforce Manager role access and role-aware authentication

**Files:**
- Create: `backend/src/main/java/com/htttdn/crm/security/ManagerRoleAccessPolicy.java`
- Create: `backend/src/test/java/com/htttdn/crm/security/ManagerRoleAccessPolicyTest.java`
- Create: `backend/src/test/java/com/htttdn/crm/service/ManagerRoleSecurityIntegrationTest.java`
- Modify: `backend/src/main/java/com/htttdn/crm/security/AdminAccessGuard.java`
- Modify: `backend/src/main/java/com/htttdn/crm/service/ManagerAuthService.java`
- Modify: `backend/src/main/java/com/htttdn/crm/service/InternalAccountService.java`
- Modify: `backend/src/main/java/com/htttdn/crm/repository/UserRepository.java`
- Modify: `backend/src/main/java/com/htttdn/crm/service/PaymentCollectionService.java`
- Modify: `backend/src/main/java/com/htttdn/crm/service/ReturnManagementService.java`
- Modify: `backend/src/main/java/com/htttdn/crm/controller/AdminProductController.java`
- Modify: `backend/src/main/java/com/htttdn/crm/service/AdminProductService.java`
- Update Manager-role fixtures in the backend tests listed in Step 6.

**Interfaces:**
- `ManagerRoleAccessPolicy.rolesFor(String method, String path)` returns the allowed Manager roles for a known route, or an empty result for an unknown route; `allows(String role, String method, String path)` returns false for unknown routes.
- `AdminAccessGuard` keeps Admin behavior, checks Manager access through the policy, and records the authenticated account's actual role in the audit actor.
- Manager login, refresh, logout, and issued JWTs use the user's actual role, limited to the three Manager roles.

- [x] **Step 1: Write failing policy tests**

Cover the full route matrix: `GET /products`, `GET /products/categories`, and `GET /products/{id}` allow Sales and Warehouse; product `POST`, `PUT`, `DELETE`, stock `PATCH`, supplier `PATCH`, suppliers, and stock receipts allow Warehouse only; employees allow HR only; `/users/**`, `/orders/**` (including payment/return and the invoice UI's data), `/reports/**`, `/feedback/**`, `/surveys/**`, `/vouchers/**`, and `/promotions/**` allow Sales only; unknown paths and unsupported method/path pairs deny every role. Do not add a separate invoice endpoint.

- [x] **Step 2: Run the policy tests and confirm they fail**

Run: `cd backend && mvn -q -Dtest=ManagerRoleAccessPolicyTest test`

Expected: FAIL because `ManagerRoleAccessPolicy` does not exist.

- [x] **Step 3: Implement the explicit method-and-path policy**

Create the policy with specific product subpaths checked before the general product detail path. Preserve `/api/admin/**` as Admin-only and keep manager authentication routes outside the protected business-route policy.

- [x] **Step 4: Write failing authentication and MVC authorization tests**

Test that each Manager role can log in and refresh with its own JWT claim/audience; a role changed in the database invalidates the prior refresh session and access token; Sales can read product detail but cannot mutate it; Warehouse can mutate it; and an unknown Manager path returns forbidden for an authenticated Manager. HR route access and Employee login tests are added in Task 3 when that endpoint/account flow exists.

- [x] **Step 5: Run the integration tests and confirm they fail for the current single-role guard**

Run: `cd backend && mvn -q -Dtest=ManagerRoleSecurityIntegrationTest test`

Expected: FAIL on new roles and cross-role policy assertions.

- [x] **Step 6: Implement role-aware auth/guard and update affected test fixtures**

Update `ManagerAuthService` to accept only `MANAGER_HR`, `MANAGER_WAREHOUSE`, and `MANAGER_SALES`; bind refresh audience and JWT role to the account's current role and reject mismatches. Update `AdminAccessGuard` to call the policy and use the database role for audit identity. Add read-only `GET /api/manager/products/{id}` using the existing product lookup. Update route-using fixtures in `AuditLogIntegrationTest`, `CustomerActivityPostgresTest`, `CustomerOrderActivityIntegrationTest`, `CustomerLifecycleIntegrationTest`, `CustomerProfileIntegrationTest`, `ManagerQueryIntegrationTest`, `PaymentLifecycleIntegrationTest`, `ReturnConcurrencyTest`, `ReturnManagementIntegrationTest`, `SurveyRecipientGroupIntegrationTest`, and `VoucherIntegrationTest` to `MANAGER_SALES` or `MANAGER_WAREHOUSE` according to the endpoint exercised. Keep historical audit-log rows that intentionally use `MANAGER` unchanged.

- [x] **Step 7: Run backend policy/auth tests and the full suite**

Run: `cd backend && mvn -q -Dtest=ManagerRoleAccessPolicyTest,ManagerRoleSecurityIntegrationTest,AdminAccessGuardCoverageTest test`

Then run: `cd backend && mvn -q -DskipTests=false test`

Expected: all configured unit/integration tests pass; PostgreSQL-only tests are reported separately if their QA database is unavailable.

- [x] **Step 8: Commit**

```bash
git add backend/src/main/java/com/htttdn/crm/security/AdminAccessGuard.java backend/src/main/java/com/htttdn/crm/security/ManagerRoleAccessPolicy.java backend/src/main/java/com/htttdn/crm/service/ManagerAuthService.java backend/src/main/java/com/htttdn/crm/service/InternalAccountService.java backend/src/main/java/com/htttdn/crm/repository/UserRepository.java backend/src/main/java/com/htttdn/crm/controller/AdminProductController.java backend/src/main/java/com/htttdn/crm/service/AdminProductService.java backend/src/main/java/com/htttdn/crm/service/PaymentCollectionService.java backend/src/main/java/com/htttdn/crm/service/ReturnManagementService.java backend/src/test/java
git commit -m "feat(auth): enforce manager role scopes"
```

### Task 3: Add Admin-managed Employee accounts and HR directory API

**Files:**
- Create: `backend/src/main/java/com/htttdn/crm/controller/ManagerEmployeeController.java`
- Create: `backend/src/main/java/com/htttdn/crm/service/ManagerEmployeeService.java`
- Create: `backend/src/main/java/com/htttdn/crm/dto/manager/ManagerEmployeeDto.java`
- Create: `backend/src/test/java/com/htttdn/crm/service/InternalAccountRoleIntegrationTest.java`
- Modify: `backend/src/main/java/com/htttdn/crm/service/InternalAccountService.java`
- Modify: `backend/src/main/java/com/htttdn/crm/repository/UserRepository.java`
- Modify: `backend/src/main/java/com/htttdn/crm/service/DirectoryService.java`

**Interfaces:**
- `GET /api/manager/employees?q=&page=&size=` returns a paginated list of non-deleted `EMPLOYEE` rows, read-only, with existing directory fields and lock status.
- Admin account CRUD accepts only `ADMIN`, the three Manager roles, and `EMPLOYEE`; it remains the sole role assignment API.

- [x] **Step 1: Write failing account and directory integration tests**

Test Admin creation/listing of all allowed roles; Employee creation without a password; absence of password material in JSON; rejection of Employee login through customer, Manager, and Admin login; conversion from Employee to any login-capable role (`ADMIN` or Manager) requires a new password; Employee list filtering/search/pagination and read-only behavior; HR authorization; role change refresh-token revocation; overview count includes internal roles; preservation of last-Admin/self-change protections; and verify the employee response contains only ID, name, email, phone, and lock status.

- [x] **Step 2: Run the account integration test and confirm failure**

Run: `cd backend && mvn -q -Dtest=InternalAccountRoleIntegrationTest test`

Expected: FAIL because the existing account service rejects the new roles and the employee endpoint is absent.

- [x] **Step 3: Extend Admin account role handling**

Allow the three Manager roles and `EMPLOYEE`; include these roles in account listing and internal-account locking. For `EMPLOYEE`, ignore supplied passwords and store `encoder.encode(UUID.randomUUID().toString())`. If an Employee is changed to any login-capable role (`ADMIN` or a Manager role), require Admin to provide a new valid password. Preserve token revocation, audit, self-protection, and last-Admin behavior. Update Admin overview account counts to include all internal roles, including Employee.

- [x] **Step 4: Implement the read-only HR employee endpoint**

Add paginated, case-insensitive name/email search for non-deleted `EMPLOYEE` accounts only. Return a dedicated DTO with ID, name, email, phone, and lock status, excluding other account/profile fields. Do not add create/update/delete methods to this endpoint.

- [x] **Step 5: Run account tests and the backend suite**

Run: `cd backend && mvn -q -Dtest=InternalAccountRoleIntegrationTest,ManagerRoleSecurityIntegrationTest test`

Then run: `cd backend && mvn -q -DskipTests=false test`

Expected: account and directory tests pass and no existing Admin account protections regress.

- [x] **Step 6: Commit**

```bash
git add backend/src/main/java/com/htttdn/crm/controller/ManagerEmployeeController.java backend/src/main/java/com/htttdn/crm/service/ManagerEmployeeService.java backend/src/main/java/com/htttdn/crm/dto/manager/ManagerEmployeeDto.java backend/src/main/java/com/htttdn/crm/service/InternalAccountService.java backend/src/main/java/com/htttdn/crm/repository/UserRepository.java backend/src/main/java/com/htttdn/crm/service/DirectoryService.java backend/src/test/java/com/htttdn/crm/service/InternalAccountRoleIntegrationTest.java
git commit -m "feat(accounts): add employee directory role"
```

### Task 4: Update Admin role assignment UI

**Files:**
- Modify: `frontend/src/features/admin/InternalDirectory.jsx`
- Modify: `frontend/src/features/admin/SystemAdminApp.jsx`
- Modify: `frontend/src/features/admin/PortalSplit.test.jsx`

**Interfaces:**
- The account editor submits the backend role values exactly; Employee accounts do not request or expose a login password.

- [x] **Step 1: Add failing Admin UI tests**

Assert that the role selector offers Admin, HR Manager, Warehouse Manager, Sales Manager, and Employee; new Manager accounts default to `MANAGER_SALES`; choosing Employee hides the password input and submits an account payload without a password; changing an Employee to a login-capable role requires a new password; and existing Admin portal navigation/API boundaries remain unchanged.

- [x] **Step 2: Run the focused UI tests and confirm failure**

Run: `cd frontend && npx vitest run src/features/admin/PortalSplit.test.jsx`

Expected: FAIL because only `MANAGER` and `ADMIN` are currently offered.

- [x] **Step 3: Update the Admin account editor and permission guidance**

Add all supported role values and readable labels, default new staff to `MANAGER_SALES`, omit the password field for `EMPLOYEE`, and require a new password when changing an Employee to a login-capable role. Make the Admin security guidance describe the three Manager roles and directory-only Employee. Keep Admin as the only role-granting portal.

- [x] **Step 4: Run the focused UI tests**

Run: `cd frontend && npx vitest run src/features/admin/PortalSplit.test.jsx`

Expected: PASS without changing the Admin portal's API base or navigation.

- [x] **Step 5: Commit**

```bash
git add frontend/src/features/admin/InternalDirectory.jsx frontend/src/features/admin/SystemAdminApp.jsx frontend/src/features/admin/PortalSplit.test.jsx
git commit -m "feat(admin): manage manager role assignments"
```

### Task 5: Scope Manager navigation and add the HR Employee page

**Files:**
- Create: `frontend/src/features/manager/ManagerEmployees.jsx`
- Create: `frontend/src/features/manager/ManagerEmployees.test.jsx`
- Modify: `frontend/src/app/ManagerApp.jsx`
- Modify: `frontend/src/app/ManagerApp.test.jsx`
- Modify: `frontend/src/features/manager/ManagerProducts.jsx`
- Update existing Manager integration test fixtures to return `MANAGER_SALES` sessions in `AdminVouchers.test.jsx`, `CustomerLifecycle.test.jsx`, `CustomerProfile.test.jsx`, `ManagerInvoices.test.jsx`, `ManagerPolling.test.jsx`, and `SurveyRecipientGroup.test.jsx`.

**Interfaces:**
- `ManagerEmployees` calls only `GET /api/manager/employees` and presents a searchable, paginated, read-only list.
- Manager role values come from the `manager` session object. Sales lands at `/manager/orders`, Warehouse at `/manager/products`, and HR at `/manager/employees`.

- [x] **Step 1: Write failing Employee page and role-navigation tests**

Cover list search/pagination and absence of write actions; Sales navigation and default route; Warehouse navigation and default route; HR navigation and default route; direct navigation to another role's section; and preservation of Admin/Manager sign-in and sign-out behavior.

- [x] **Step 2: Run the focused frontend tests and confirm failure**

Run: `cd frontend && npx vitest run src/features/manager/ManagerEmployees.test.jsx src/app/ManagerApp.test.jsx`

Expected: FAIL because the Employee page and role-specific navigation do not exist.

- [x] **Step 3: Implement the HR directory view**

Use `adminApi` from `frontend/src/api/manager-api.js` with cancellation on unmount/search changes. Render only returned employee name, email, phone, and account status; provide no create, edit, lock, or delete controls.

- [x] **Step 4: Add role-specific Manager sections and route guards**

Define the frontend role-to-section map to match `ManagerRoleAccessPolicy`. Sales receives dashboard, customer/order/invoice/feedback/survey/voucher/promotion/report sections; Warehouse receives products and stock receipts; HR receives employees. Keep the Sales Dashboard Sales-only, route `/manager` to the role's agreed landing page, hide disallowed navigation, and replace unauthorized direct paths with that role's landing path before rendering feature content.

- [x] **Step 5: Run focused frontend tests and build**

Run: `cd frontend && npx vitest run src/features/manager/ManagerEmployees.test.jsx src/app/ManagerApp.test.jsx`

Then run: `cd frontend && npx vite build --mode manager`

Expected: tests pass; Manager build resolves the Employee route and role-filtered navigation without import errors.

- [x] **Step 6: Commit**

```bash
git add frontend/src/features/manager/ManagerEmployees.jsx frontend/src/features/manager/ManagerEmployees.test.jsx frontend/src/app/ManagerApp.jsx frontend/src/app/ManagerApp.test.jsx
git commit -m "feat(manager): scope portal by manager role"
```

- [x] **Step 7: Update existing portal integration test sessions**

After the role guard was enabled, older Manager integration fixtures without a role correctly landed on `/manager/login`. Add `MANAGER_SALES` to those fixtures so tests model the new authenticated session contract; do not weaken the route guard.

Run `cd frontend && npx vitest run` and confirm the complete suite passes.

Commit with `test(frontend): set manager role in integration fixtures`.

### Task 6: Document the role model and run final verification

**Files:**
- Modify: `database/migrations/README.md`
- Modify: `backend/README.md`
- Modify: `frontend/README.md`
- Modify: `README.md`
- Modify: `docs/database/manager-portal.md`
- Modify: `docs/features/audit-logs.md`
- Modify: current feature docs that state a generic Manager role: customer lifecycle, customer profile, survey filters, and survey recipient groups.
- Modify: Manager portal test fixtures to provide the required `MANAGER_SALES` session role.
- Include the reviewed design and implementation plan under `docs/superpowers/`.

- [x] **Step 1: Document the migration and role boundaries**

Add migration 022 to the ordered migration table with its legacy-account/token effects. Document that Employee is directory-only, Admin assigns roles, and HR/Warehouse/Sales scopes are enforced in backend and mirrored in Manager navigation. Keep the database backup-before-migration warning.

- [x] **Step 2: Review all role references for stale `MANAGER` behavior**

Run: `rg -n "MANAGER|MANAGER_HR|MANAGER_WAREHOUSE|MANAGER_SALES|EMPLOYEE" backend frontend database README.md docs`

Update stale user-facing role guidance. Retain the literal legacy value only in historical/new migration logic, compatibility documentation, and tests that intentionally verify legacy audit/history behavior.

- [x] **Step 3: Run the complete backend and frontend checks**

Run: `cd backend && mvn -q -DskipTests=false test`

Run: `cd frontend && npx vitest run`

Run all web modes: `cd frontend && npx vite build --mode user && npx vite build --mode admin && npx vite build --mode manager`

Expected: all configured tests pass and all three builds succeed. Report PostgreSQL-only test skips/failures separately when the QA database is unavailable.

- [x] **Step 4: Verify the PostgreSQL migration on an isolated database**

Repeat Task 1's migration check from the pre-change schema, inspect the converted Manager account and revoked refresh-token row, then confirm the new role/audience checks. Do not apply the migration to production as part of this task.

- [ ] **Step 5: Manually verify the three role experiences**

Using one test account per role, sign in and verify the landing route and visible navigation. Confirm HR can only read Employees; Warehouse can edit products/suppliers/stock and receive inventory but cannot open Sales pages; Sales can use customer/order/report/promotion workflows and read product lookups but cannot mutate products or access HR/Warehouse pages. Confirm direct API calls follow the same boundaries. If no interactive browser session is available, record that as a remaining manual check; do not claim it was performed based on automated tests.

- [ ] **Step 6: Commit the docs and verification notes**

```bash
git add database/migrations/README.md backend/README.md frontend/README.md README.md docs/database/manager-portal.md docs/features/audit-logs.md docs/features/customer-lifecycle.md docs/features/customer-profile-360.md docs/features/customer-survey-filters.md docs/features/survey-recipient-groups.md docs/superpowers/specs/2026-11-15-manager-role-split-design.md docs/superpowers/plans/2026-11-15-manager-role-split.md
git commit -m "docs: document manager role separation"
```

## Execution verification

- Backend: full Maven test suite passed with 258 tests, 0 failures/errors, and 4 optional PostgreSQL QA tests skipped because the QA database is not configured.
- Frontend: 48 test files and 352 tests passed; Vite builds passed in `user`, `admin`, and `manager` modes.
- PostgreSQL: migration 022 passed against an isolated database initialized from the pre-change schema; all three temporary role-verification databases were dropped after the check.
- Automated route/API tests cover role navigation, forbidden sections, read-only product access, Employee login rejection, and account role changes. Interactive browser sign-in with one real account per role has not been performed; keep Task 6 Step 5 open until that manual check is run.
- A review found that the employee endpoint initially serialized the `User` entity. The test first failed while confirming private profile fields appeared in JSON; the endpoint now maps to `ManagerEmployeeDto` containing only ID, name, email, phone, and lock status. The focused account integration test and the full backend suite pass with this fix.
