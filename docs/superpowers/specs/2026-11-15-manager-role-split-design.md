# Manager Role Separation Design

## Status

The initial role split was implemented. Its directory-only `EMPLOYEE` and
read-only HR assumptions were later superseded by the approved
[`2026-11-16-hr-employee-self-service-design.md`](2026-11-16-hr-employee-self-service-design.md),
which defines the current HR and Employee workflows.

## Intent

Split the current all-purpose `MANAGER` role into personnel, warehouse, and sales roles, so each staff account sees and can call only the workflows assigned to it. Add an `EMPLOYEE` role whose accounts appear in a read-only list for the personnel manager. Keep the existing standalone Admin portal as the authority that creates internal accounts and grants roles.

## Current state before implementation

- The Admin portal is a distinct frontend at `/admin`; its internal account page creates and edits only `ADMIN` and `MANAGER` accounts.
- The Manager portal is one frontend at `/manager`. Its sidebar includes customer, product, stock receipt, order, invoice, survey, feedback, voucher, promotion, and report pages.
- `AdminAccessGuard` currently permits every `/api/manager/**` endpoint only to a database user whose role and JWT claim are both exactly `MANAGER`.
- Manager login and refresh tokens use `MANAGER` as both their JWT role and refresh-token audience. Database checks currently allow only `CUSTOMER`, `ADMIN`, and `MANAGER` for these fields.
- Employee records do not have a separate entity/table. `customers` already stores internal accounts in `User`; the current Admin account UI is the management surface.

## Goals

- Define `MANAGER_HR`, `MANAGER_WAREHOUSE`, `MANAGER_SALES`, and `EMPLOYEE` as explicit customer-account role values. `EMPLOYEE` is not a refresh-token audience because it cannot sign in.
- Enforce each role's access in backend authorization and show only its allowed Manager navigation in the frontend. Hiding a menu item alone is not authorization.
- Let Admin create, disable, and assign any internal role. Let the HR Manager read the employee directory only.
- Keep Admin and customer access behavior separate from the Manager roles.
- Reuse the existing `customers` account table; no employee-only schema or HR data is currently needed.

## Non-goals

- Payroll, contracts, attendance, performance reviews, or other employee profile data.
- A separate login, frontend portal, or backend service for each Manager role.
- Employee self-service login. `EMPLOYEE` is treated as a directory-only role in this draft; customer login already rejects non-`CUSTOMER` records.
- New Manager sub-permissions within a role. Each account has one Manager role.
- Changes to promotion, order, warehouse, or other business behavior beyond role access.

## Proposed role matrix

| Role | Allowed areas |
| --- | --- |
| `ADMIN` | Existing separate Admin portal; create/update/lock/soft-delete internal accounts and grant roles; audit log and existing Admin-only pages. It does not implicitly become a Manager role. |
| `MANAGER_HR` | Read-only employee list containing only `EMPLOYEE` records. No role assignment, account mutation, or customer list access. |
| `MANAGER_WAREHOUSE` | Create/edit/archive products, edit stock, manage suppliers, and create/view stock receipts. No sales customer/order/report pages. |
| `MANAGER_SALES` | Customers, orders, existing payment/return workflows, invoices, reports, feedback, surveys, vouchers, and promotions. May read product/category lookup data for sales and promotion forms, but cannot mutate products, stock, suppliers, or receipts. |
| `EMPLOYEE` | Directory record only; no portal or API login. Admin creates and maintains the record; HR can list it. |
| `CUSTOMER` | Existing storefront and customer APIs, unchanged. |

The role names and groupings above reflect the user's confirmed choices. The HR scope is deliberately limited to the list requested because the repository has no separate employee-management domain yet.

## Approaches considered

1. **One Manager portal with server-enforced role scopes (recommended).** Keep `/manager` and the existing login flow, filter the menu/dashboard by role, and enforce the same role matrix in one backend authorization module. This changes fewer screens while preventing API access across areas.
2. **Visual menu grouping only.** Keep one `MANAGER` authority and only hide pages in the frontend. Rejected because direct API requests would still expose every Manager function.
3. **Three independent portals and login flows.** Rejected for this scope: it duplicates navigation/authentication and deployment work while the requested distinction is functional access.

The user selected this approach by requesting distinct roles and an employee role visible to the HR Manager.

## Backend authorization design

