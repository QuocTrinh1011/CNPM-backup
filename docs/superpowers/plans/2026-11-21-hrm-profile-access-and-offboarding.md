# HRM Profile, Access, and Offboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for native execution, or `superpowers:subagent-driven-development` if the user explicitly chooses delegated execution. Steps use checkbox syntax.

**Goal:** Complete employee self-service, HR offboarding filters, role guidance, and Playwright verification while preserving HR history.

**Architecture:** Extend the existing employee directory query for active/inactive/all and permission-profile criteria. Extend the self-profile DTO with only full name and contact fields. Keep existing HR route guards and role presets; add focused unit/integration and isolated-database E2E coverage.

**Tech Stack:** React 19, Vitest/Testing Library, Playwright, Spring Boot 3.4, Spring Data JPA, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-11-21-hrm-profile-access-and-offboarding-design.md`

## Global Constraints

- Do not hard-delete employee/account rows; retain payroll, attendance, and audit history.
- Self-service may update only full name, phone, and emergency-contact fields.
- Keep salary, education, job title, employment status, work area, reporting line, and permission profile HR-managed.
- Use existing `STAFF` and `TEAM_LEAD` profiles; do not introduce arbitrary page-level ACLs.
- Run E2E only against the disposable local `crm_e2e` database.

## Review Focus

- Locked but `ACTIVE` accounts must appear as inactive and must not regain sign-in through the filter UI.
- `RESIGNED` and `TERMINATED` profiles must remain visible in inactive/all results and preserve historical data.
- A malformed or inactive team-lead selection must not be saved as an employee reporting line.
- Extra HR-only properties in a self-profile request must not change salary, work area, status, or permissions.
- Monthly and annual print actions must select different intended payslip content.

---

### Task 1: Add server-side employee directory filters

**Files:**
- Modify: `backend/src/main/java/com/cnpm/clothingstore/controller/ManagerEmployeeController.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/service/ManagerEmployeeService.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/repository/EmployeeProfileRepository.java`
- Test: `backend/src/test/java/com/cnpm/clothingstore/service/ManagerEmployeeIntegrationTest.java`

**Interface:** Extend the existing GET `/api/manager/employees` query with `status=ACTIVE|INACTIVE|ALL` and optional `permissionProfile=STAFF|TEAM_LEAD`; retain `q`, `page`, and `size` defaults and response shape.

- [x] **Step 1: Add the failing integration test** `hrCanFilterActiveInactiveAndAllEmployeesAndFilterTeamLeads`.

  Create staff, team lead, resigned, terminated, locked-active, and archived fixtures. Assert active excludes locked/resigned/terminated/archived; inactive includes each of them; all includes archived profiles; `permissionProfile=TEAM_LEAD` returns only team leads and composes with the other filters.

- [x] **Step 2: Run the focused integration test and verify it fails**

  Run from `backend`: `mvn -q -Dtest=ManagerEmployeeIntegrationTest#hrCanFilterActiveInactiveAndAllEmployeesAndFilterTeamLeads test`

  Expected: FAIL because the list endpoint does not yet accept or apply the filters.

- [x] **Step 3: Implement the allow-listed query filters**

  Add validated enum parsing in the controller/service and repository predicates for employment status, account lock state, archived state, and permission profile. `ACTIVE` means `employmentStatus=ACTIVE AND locked=false AND not archived`; `INACTIVE` includes non-active, locked, or archived employees; `ALL` applies no status predicate. Default omitted API status to `ACTIVE`; preserve archived employee profiles in inactive/all results.

- [x] **Step 4: Verify the focused integration test passes**

  Run the same `mvn -q -Dtest=ManagerEmployeeIntegrationTest#hrCanFilterActiveInactiveAndAllEmployeesAndFilterTeamLeads test` command.

- [x] **Step 5: Commit the directory API task**

  Commit only the controller, service, repository, and integration-test files from this task.

### Task 2: Expand employee self-profile editing safely

**Files:**
- Modify: `backend/src/main/java/com/cnpm/clothingstore/dto/hr/EmployeeSelfProfileUpdate.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/service/ManagerEmployeeService.java`
- Modify: `frontend/src/features/manager/employee-workspaces/EmployeeSelfProfile.jsx`
- Test: `backend/src/test/java/com/cnpm/clothingstore/service/ManagerEmployeeIntegrationTest.java`
- Test: `frontend/src/features/manager/EmployeeWorkspaces.test.jsx`

- [x] **Step 1: Add the failing backend test** `employeeCanUpdateOwnNameAndContactWithoutChangingHrFields`.

  PUT a new full name and contact fields as an employee. Include an extra `monthlyBaseSalary` JSON property and assert the response/database updates only approved fields and salary/role/work area/status remain unchanged.

- [x] **Step 2: Run the focused backend test and verify it fails**

  Run from `backend`: `mvn -q -Dtest=ManagerEmployeeIntegrationTest#employeeCanUpdateOwnNameAndContactWithoutChangingHrFields test`

