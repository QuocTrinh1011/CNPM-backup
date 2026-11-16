# HR Management and Employee Self-Service Design

## Status

Approved for implementation; see the implementation plan linked below.

This design supersedes the directory-only `EMPLOYEE` decision in
[`2026-11-15-manager-role-split-design.md`](2026-11-15-manager-role-split-design.md).
It keeps the existing one-Manager-portal architecture and expands the HR and
employee workflows.

## Intent

Add practical personnel management and employee self-service to the CRM:
HR manages employee records, leave decisions, attendance, payroll, and HR
reports; employees use the same Manager portal to manage their own allowed
profile fields, submit requests, and view/print their own published payslips.

## Current state

- `/manager` supports `MANAGER_SALES`, `MANAGER_WAREHOUSE`, and `MANAGER_HR`.
- `MANAGER_HR` currently has only a searchable, paginated, read-only employee
  directory at `GET /api/manager/employees`.
- `EMPLOYEE` records are stored in `customers`, have an unusable random password
  hash, and cannot authenticate. The refresh-token audience constraint and
  `ManagerAuthService` currently exclude `EMPLOYEE`.
- There are no employee profile, leave-request, attendance, or payroll tables
  or APIs. The current employee directory does not contain degree, salary,
  hire date, or employment status.
- The repository has no work schedule, leave-balance, payroll, tax, or insurance
  policy configuration to reuse.
- `database/seed/seed_data.sql` currently has only the demo customer and Admin
  account; it does not contain the seven requested HR/employee test accounts.

## Goals

- Keep a single Manager Portal and login surface. Render role-specific pages in
  that portal; do not add a fourth portal or another frontend build mode.
- Allow employees to authenticate as `EMPLOYEE` and access only their own
  permitted data.
- Give `MANAGER_HR` employee administration, leave approval, attendance,
  payroll, and HR reporting capabilities.
- Keep authorization enforced by backend APIs as well as by frontend
  navigation and route guards.
- Preserve historical employee, leave, attendance, payroll, and audit data.
- Explain each payslip amount and allow printing a monthly payslip and an
  annual summary.

## Non-goals for the first release

- Biometric devices, automatic clock-in geofencing, or shift scheduling.
- Direct salary payment or bank integration.
- Arbitrary user-created permission strings or granting `ADMIN`/`MANAGER_*`
  system roles from the HR screen.
- Automatic legal/tax advice. Statutory settings must be configurable by
  effective date and reviewed when regulations change.

## Roles and access

| Role | Access in the shared `/manager` portal |
| --- | --- |
| `MANAGER_HR` | Create and maintain employee records; view HR reports and salary data; approve/reject leave and resignation requests; record attendance; prepare, publish, and correct payroll. |
| `EMPLOYEE` | View and edit their own allowed profile fields; submit and view their own leave/resignation requests; view and print only their own published payslips. |
| `MANAGER_SALES`, `MANAGER_WAREHOUSE` | Existing areas only; no employee salary, leave, attendance, or HR report access. |
| `ADMIN` | Existing system-account and system-role administration. HR actions remain attributable to the HR role; Admin access to salary/payslip data is not implicitly granted by this design. |

HR can assign predefined employee job/permission profiles (`STAFF` or
`TEAM_LEAD`) only within the employee domain and assign direct reports to a
team lead. A team lead can read basic profile fields and attendance for those
assigned direct reports. A team lead cannot decide leave requests, edit
employee records, or view salary/payroll. This does not grant Manager or Admin
API access. System roles remain managed through the existing Admin account
surface. A `TEAM_LEAD` employee lands at `/manager/my-team`; a `STAFF` employee
lands at `/manager/my-profile`. Team-lead access is based on the current
employee permission profile and HR-maintained direct-report relationship.

The backend must compare the authenticated account's current database role
with the token role, reject locked/deleted accounts, and authorize every
employee resource against the authenticated employee ID. Guessing another
employee ID must never reveal their private data.

## Employee record lifecycle

- Reuse the existing account identity in `customers`; add a dedicated employee
  profile keyed to that account rather than overloading customer profile fields.
