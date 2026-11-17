# Admin Employee and Customer Controls

## Intent

Make employee subtypes visible and editable in Admin, and let Admin update and lock customer accounts from the customer tab.

## Goals

- Classify employees as warehouse (`WAREHOUSE`) or sales (`SALES`) using the existing `employee_profiles.work_area` field.
- Show the subtype in the employee directory and let Admin set it for existing and new employees.
- Keep employees created from Admin directory-only: their password remains unusable until a separate HR/login workflow grants access.
- Add Admin-only customer update and lock/unlock operations. Editing supports full name, email, phone, and preferences. Locking requires a reason, revokes refresh tokens, and uses the existing customer notification and audit behavior.
- Keep Admin accounts protected from edit and delete controls.

## Non-goals

- No new database column or migration; `work_area` already supports `GENERAL`, `SALES`, and `WAREHOUSE`.
- No customer deletion controls in the Admin tab.
- No change to employee or customer authentication policy.

## Approaches

1. Reuse `employee_profiles.work_area` and create a minimum HR profile when Admin creates an employee. This keeps the directory classification aligned with HR and warehouse authorization and avoids duplicate data. **Selected by default** because the schema and HR workflows already use this field.
2. Add an `employee_type` column to `customers`. This supports directory-only accounts without profiles, but duplicates the existing work-area concept and requires synchronization.

Customer actions will use new `/api/admin/customers` routes that delegate to `AdminUserService`; its existing lock flow already validates a reason, sends a notification, revokes refresh tokens, and writes an audit entry. The Admin routes preserve the Admin-only boundary enforced by `AdminAccessGuard`.

## Defaults for minimum employee profiles

When Admin creates an `EMPLOYEE`, create an `employee_profiles` row with code `EMP-{customerId}`, selected work area, matching job title, permission profile `STAFF`, employment status `ACTIVE`, current hire date, and zero salary bases. HR can complete the remaining profile fields later.

## Acceptance criteria

- Employee rows display “Nhân viên bán hàng” for `SALES`, “Nhân viên kho” for `WAREHOUSE`, and a clear unclassified label for `GENERAL`.
- Employee create/edit forms require one of the two requested subtypes and persist it to the employee profile.
- Admin can edit a customer's full name, email, phone, and preferences, with duplicate-email validation.
- Admin can lock a customer with a reason and unlock a locked customer. No customer delete button is added.
- Manager routes and employee HR flows keep their existing authorization and behavior.
