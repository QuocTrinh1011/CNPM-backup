# HR and Employee Self-Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add HR employee management and employee self-service inside the existing shared Manager Portal, including leave, attendance, payroll, reports, and printable payslips.

**Architecture:** Extend the current `customers` identity/role model with a separate employee profile and HR tables. Reuse Manager authentication and the `/manager` shell, but authorize employee self-service, team-lead read-only, and HR workflows separately in backend policy and frontend navigation.

**Tech Stack:** Java 21, Spring Boot 3.4, Spring Data JPA, PostgreSQL, H2 integration tests, React 19, Vite, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-16-hr-employee-self-service-design.md`

## Global Constraints

- Keep one Manager Portal and one Manager login surface; do not add a fourth portal or Vite build mode.
- Enforce every scope in backend API authorization; menu hiding is not authorization.
- Employees can access only their own private profile, leave requests, attendance, and published payslips.
- `MANAGER_HR` owns employee administration, leave decisions, attendance, payroll, and HR reports.
- Team leads can read only basic profiles and attendance for assigned direct reports; they cannot approve leave or see salary/payroll.
- Sales and Warehouse retain their existing scopes and cannot access HR or payroll data.
- Preserve historical records. Deactivation/resignation must not hard-delete employees or payroll history.
- Add migration `025_hr_employee_self_service.sql`; do not rewrite earlier migrations.
- Demo seed accounts are local/demo only. Add only the seven specified accounts; do not invent the other three mentioned without addresses.
- Keep statutory contribution/tax/overtime settings effective-dated and out of hard-coded frontend logic.
- Do not upgrade dependencies or change unrelated portal behavior.

## Baseline

- `frontend`: `npm test` passes 53 files / 371 tests. `npm run build` succeeds; it prints existing `lucide-react` module-directive warnings.
- `backend`: `mvn -q test` could not start because Maven is not installed on PATH; there is no Maven wrapper in this checkout.

## Review Focus

- Employee A must never read Employee B's profile, request, attendance, or payslip by changing an ID or query parameter. Test in Task 2 and Task 3.
- Employee sessions must refresh and revoke correctly while Manager sales/warehouse scopes remain unchanged. Test in Task 2.
- Leave approval and employment status must not erase history or grant employee access to HR decisions. Test in Task 4.
- Payroll rounding, zero attendance, paid/unpaid leave, overtime category, and repeat generation must produce deterministic, explainable values. Test in Task 6.
- A published payslip must remain unchanged after attendance/profile changes; corrections require an auditable revision. Test in Task 6.

---

### Task 1: Database schema, migration, and demo accounts

**Files:**
- Create: `database/migrations/025_hr_employee_self_service.sql`
- Create: `database/migrations/tests/025_hr_employee_self_service_postconditions.sql`
- Modify: `database/schema.sql`
- Modify: `database/seed/seed_data.sql`
- Modify: `database/migrations/README.md`
- Modify: `database/README.md`
- Test: PostgreSQL scratch-database migration/seed verification (when PostgreSQL tooling is available)

**Interfaces:**
- Produce tables for employee profiles, employee leave requests, daily attendance, payroll periods, payslips/line items, and effective-dated payroll settings.
- Employee profiles reference `customers.customer_id`; no payroll/attendance/history row is cascade-deleted when an account is deactivated.
- `employee_profiles.reports_to_employee_id` links an employee to a team lead profile and is set only by HR.
- `customers.role` already permits `EMPLOYEE`. Replace `refresh_portal_audience_check` with the same current audiences plus `EMPLOYEE`.
- Demo seed creates `qlnhansu@shop.com` as `MANAGER_HR`; `nvbh01@shop.com`–`nvbh03@shop.com` as `EMPLOYEE` with title `Nhân viên bán hàng`; and `nvkho01@shop.com`–`nvkho03@shop.com` as `EMPLOYEE` with title `Nhân viên kho`. Use the existing documented local/demo password convention and idempotent inserts.

- [x] **Step 1: Add `025_hr_employee_self_service_postconditions.sql`** with `DO` assertions for the Employee refresh audience, all HR tables, foreign keys, and unique employee/period constraints.
- [x] **Step 2: Run `schema.sql`, migration 025, the postcondition script, and `seed_data.sql` twice against a scratch PostgreSQL database**; verify the migration applies after 024 and the second seed run creates no duplicate accounts. Never apply this migration to the user's active `cnpm` database without separate authorization.
- [x] **Step 3: Add the same final-state tables and audience check to `database/schema.sql`** so fresh installs match migrated databases.
- [x] **Step 4: Add `025_hr_employee_self_service.sql`** with transaction-safe DDL, checks, indexes, `refresh_portal_audience_check` replacement, and no changes to earlier migrations.
- [x] **Step 5: Add only the seven named local/demo accounts and their employee profiles** to `seed_data.sql`; leave other demo records unchanged and retain the production warning.
- [x] **Step 6: Document migration 025, dependencies, seed accounts, and local-only password warning** in database READMEs.
- [x] **Step 7: Re-run the PostgreSQL migration/seed verification and `git diff --check`.**
- [x] **Step 8: Commit** as `feat(hr): add employee and payroll schema` (`8566a63`).

**Task 1 verification:** The new postcondition script failed against the pre-025 scratch schema as expected (missing `EMPLOYEE` in the refresh audience). Migration 025 then passed all postconditions. On a separate scratch database, the final `schema.sql`, migration 025, postconditions, and two seed runs succeeded; the seven expected demo accounts and seven profiles were present exactly once. The user's `cnpm` database was not modified.

### Task 2: Shared Manager authentication and role authorization

**Files:**
- Modify: `backend/src/main/java/com/htttdn/crm/security/ManagerRoleAccessPolicy.java`
- Modify: `backend/src/main/java/com/htttdn/crm/security/AdminAccessGuard.java`
- Modify: `backend/src/main/java/com/htttdn/crm/service/ManagerAuthService.java`
- Modify: `backend/src/main/java/com/htttdn/crm/service/ManagerEmployeeService.java`
- Test: `backend/src/test/java/com/htttdn/crm/security/ManagerRoleAccessPolicyTest.java`
- Test: `backend/src/test/java/com/htttdn/crm/service/ManagerRoleSecurityIntegrationTest.java`

**Interfaces:**
- Manager login/refresh accepts `EMPLOYEE` in the shared Manager session and continues returning the same session envelope.
- Define explicit scopes for HR operations, employee self routes, and team-lead read-only direct-report routes. Unknown `/api/manager/**` routes remain denied.
- Team-lead access is resolved from the employee profile's assigned direct reports; salary and payroll routes remain HR-only.
- Employee self routes are `/api/manager/me/profile`, `/me/leave-requests`, `/me/attendance`, and `/me/payslips`; HR routes use `/api/manager/hr/**`; team routes are `/api/manager/me/team` and `/me/team/attendance`.

- [x] **Step 1: Add failing policy tests** for employee self endpoints, HR-only payroll/leave-decision endpoints, team-lead direct-report read endpoints, and denial of cross-role/unknown routes.
- [x] **Step 2: Run the focused policy test and verify it fails** because `EMPLOYEE` and team-lead scopes are not currently supported.
- [x] **Step 3: Implement named role predicates and explicit path/method scopes** in `ManagerRoleAccessPolicy`; update `AdminAccessGuard` to accept only roles recognized by those scopes.
- [x] **Step 4: Add failing auth integration tests** proving Employee login, refresh, logout, locked/deactivated rejection, and role-change revocation.
- [x] **Step 5: Update `ManagerAuthService`** so Employee login/refresh uses the existing Manager cookie/session and checks the current database role on every refresh.
- [x] **Step 6: Run focused authorization/auth tests, then the backend suite if Maven is available.**
- [x] **Step 7: Commit** as `feat(hr): enable employee sessions in manager portal` (`65e8617`).

**Task 2 verification:** The new test initially failed to compile because `isManagerPortalRole` did not exist. After implementing it and adding explicit route scopes, `ManagerRoleAccessPolicyTest` passed 58 tests and `ManagerRoleSecurityIntegrationTest` passed 9 tests on Java 21 with H2.

### Task 3: Employee profile lifecycle and self-service profile

**Files:**
- Create: `backend/src/main/java/com/htttdn/crm/entity/EmployeeProfile.java`
- Create: `backend/src/main/java/com/htttdn/crm/repository/EmployeeProfileRepository.java`
- Create: `backend/src/main/java/com/htttdn/crm/dto/hr/EmployeeProfileDto.java`
- Modify: `backend/src/main/java/com/htttdn/crm/service/ManagerEmployeeService.java`
- Modify: `backend/src/main/java/com/htttdn/crm/controller/ManagerEmployeeController.java`
- Create: `backend/src/main/java/com/htttdn/crm/controller/EmployeeSelfProfileController.java`
- Test: `backend/src/test/java/com/htttdn/crm/service/ManagerEmployeeIntegrationTest.java`

**Interfaces:**
- HR endpoints: paginated/filterable employee list, create employee+profile, update HR-owned profile fields, and deactivate employee.
- Self endpoints: `GET /api/manager/me/profile` and `PUT /api/manager/me/profile`; identify the account from the authenticated request, never a supplied employee ID.
- HR endpoints are `GET/POST /api/manager/employees` and `PUT/DELETE /api/manager/employees/{id}`. Employee creation accepts `temporaryPassword`; store only a validated hash and never return the password.
- Employee profile fields include employee code, education, job title, employment status, hire date, monthly base salary, insurance salary base, `STAFF`/`TEAM_LEAD` permission profile, and optional `reports_to_employee_id` team-lead assignment.
- Employee creation accepts a temporary password, stores only the password hash, and never returns the password. The local seed uses the documented demo password.
- `STAFF` and `TEAM_LEAD` are employee permission profiles, not account roles. HR can assign them. Only HR can edit salary/employment/education fields.

- [x] **Step 1: Add failing integration tests** for HR create/list/update/deactivate, duplicate email/code rejection, employee own-profile access, forbidden HR-field edits, and cross-employee denial.
- [x] **Step 2: Run the focused integration tests and verify the expected missing-route/authorization failures.**
- [x] **Step 3: Implement the employee profile entity/repository and DTOs** without returning password hashes or unrelated `User` fields.
- [x] **Step 4: Implement HR lifecycle and self-profile services/controllers**; validate/hash the temporary password, revoke sessions on deactivation, and write audit events.
- [x] **Step 5: Run the focused tests and verify deactivated employees retain linked history.**
- [x] **Step 6: Commit** as `feat(hr): manage employee profiles` (`3e537b7`).

**Task 3 verification:** The initial tests failed because HR create was not implemented. After implementation, `ManagerEmployeeIntegrationTest` passed 3 tests, including duplicate email/code rejection, self-only profile reads, HR-field protection, password hashing/omission, soft deactivation, refresh-token revocation, and profile-history retention.

### Task 4: Leave and resignation requests

**Files:**
- Create: `backend/src/main/java/com/htttdn/crm/entity/EmployeeLeaveRequest.java`
- Create: `backend/src/main/java/com/htttdn/crm/repository/EmployeeLeaveRequestRepository.java`
- Create: `backend/src/main/java/com/htttdn/crm/dto/hr/EmployeeLeaveSubmission.java`, `EmployeeLeaveDecision.java`, and `EmployeeLeaveDto.java`
- Create: `backend/src/main/java/com/htttdn/crm/service/EmployeeAccessService.java` as the shared authenticated-employee scope seam for self-service routes.
- Create: `backend/src/main/java/com/htttdn/crm/service/EmployeeLeaveService.java`
- Create: `backend/src/main/java/com/htttdn/crm/controller/EmployeeLeaveController.java`
- Test: `backend/src/test/java/com/htttdn/crm/service/EmployeeLeaveIntegrationTest.java`

**Interfaces:**
- Employee routes are `GET/POST /api/manager/me/leave-requests` and `PATCH /api/manager/me/leave-requests/{id}/withdraw`; they affect only that employee's requests.
- HR routes are `GET /api/manager/hr/leave-requests` and `PATCH /api/manager/hr/leave-requests/{id}/decision` to approve/reject with reviewer note.
- Types are annual, sick, maternity, and resignation; statuses are pending, approved, rejected, and withdrawn.
- Leave decisions and approved resignation status transitions are audited. No hard delete.

- [x] **Step 1: Add failing tests** for each request type, invalid date ranges, ownership, withdrawal rules, HR approval/rejection, duplicate decisions, audit events, and resignation history.
- [x] **Step 2: Run the leave tests and verify they fail** for the missing service/routes (3 route-related failures before implementation).
- [x] **Step 3: Implement request validation and transitions** with transactional status changes and audit events.
- [x] **Step 4: Run leave tests plus existing role-policy tests** (4 leave tests, 3 employee lifecycle tests, and 58 role-policy tests pass).
- [x] **Step 5: Commit** as `feat(hr): add employee leave requests`.

### Task 5: Attendance and team-lead read-only scope

**Files:**
- Create: `backend/src/main/java/com/htttdn/crm/entity/EmployeeAttendance.java`
- Create: `backend/src/main/java/com/htttdn/crm/repository/EmployeeAttendanceRepository.java`
- Create: `backend/src/main/java/com/htttdn/crm/dto/hr/AttendanceUpsertRequest.java`, `EmployeeAttendanceDto.java`, `EmployeeTeamMemberDto.java`, and `TeamAttendanceDto.java`
- Update: `backend/src/main/java/com/htttdn/crm/repository/EmployeeProfileRepository.java` with direct-report lookup.
- Create: `backend/src/main/java/com/htttdn/crm/service/EmployeeAttendanceService.java`
- Create: `backend/src/main/java/com/htttdn/crm/controller/EmployeeAttendanceController.java`
- Test: `backend/src/test/java/com/htttdn/crm/service/EmployeeAttendanceIntegrationTest.java`

**Interfaces:**
- HR creates/updates daily attendance and approved overtime for any employee.
- HR reads/updates attendance through `GET/PUT /api/manager/hr/attendance` with employee/month filters.
- Employees read only their own monthly attendance through `GET /api/manager/me/attendance?year&month`.
- Team leads use `GET /api/manager/me/team` and `GET /api/manager/me/team/attendance?year&month` to read basic profiles and attendance only for employees assigned to them; no mutation, leave decision, salary, or payroll.
- Store the team assignment as `employee_profiles.reports_to_employee_id`; only HR can set it.
- Attendance day fractions are 0, 0.5, or 1; overtime is categorized by normal weekday, weekly rest day, public holiday, and night work.

- [x] **Step 1: Add failing tests** for day-fraction validation, one record per employee/date, HR edit, employee self-only read, team-lead assigned/unassigned read, and denial of team-lead writes/payroll.
- [x] **Step 2: Run tests and verify the expected missing-route/validation failures** (both attendance scenarios failed at the missing routes).
- [x] **Step 3: Implement attendance records and bounded monthly reads** with audited HR upserts and team-lead DTOs that omit overtime/pay-equivalent details.
- [x] **Step 4: Run attendance, leave, employee, and role-policy suites** (2 attendance, 4 leave, 3 employee lifecycle, and 58 role-policy tests pass).
- [x] **Step 5: Commit** as `feat(hr): track attendance and team access`.

### Task 6: Payroll calculation and payslip lifecycle

**Files:**
- Create: `backend/src/main/java/com/htttdn/crm/entity/EmployeePayrollPeriod.java`
- Create: `backend/src/main/java/com/htttdn/crm/entity/EmployeePayslip.java`
- Create: `backend/src/main/java/com/htttdn/crm/entity/EmployeePayrollLine.java`
- Create: `backend/src/main/java/com/htttdn/crm/entity/PayrollSetting.java`
- Create: repositories, DTOs, and `EmployeePayrollService.java` / controller under matching `repository`, `dto/hr`, `service`, and `controller` packages.
- Test: `backend/src/test/java/com/htttdn/crm/service/EmployeePayrollServiceTest.java`
- Test: `backend/src/test/java/com/htttdn/crm/service/EmployeePayrollIntegrationTest.java`

**Interfaces:**
- HR can generate/review/publish a monthly payroll period and add documented adjustments; only HR can see all employees' salary data.
- Employees and team leads can read no unpublished payroll; an employee can read only their own published monthly/annual payslips.
- HR routes are `GET/POST /api/manager/hr/payroll-periods`, `GET /api/manager/hr/payroll-periods/{year}/{month}`, and `POST /api/manager/hr/payroll-periods/{year}/{month}/publish`. Employee reads use `GET /api/manager/me/payslips?year` and `GET /api/manager/me/payslips/{year}/{month}`.
- Calculation uses the design formulas: prorated contracted base by paid-equivalent days; approved overtime by effective-dated category rates; earnings plus approved allowances/bonuses; employee statutory deductions and PIT by effective-dated settings; employer contributions shown separately.
- Published payslips are immutable snapshots. Corrections create an audited revision.

- [x] **Step 1: Add unit tests** for zero workdays, half-days, paid/unpaid leave, overtime category rates, decimal rounding, statutory setting effective dates, and net-pay calculation.
- [x] **Step 2: Run calculation tests and verify they fail** because no payroll calculator exists.
- [x] **Step 3: Implement a deterministic payroll calculator** with explicit inputs and a breakdown result; avoid database access inside the calculation function.
- [x] **Step 4: Add integration tests** for draft/review/publish, self-only published payslips, team-lead/other-manager denial, duplicate period generation, and immutable correction revisions.
- [x] **Step 5: Implement payroll persistence and lifecycle APIs** using the calculator and audit every HR action.
- [x] **Step 6: Run payroll unit/integration tests and verify monthly and annual results match stored snapshots.**
- [x] **Step 7: Commit** as `feat(hr): calculate and publish employee payslips`.

### Task 7: Workforce reports

**Files:**
- Create: `backend/src/main/java/com/htttdn/crm/dto/hr/EmployeeReportDto.java`
- Create: `backend/src/main/java/com/htttdn/crm/service/EmployeeReportService.java`
- Create: `backend/src/main/java/com/htttdn/crm/controller/EmployeeReportController.java`
- Test: `backend/src/test/java/com/htttdn/crm/service/EmployeeReportIntegrationTest.java`

**Interfaces:**
- HR report query accepts month/year and returns active, on-approved-leave, and resigned-in-period employees plus education, salary, and tenure summaries.
- The report endpoint is `GET /api/manager/hr/reports?year&month`.
- No employee, team lead, Sales, or Warehouse role can query organization-wide salary/report data.

- [x] **Step 1: Add failing report tests** for month boundaries, leave status versus employment status, effective resignation, education groups, salary totals, and tenure as-of date.
- [x] **Step 2: Run report tests and confirm expected missing-endpoint failures.**
- [x] **Step 3: Implement bounded SQL/projection queries**; do not load all payroll or attendance history into memory.
- [x] **Step 4: Run HR report and authorization tests.**
- [x] **Step 5: Commit** as `feat(hr): add workforce reports`.

### Task 8: Shared Manager Portal UI for HR and employees

**Files:**
- Modify: `frontend/src/app/ManagerApp.jsx`
- Modify: `frontend/src/app/ManagerApp.test.jsx`
- Modify: `frontend/src/api/manager-api.js`
- Modify: `frontend/src/features/manager/ManagerEmployees.jsx` and its test
- Create: manager feature components/tests for employee profile, leave requests, attendance, payroll/payslip, and HR reports under `frontend/src/features/manager/`
- Modify: `frontend/src/features/manager/styles/manager-cockpit.css` or add focused component styles as needed.

**Interfaces:**
- Role sections: HR gets employee management, leave approvals, attendance, payroll, and HR reports; Employee gets my profile, my requests, my attendance, and my payslips; Team Lead gets team directory and attendance only.
- Landing routes are `/manager/employees` for HR, `/manager/my-profile` for `STAFF`, and `/manager/my-team` for `TEAM_LEAD`; existing Sales/Warehouse landing routes stay unchanged. Team Lead remains an Employee permission profile and sees only assigned direct reports' basic profile and attendance.
- Payslip views include native print buttons and print CSS for monthly slips and annual summaries.

- [x] **Step 1: Add failing Vitest tests** for role-specific navigation/landing, direct URL redirection, Employee self-service navigation, HR-only salary sections, and team-lead team pages.
- [x] **Step 2: Run the focused tests and confirm they fail** under current role-only navigation.
- [x] **Step 3: Add manager API endpoint builders and role-filtered route/nav handling** while preserving current Sales/Warehouse behavior.
- [x] **Step 4: Add focused UI components and tests** for HR CRUD, request decisions, attendance entry, payroll publish, employee self-service, and payslip printing.
- [x] **Step 5: Run `npm test` and `npm run build`; fix only feature-related failures.** (`54` files / `384` tests passed; production build succeeded.)
- [x] **Step 6: Commit** as `feat(frontend): add HR and employee sections to manager portal` (`57fe4c5`).

### Task 9: Documentation and end-to-end verification

**Files:**
- Modify: `README.md`
- Modify: `backend/README.md`
- Modify: `backend/src/test/java/com/htttdn/crm/service/InternalAccountRoleIntegrationTest.java` (keep role/profile coverage aligned with the HR lifecycle)
- Modify: `docs/superpowers/specs/2026-11-16-hr-employee-self-service-design.md`
- Modify: `docs/superpowers/specs/2026-11-15-manager-role-split-design.md` (mark the initial directory-only assumptions as superseded)
- Modify: `docs/superpowers/plans/2026-11-16-hr-employee-self-service.md`
- Modify: `database/README.md` and `database/migrations/README.md` if implementation details require alignment.

- [x] **Step 1: Document** shared Manager Portal access by role, HR workflows, demo-only account emails/password warning, migration 025, payroll assumptions, and manual PostgreSQL migration/backup steps.
- [x] **Step 2: Run** `npm test`, `npm run build`, and all three Vite modes if configured (`user`, `admin`, `manager`).
- [x] **Step 3: Run backend tests/compile** with Maven if available; otherwise record the missing Maven executable and report which backend checks could not run.
- [x] **Step 4: Check** migration SQL, seed idempotency, role-policy paths, `git diff --check`, and that no unrelated frontend/backend/database/docs content changed.
- [x] **Step 5: Commit** as `docs(hr): document employee workflows and payroll rules`.

**Task 9 verification:** Frontend `npm test` passed 54 files / 384 tests; `npm run build` and `npx vite build --mode user|admin|manager` succeeded (existing lucide-react directive warnings). With cached Java 21 and Maven 3.9.12, backend `mvn -q test` passed 294 tests across 50 suites with 0 failures/errors and 4 opt-in PostgreSQL tests skipped because `CRM_POSTGRES_QA` was unset; `mvn -q test-compile` succeeded. The skipped tests are `AuditLogPostgresTest`, `CustomerActivityPostgresTest`, `CustomerLifecyclePostgresTest`, and `ManagerPostgresSmokeTest`. Scratch PostgreSQL migration/seed idempotency and schema postconditions passed in Task 1; the active `cnpm` database was not modified. Final `git diff --check` passed.