- Store employee number, education level, job title/permission profile,
  hire date, employment status, contract salary, insurance salary base,
  contact/emergency details, and optional `reports_to_employee_id` in the
  employee profile or effective-dated records as appropriate.
- HR creates employee accounts with a temporary password supplied during
  creation; validate it with the existing minimum password policy, store only
  its password hash, and never return the password in API responses.
  Employees can replace it through the existing Manager password-change
  flow. Local demo seed accounts use the seed's documented `password`
  credential only for testing; the seed is not for production.
- “Delete employee” means soft-delete/deactivate or record resignation,
  depending on whether employment began. Never hard-delete an employee with
  payroll, attendance, or request history.
- Employees can directly edit contact and emergency-contact fields. HR-owned
  fields (employment status, job/permission profile, education, salary, hire
  date) are read-only to employees; the employee may submit a correction
  request rather than changing them directly.

## Leave and resignation requests

- Supported request types: annual leave, sick leave, maternity leave, and
  resignation.
- A request records its date range, employee note, submission time, status,
  reviewer, decision time, and reviewer note. Statuses are `PENDING`,
  `APPROVED`, `REJECTED`, or `WITHDRAWN` where withdrawal is allowed before a
  decision.
- Only `MANAGER_HR` can approve/reject. Employees can read and manage only
  their own requests. Every decision is audited.
- Approved leave is included as a categorized absence in payroll and HR reports.
  The attendance table remains a daily record entered by HR; the first release
  does not automatically expand an approved date range into attendance rows,
  because the calendar cannot infer weekends and holidays safely.
  Annual paid leave and statutory/public holidays count as paid days.
  Sick/maternity benefit amounts are shown separately from ordinary salary
  and entered by HR with a note in the first release; the system must not
  silently treat those days as unpaid leave or claim to calculate statutory
  benefit eligibility automatically.
- An approved resignation creates a dated employment-status transition and
  preserves the account and all historical records.

## Attendance

- First release uses monthly attendance records maintained by HR, with a
  configurable work calendar and standard working days for the period.
- Record full/half workdays, paid leave categories, unpaid absence, and
  approved overtime hours separated into normal weekday, weekly rest day,
  public holiday, and night work categories.
- HR may correct records before payroll is published; changes after
  publication require an audited correction/revision rather than silently
  changing a payslip.
- Employees can view their own attendance summary. Clock-in/clock-out is out
  of scope unless separately requested.

## Payroll rules

The application calculates an explainable monthly payroll in VND using
effective-dated settings. The payslip shows each input and calculation.

1. **Prorated monthly base salary**

   `prorated base = contracted monthly base salary / standard paid workdays in period * paid-equivalent days`

   Paid-equivalent days include worked days, approved paid annual leave, and
   paid holidays. Approved unpaid leave is excluded. Half-days are counted as
   0.5 day. The configured work calendar determines standard paid workdays.

2. **Overtime**

   Calculate approved overtime from the configured hourly base and the
   applicable legal category multipliers. Current minimum multipliers under
   the Labor Code are 150% on normal working days, 200% on weekly rest days,
   and 300% on public holidays; night-work additions are separate line items.
   These values are effective-dated settings, not constants embedded in UI or
   business code.

3. **Gross earnings**

   `gross earnings = prorated base + allowances + overtime + bonuses + other approved earnings`

   Sick/maternity social-insurance benefits are itemized separately and are
   not fabricated from the ordinary salary formula. Any benefit calculation
   must use the applicable statutory rule and eligibility inputs.

4. **Employee deductions and take-home pay**

   `take-home = gross earnings + separately calculated benefits - employee statutory insurance - personal income tax - lawful, documented adjustments/advances`

   Insurance contribution bases/rates, personal-income-tax brackets and
   deductions, and rounding rules are configurable with effective dates.
   Employer-side contributions are shown separately as employer cost and are
   never deducted from employee take-home. The application must not create
   arbitrary salary fines; every adjustment requires a category, amount,
   explanation, and authorized HR actor. If employee deductions exceed gross
   earnings plus separate benefits, withhold only the available amount and
   show the remainder as `uncollectedDeductions`; the remainder is disclosed
   but is not automatically carried into a later period.

