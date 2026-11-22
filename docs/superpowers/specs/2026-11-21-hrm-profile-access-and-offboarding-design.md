# HRM Profile, Access, and Offboarding

## Intent

Complete the HRM gaps identified during the Chromium Playwright audit while preserving payroll and attendance history.

## Approved decisions

- Employee self-service can update the employee's full name, phone, and emergency-contact details.
- Salary, education, job title, employment status, work area, reporting line, and permission profile remain HR-managed.
- “Delete employee” means deactivate/archive access and preserve historical HR records; it does not hard-delete the employee or account.
- The existing `STAFF` and `TEAM_LEAD` permission profiles remain the available presets. The UI will explain the access difference instead of introducing arbitrary per-page ACLs.

## Behavior

### Employee directory and offboarding

- HR can filter employees by active, inactive, or all records, with active employees selected initially.
- Inactive includes resigned, terminated, or locked employee accounts.
- Deactivation prevents further sign-in, retains the profile and historical attendance/payroll, and makes the employee discoverable in the inactive/all filters.
- The UI describes this action as “Ngừng hoạt động” and explains that history is retained.

### Employee self-service profile

- Show the employee's current profile and allow editing full name, phone, emergency-contact name, emergency-contact phone, and relationship.
- The API accepts only those self-service fields; any attempt to update HR-only fields has no effect or is rejected according to the current DTO validation convention.
- Save feedback reports that personal/contact details were updated.

### Permission profiles

- `STAFF` keeps the employee's self-service pages.
- `TEAM_LEAD` adds access to direct-team directory and attendance pages.
- `workArea=WAREHOUSE` continues to enable warehouse employee tasks; it does not grant warehouse-manager approval access.
- Show these effects beside the profile selector. Select an active team lead from a list when assigning a reporting line instead of requiring a numeric ID.

## Acceptance criteria

- HR can switch between active, inactive, and all employees without losing pagination/search correctness.
- Deactivation removes sign-in access while retaining attendance and payslip records; an inactive employee can still be found through the inactive/all filter.
- Employee self-service saves the allowed fields and cannot change HR-controlled fields.
- Saving `TEAM_LEAD` changes employee navigation/API access to the direct-team views; `STAFF` remains blocked from those views.
- The role selector explains employee, team-lead, and warehouse-task access in Vietnamese.
- Monthly HR report tests assert active, approved-leave, resignation, education, salary, and tenure data rather than only checking that the page loads.
- Payslip E2E tests verify monthly and annual print actions target the intended content without opening the physical print dialog.

## Out of scope

- Permanently deleting employee/account records.
- Editing salary, work status, permission profile, or work area from employee self-service.
- Arbitrary custom permission combinations or payroll-policy redesign.

## Technical boundaries

- Extend the manager employee list query with an allow-listed status filter, keeping existing query and page parameters compatible.
- Extend the self-profile update DTO/service and its React form only for the approved personal fields.
- Keep authorization rules in the existing manager access checks and navigation route guards.
- Add focused unit tests and isolated-database Playwright coverage for offboarding, self-edit, role changes, HR reports, and payslip printing.