- [x] **Step 3: Implement the minimal self-profile contract change**

  Add an optional validated `fullName` field to `EmployeeSelfProfileUpdate`; update `ManagerEmployeeService.updateSelfProfile` to normalize and save the account's full name only when supplied. Keep the DTO free of HR-controlled properties.

- [x] **Step 4: Add the failing frontend test** `lets an employee edit their own full name and contact details`.

  Assert the form loads full name, edits it, saves it with contact fields, and reports the updated status.

- [x] **Step 5: Implement the self-profile form change**

  Add the full-name input and preserve existing contact inputs. Change confirmation copy to “Đã cập nhật thông tin cá nhân.”

- [x] **Step 6: Verify backend and frontend tests pass**

  Run the focused backend integration test and `npm run test -- src/features/manager/EmployeeWorkspaces.test.jsx` from `frontend`.

- [x] **Step 7: Commit the self-profile task**

  Commit only the DTO, service, profile component, and their tests.

### Task 3: Add offboarding filters and explain role effects

**Files:**
- Modify: `backend/src/main/java/com/cnpm/clothingstore/dto/hr/EmployeeProfileDto.java`
- Modify: `frontend/src/api/manager-api.js`
- Modify: `frontend/src/features/manager/ManagerEmployees.jsx`
- Modify: `frontend/src/features/manager/manager-hr.css`
- Test: `backend/src/test/java/com/cnpm/clothingstore/service/ManagerEmployeeIntegrationTest.java`
- Test: `frontend/src/features/manager/ManagerEmployees.test.jsx`
- Test: `frontend/src/app/ManagerApp.test.jsx` or existing role-access tests if assertions need adjustment.

- [x] **Step 1: Add failing directory UI tests**

  Add tests for an initially active-only filter, switching to inactive/all, and a `TEAM_LEAD`-filtered list request. Assert pagination returns to page zero when the filters change.

- [x] **Step 2: Run the focused Vitest file and verify the new assertions fail**

  Run from `frontend`: `npm run test -- src/features/manager/ManagerEmployees.test.jsx`.

- [x] **Step 3: Implement status/profile filter controls**

  Pass `status` and optional `permissionProfile` through `adminEndpoints.employees`. Add the active/inactive/all selector, default it to active, and reset page when the query changes.

- [x] **Step 4: Add role guidance and a team-lead selector**

  Replace the numeric `reportsToEmployeeId` input with a select populated by active `TEAM_LEAD` results from Task 1. Show concise Vietnamese descriptions: staff self-service access, team-lead direct-team access, and warehouse work-area access. Keep manager approval pages inaccessible to employees.

- [x] **Step 5: Verify directory and role UI tests pass**

  Run `npm run test -- src/features/manager/ManagerEmployees.test.jsx` and the existing manager role-navigation tests.

- [x] **Step 6: Commit the directory/role UI task**

  Commit only the API helper, employee directory, navigation tests, and related component tests.

### Task 4: Verify HRM end to end, including payroll printing

**Files:**
- Create or modify: `frontend/e2e/hrm-workflows.spec.js`
- Modify only if needed: `frontend/e2e/global-setup.js`

- [x] **Step 1: Add failing Playwright scenarios**

  Cover HR create/edit/deactivate and filter retrieval; employee self-profile name/contact update; promotion from `STAFF` to `TEAM_LEAD` and restricted/allowed team routes; monthly report assertions for active headcount, approved leave, resignations, education, salary, and tenure; HR attendance entry; payroll rules, draft generation, review, publish, and employee visibility; monthly and annual print targeting using a `window.print` spy without opening the physical print dialog.

- [x] **Step 2: Run the focused Chromium spec and verify it fails on the missing assertions/behavior**

  Run from `frontend`: `npm run test:e2e -- --project=chromium e2e/hrm-workflows.spec.js` with `E2E_DATABASE_URL` set only to the disposable local `crm_e2e` database.

- [x] **Step 3: Fix only defects exposed by the scenarios**

  Keep test data unique per run; reuse existing `MANAGER_HR_EMAIL`, employee fixtures, and payroll-rule preset. Do not add new production behavior beyond Tasks 1–3.

- [x] **Step 4: Verify the HRM E2E scenarios pass**

  Run the focused spec again and confirm each API status and visible state.

- [x] **Step 5: Commit the HRM E2E task**

  Commit only the new/updated E2E spec and any fixture changes proven necessary.

## Verification

- Focused backend tests: `mvn -q -Dtest=ManagerEmployeeIntegrationTest test` and `mvn -q -Dtest=EmployeeReportIntegrationTest test`.
- Focused frontend tests: `npm run test -- src/features/manager/ManagerEmployees.test.jsx src/features/manager/EmployeeWorkspaces.test.jsx`.
- HRM Playwright: `npm run test:e2e -- --project=chromium e2e/hrm-workflows.spec.js` against disposable `crm_e2e` only.
- Frontend build: `npm run build`.