5. **Payroll lifecycle and print**

   Payroll periods move through `DRAFT`, `REVIEWED`, and `PUBLISHED`. HR can
   review the draft and publish it; employees see only published payslips.
   A payslip includes period, attendance, salary base, paid/unpaid leave,
   overtime categories, allowances/bonuses, benefits, deductions, tax,
   take-home, and calculation notes. Monthly and annual print views use the
   same immutable published payroll snapshots.

## HR reports

- Monthly employee status report: active, on approved leave during the period,
  and resigned/effective resignation during the period. Employment status and
  leave status remain separate fields so a temporary leave does not imply
  termination.
- Workforce profile report: education, salary bands/values, tenure, and
  employment status, with month/year filtering where meaningful.
- Salary details and exports are restricted to `MANAGER_HR`; employee
  self-service endpoints return only that employee's own data.
- When a published payslip exists for the selected period, salary reporting
  uses that immutable snapshot. Otherwise the report labels the amount
  `CURRENT_PROFILE`, meaning it reads the current employee profile salary and
  is not a historical salary snapshot.
- Tenure is computed as of the selected report date from the hire date and
  effective resignation date, when present.

## Data and API shape

The feature requires a forward database migration after the current migration
sequence. Exact table names are implementation-plan detail, but the model
needs distinct records for employee profile/history, leave requests, monthly
attendance, payroll periods, payslip snapshots, and line items/settings.
Employee profile rows reference existing account IDs; payroll and attendance
history must survive employee deactivation.

The migration is `025_hr_employee_self_service.sql`. Migration 022 already
allows `EMPLOYEE` in `customers.role`, so migration 025 does not need to alter
that constraint. It must replace `refresh_portal_audience_check` to allow
`EMPLOYEE` in addition to the current audiences, enabling employee refresh
sessions inside the shared Manager Portal.

For local/demo login coverage, extend `database/seed/seed_data.sql`
idempotently with these specified accounts and employee profiles:

| Email | Account role | Employee job title |
| --- | --- | --- |
| `qlnhansu@shop.com` | `MANAGER_HR` | Quản lý nhân sự |
| `nvbh01@shop.com`–`nvbh03@shop.com` | `EMPLOYEE` | Nhân viên bán hàng |
| `nvkho01@shop.com`–`nvkho03@shop.com` | `EMPLOYEE` | Nhân viên kho |

The request mentions 10 existing seed accounts, but only these seven HR/staff
addresses were specified and neither is present in the current repository
seed. Implement these seven explicit demo accounts; do not invent the other
three accounts. Use only the existing local/demo password convention, and
preserve the seed warning that production must never load demo credentials.

API contract under `/api/manager`:

| Method and path | Scope |
| --- | --- |
| `GET`, `POST /employees`; `PUT`, `DELETE /employees/{id}` | HR employee directory, create/update/deactivate. |
| `GET`, `PUT /me/profile` | Employee's own profile. |
| `GET`, `POST /me/leave-requests`; `PATCH /me/leave-requests/{id}/withdraw` | Employee's own requests. |
| `GET /me/attendance?year&month` | Employee's own attendance summary. |
| `GET /me/payslips?year`; `GET /me/payslips/{year}/{month}` | Employee's own published payslips. |
| `GET /me/team`; `GET /me/team/attendance?year&month` | Team-lead read-only direct-report profile/attendance. Service verifies the caller has `TEAM_LEAD` profile. |
| `GET /hr/leave-requests`; `PATCH /hr/leave-requests/{id}/decision` | HR request review/decision. |
| `GET`, `PUT /hr/attendance` | HR attendance maintenance. |
| `GET`, `PUT /hr/payroll-settings` | Read/save effective-dated `PAYROLL_RULES`; HR supplies and verifies values. |
| `GET /hr/payroll-periods?year`; `POST /hr/payroll-periods`; `GET /hr/payroll-periods/{year}/{month}` | List periods, generate a draft, and read its payslip breakdown. |
| `POST /hr/payroll-periods/{year}/{month}/review`; `POST /hr/payroll-periods/{year}/{month}/publish` | Review and publish a period as separate actions. |
| `POST /hr/payroll-periods/{year}/{month}/adjustments`; `POST /hr/payroll-periods/{year}/{month}/revisions/{employeeId}` | Add draft lines or create an audited immutable revision after publication. |
| `GET /hr/reports?year&month` | HR workforce reports. |