- Add one central `ManagerRoleAccessPolicy` module used by the existing request guard. Its interface should map a Manager request path to allowed roles and deny unknown `/api/manager/**` paths by default.
- Group existing endpoint families as follows, with product authorization depending on both HTTP method and path:
  - HR: a new read-only `GET /api/manager/employees`, filtered to non-deleted `EMPLOYEE` accounts and serialized through a dedicated DTO containing only ID, name, email, phone, and lock status. Do not expose age, preferences, lock reason, or account timestamps to the HR directory.
  - Warehouse: product create/update/archive and stock endpoints, `/api/manager/suppliers`, `/api/manager/stock-receipts`.
  - Sales: read-only `GET /api/manager/products`, `/api/manager/products/{id}`, and `/categories` for lookup; `/api/manager/users`, `/api/manager/orders`, manager payment/return endpoints, invoices if backed by an endpoint, reports, feedback, surveys, vouchers, and promotions.
  - Authentication endpoints remain public to the filter and accept only the three Manager roles.
- All role identity checks compare the current database role with the signed JWT role and reject locked or deleted accounts, preserving the existing guard behavior.
- The login response continues to use the `manager` session field. The access token role claim and refresh-token audience use the account's actual Manager role; refresh must not upgrade a role that has changed since the previous token was issued.
- The Manager frontend filters navigation and dashboard requests by role and redirects direct navigation to an unauthorized section. Sales may use product lookup from order/promotion forms without seeing the editable product page. The backend still returns forbidden for any unauthorized direct API request or mutation.
- Admin account APIs continue to be the only place that can grant/change a role. Account creation for `EMPLOYEE` ignores any supplied password and stores a password hash made from a cryptographically random secret that is never returned. Promoting an Employee to a login-capable role (`ADMIN` or a Manager role) requires Admin to set a new password. Customer and Manager login services also reject the `EMPLOYEE` role.
- Existing last-Admin, self-delete, token revocation, and audit behavior remains in force.

## Database and existing accounts

- Add a forward migration after `021_promotion_campaigns.sql` to extend the `customers.role` check for all three Manager roles and `EMPLOYEE`, and the `refresh_tokens.audience` check for the three Manager roles (not `EMPLOYEE`).
- Compatibility rule selected by the user: migrate existing `MANAGER` accounts to `MANAGER_SALES`, revoke their old `MANAGER` refresh tokens, and let Admin reassign any warehouse/HR accounts after deployment. Preserve revoked token rows for history, with their audience changed to `MANAGER_SALES` as part of revocation. This avoids retaining a broad legacy role; accounts used for warehouse work may need reassignment before they can continue that work.
- `EMPLOYEE` records use the existing `customers` table and existing fields (name, email, phone, locked/deleted status). No additional employee fields or table are introduced.
- The migration changes role values and token validity only; it does not drop unrelated tables, change business data, or apply the earlier retirement migration. Back up the database before applying it.

## Frontend behavior

- Keep a single Manager sign-in and shell. After sign-in, role-specific menu and dashboard content are selected from the returned account role. `/manager` redirects Sales to `/manager/orders`, Warehouse to `/manager/products`, and HR to `/manager/employees`; the existing sales-order Dashboard is Sales-only. No `/api/manager/overview` endpoint currently exists, so this change does not add one.
- HR sees `Nhân viên` and a searchable/paginated read-only employee list.
- Warehouse sees editable `Sản phẩm` and `Nhập kho` (supplier maintenance remains in the stock-receiving workflow).
- Sales sees customer/order/payment/return/invoice/report/feedback/survey/voucher/promotion areas and read-only product lookup inside those forms.
- The backend adds `GET /api/manager/products/{id}` as a read-only lookup available to both Warehouse and Sales; it reuses the existing product detail lookup.
- Admin retains the separate `/admin` visual system and role-management screen; its role selector includes the new Manager roles and `EMPLOYEE`.
- Unsupported Manager paths must not render the target feature; route normalization sends the user to their first allowed section.

## Security and verification scenarios

- Each Manager role can authenticate, refresh, and log out; an `EMPLOYEE` cannot use customer, Admin, or Manager login.
- HR can list employees but cannot call warehouse/sales endpoints or mutate employee roles.
- Warehouse can use warehouse endpoints but receives forbidden from sales and HR endpoints.
- Sales can use sales endpoints but receives forbidden from warehouse and HR endpoints.
- Admin can grant/reassign roles and retain existing protections for the last active Admin.
- A user's role change invalidates old refresh-token sessions; old `MANAGER` access tokens cannot retain the former all-area access.
- Direct URL navigation and direct API calls are tested independently from menu visibility.
- The database migration is exercised on PostgreSQL, including conversion of legacy `MANAGER` rows and refresh-token invalidation.

## Confirmed rollout decisions

- `EMPLOYEE` is directory-only and cannot sign in. Admin creates and maintains employee accounts; HR has read-only list access.
- Existing `MANAGER` users migrate to `MANAGER_SALES`; Admin can reassign individual accounts to HR or warehouse afterward.
- Warehouse owns product, supplier, and stock changes. Sales receives read-only product/category lookup for sales and promotion forms.
