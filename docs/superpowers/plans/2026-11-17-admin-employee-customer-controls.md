# Admin Employee and Customer Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify Admin-managed employees as sales or warehouse and add Admin customer edit/lock controls.

**Architecture:** Use `employee_profiles.work_area` as the source of employee type and return it in an account-list DTO. Add Admin-only customer routes that reuse `AdminUserService` update/lock rules; wire the Admin directory to those routes.

**Tech Stack:** Spring Boot 3.4, PostgreSQL/H2, React, Vitest, Maven.

**Spec:** `docs/superpowers/specs/2026-11-17-admin-employee-customer-controls.md`

## Global Constraints

- Do not change employee or customer authentication policy.
- Do not add a database migration or duplicate the existing employee work-area field.
- Do not add customer deletion controls.
- Keep customer lock reasons, notifications, refresh-token revocation, and audit behavior.
- Keep Admin account edit/delete controls hidden for role `ADMIN`.

## Review Focus

- New employees must get a profile with a unique `EMP-{id}` code and the selected work area.
- Legacy employees with `GENERAL` work area must remain readable and editable.
- Duplicate customer emails must be rejected without changing the customer.
- Locking must require a nonblank reason; unlocking must clear lock state and reason.
- Admin customer routes must reject non-Admin roles.

---

### Task 1: Persist employee subtype in account directory

**Files:** `InternalAccountService.java`, `InternalAccountController.java`, `EmployeeProfileRepository.java` (reuse), `InternalAccountRoleIntegrationTest.java`.

- [x] Write tests that employee account list responses include `workArea`, employee creation persists `SALES` or `WAREHOUSE`, and updating subtype changes the employee profile.
- [x] Run the focused backend tests and confirm they fail for the missing response field/profile persistence.
- [x] Add an account response DTO with `workArea`; load profiles in one batch for the page.
- [x] Extend account create/update input with `workArea`, validate `SALES` or `WAREHOUSE` for `EMPLOYEE`, and create/update minimum employee profiles using the spec defaults.
- [x] Rerun focused backend tests and `mvn -q test`.

### Task 2: Add Admin customer update and lock routes

**Files:** new `AdminCustomerController.java`, `AdminUserService.java`, `AdminDtos.java`, `InternalAccountRoleIntegrationTest.java`.

- [x] Write tests for Admin customer update, duplicate email rejection, lock/unlock, Manager email restrictions, and password-hash omission.
- [x] Run the focused backend tests and confirm the missing route behavior fails first.
- [x] Add a dedicated `AdminCustomerUpdateRequest`; keep Manager's `UserRequest` email-free and validate uniqueness in `AdminUserService`.
- [x] Add `PUT /api/admin/customers/{id}` and `PATCH /api/admin/customers/{id}/lock`, delegating to `AdminUserService` and returning a safe response DTO.
- [x] Verify Admin access succeeds and non-Admin access is denied; rerun focused tests and `mvn -q test`.

### Task 3: Wire employee types and customer actions in Admin UI

**Files:** `frontend/src/features/admin/InternalDirectory.jsx`, `PortalSplit.test.jsx`, `styles/admin-governance.css` if needed.

- [x] Add UI tests for subtype labels, employee subtype create/edit payloads, customer edit payloads, and customer lock/unlock payloads; assert no customer delete control exists.
- [x] Run focused Vitest tests and confirm they fail before implementation.
- [x] Show a required subtype selector for `EMPLOYEE`, display labels from `workArea`, and preserve the Admin-row no-edit/no-delete rule.
- [x] Enable customer edit and lock/unlock actions in the customer tab. Use the Admin customer endpoints; ask for a lock reason and omit the delete action.
- [x] Rerun focused tests and `npm test`.

### Task 4: Verify the full change

- [x] Run the full backend test suite (`mvn -q test`).
- [x] Run `cd frontend && npm test` and build all three modes (`user`, `admin`, `manager`).
- [x] Run `git diff --check` and review that the change contains no new migration and no customer delete action.