Employee self-service routes derive employee identity from the authenticated
token rather than accepting a caller-supplied employee ID. HR list/report
routes can accept filters and employee IDs after role authorization.

## Frontend behavior

- Keep one Manager login and shell. Add role-filtered sections and landing
  routes: HR enters `/manager/employees`, `STAFF` enters `/manager/my-profile`,
  `TEAM_LEAD` enters `/manager/my-team`, Sales and Warehouse retain their
  existing landing routes.
- Add employee pages for profile, requests, attendance, and published
  payslips. Add HR pages for employee management, request approvals,
  attendance, payroll, and HR reports.
- Direct URL access to a disallowed section redirects to the role's allowed
  landing route, and backend APIs independently return forbidden.
- Payslip print styles must work with the browser's native print dialog; PDF
  generation/export is not assumed unless separately approved. An employee can
  print one monthly payslip or print all published monthly slips with annual
  totals as a year summary.

## Implemented behavior and limits

- Employee self-service can edit only phone and emergency-contact fields;
  employment, permission profile, hire date, salary, and insurance base remain
  HR-managed.
- Payroll settings are not prefilled with legal rates. HR must supply the
  effective `PAYROLL_RULES` JSON and standard working days before creating a
  period. The system refuses generation without a valid effective setting.
- A `PAYROLL_RULES` tax schedule must include at least one valid bracket. A
  configured no-withholding schedule uses an explicit open-ended zero-rate
  bracket; an empty bracket list is invalid.
- `UNPAID_LEAVE` and `ABSENT` attendance records cannot have paid-equivalent
  days. Payroll generation also rejects inconsistent stored attendance so an
  old invalid row cannot silently increase salary.
- Resignation/termination revokes employee refresh sessions. Login and refresh
  require an active employee profile, and self-service rejects previously
  issued access tokens after the profile becomes inactive.
- HR reports show the current profile salary when no published snapshot exists
  for a selected month and label that source explicitly. Reports should not be
  read as historical salary records in that case.
- A salary deduction shortfall is exposed as uncollected for that slip; the
  system does not persist a debt balance or deduct it from a future period.

## Security and audit

- Extend the Manager authentication flow and refresh-token audience to support
  `EMPLOYEE` within the same portal, while keeping employee access restricted
  to self-service APIs.
- Revoke sessions when employee status/role is deactivated or changed.
- Audit employee creation/deactivation, profile changes, role-profile
  changes, leave decisions, attendance edits, payroll generation/publication,
  and post-publication corrections. Do not log passwords or unnecessary
  sensitive profile data.
- Keep payroll and profile DTOs separate from the current employee directory
  DTO to avoid accidental data exposure.

## Rollout and verification

- Add a forward migration after migration 024; do not rewrite old migrations.
- Existing `EMPLOYEE` directory accounts need an onboarding/reset credential
  before employee login. The shared demo seed creates testable credentials;
  production onboarding must not use the demo password.
- Test role-scoped navigation and direct API denial, self-only data access,
  leave transitions, attendance/payroll calculations, payroll immutability,
  role revocation, monthly/yearly print views, and PostgreSQL migration behavior.
- Before using the payroll feature outside the course demo, HR/payroll owners
  should verify effective-dated insurance/tax/leave settings against the rules
  that apply to the employer and payroll period.

## Legal references for configurable defaults

- [Labor Code 45/2019/QH14](https://vanban.chinhphu.vn/?classid=1&docid=198540&pageid=27160), including overtime and night-work pay rules.
- [Vietnam Social Security guidance on mandatory contribution rates from 1 July 2025](https://baohiemxahoi.gov.vn/tintuc/Pages/chinh-sach-ho-tro-nguoi-lao-dong-tu-quy-bhtn.aspx?CateID=0&ItemID=24900&OtItem=date). Rates and contribution bases are settings with effective dates; revalidate before each applicable payroll period.
