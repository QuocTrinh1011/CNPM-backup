# Playwright Role and Browser Coverage Design

**Date:** 2026-11-17  
**Status:** Approved

## Goal

Expand the existing full-stack Playwright suite so the main authenticated journeys and role boundaries are exercised in Chromium, Firefox, and WebKit against the real Spring Boot API and an isolated disposable PostgreSQL database.

The suite should cover the roles and role-specific areas present in the repository without treating a hidden menu item as sufficient authorization. It should validate both the visible portal navigation and representative API-backed workflows.

## Current State

- `frontend/e2e/auth.spec.js` has two scenarios: customer registration/session refresh and Manager Sales login/report.
- `frontend/playwright.config.js` starts Spring Boot and the user and manager Vite portals, but only defines Chromium.
- `frontend/e2e/global-setup.js` seeds only a Manager Sales account.
- The E2E database helper refuses database URLs outside local `crm_e2e`.
- No Playwright browser engines are installed in the current machine cache. The GitHub Actions E2E job currently installs Chromium only.

## Proposed Coverage Matrix

Run each applicable browser scenario in all three browser projects:

| Persona | Portal | Main checks and representative journey |
| --- | --- | --- |
| Customer | User | Register a unique account, browse products, use the cart and COD checkout, then reload and confirm the session is restored. |
| Admin | Admin | Sign in, open account groups, verify manager/employee/customer grouping, and create or update an isolated test account where the current UI supports it. Confirm Admin-only screens reject unauthenticated access. |
| Manager Sales | Manager | Sign in and verify the Sales landing page; load orders, invoices, vouchers/promotions, and sales reports; verify a warehouse/HR-only route is denied. |
| Manager Warehouse | Manager | Sign in and verify the warehouse landing page; use shared product reads; exercise supplier/stock receipt or warehouse request workflow; load warehouse reports; verify Sales/HR-only routes are denied. |
| Manager HR | Manager | Sign in and verify the employee directory landing page; load employee, leave, attendance, payroll, and HR report screens; exercise an HR decision/update against isolated test data; verify Sales/Warehouse-only routes are denied. |
| Employee (Sales) | Manager | Sign in and verify self-service landing; load own profile, leave requests, attendance, and payslips; submit and withdraw a test leave request; verify HR-only pages are denied. |
| Employee (Warehouse) | Manager | Sign in and verify warehouse task visibility; load own production/material request pages and submit one isolated test request; verify manager-only approval pages are denied. |
| Employee team lead | Manager | If supported by the current seeded employee profile, verify the additional team and team attendance pages; otherwise report this scenario as not fixture-backed rather than silently omitting it. |

Customer, Admin, and each Manager/Employee persona must be seeded only in the isolated E2E database. Generated customer/test records use unique run identifiers so reruns do not depend on pre-existing demo data.

## Authorization Checks

For each authenticated internal persona:

1. Assert the default landing route and allowed navigation entries.
2. Navigate directly to at least one route outside that persona's allowed section set and assert the app redirects to an allowed landing route or login as the existing app contract specifies.
3. Call a representative forbidden backend route with the persona's authenticated session and assert `403` (or the documented auth response for an expired session).
4. Check shared read routes such as manager product reads for both Sales and Warehouse, and check that their write endpoints remain Warehouse-only.

Admin and customer checks must also assert that portal-specific login/session flows do not grant a Manager session and vice versa.

## Browser and Runtime Strategy

- Add Playwright projects for `chromium`, `firefox`, and `webkit`.
- Reuse the real backend plus local disposable PostgreSQL setup; do not point E2E at the developer's `cnpm` database or any remote database.
- Keep one test database name guard (`crm_e2e`) and use deterministic role fixture creation in global setup.
- Serialize browser projects/tests that mutate shared fixtures, or make mutations uniquely scoped. Prefer unique resources so a rerun is independent of order.
- Install the three Playwright engines in local instructions and GitHub Actions. CI must run the same browser matrix as local `npm run test:e2e`.
- Preserve failure traces, screenshots, video, and HTML report artifacts.

## Failure and Isolation Behavior

- E2E startup must fail with an explicit message when Docker/PostgreSQL or the local `crm_e2e` database is unavailable.
- Tests must never create, truncate, or mutate any database except the guarded disposable `crm_e2e` database.
- Role fixtures use non-production addresses and passwords and are recreated idempotently.
- External payment providers and email delivery are not called. Use COD for customer checkout; test other payments only if the existing backend has a deterministic local test seam.
- If a browser engine cannot be installed on the host, report the engine and installation prerequisite explicitly; do not mark its coverage as passed.

## Non-Goals

- Replacing Vitest component/unit tests.
- Testing every permutation of every field in every CRUD form. E2E focuses on complete role access boundaries and representative end-to-end workflows; detailed edge cases remain in the existing lower-level tests.
- Changing backend business logic or frontend behavior just to make the tests pass.
- Packaging Electron or testing desktop-native menus in this browser suite; desktop E2E remains a separate workflow.

## Acceptance Criteria

1. Playwright runs applicable role scenarios in Chromium, Firefox, and WebKit.
2. The isolated test setup provides usable fixtures for Admin, Manager Sales, Manager Warehouse, Manager HR, Employee work areas, and customer signup.
3. Each role has explicit allowed-navigation and forbidden-route checks, with representative business pages backed by successful API responses.
4. At least one meaningful write journey is covered for customer, warehouse, HR, and employee; Admin account management is exercised without modifying shared/demo data.
5. CI installs all three browser engines and runs the complete matrix.
6. A full-stack run reports pass/fail per browser and role, and failure artifacts remain available.

## Risks to Resolve During Implementation

- Several workflows depend on linked HR/warehouse records. Fixture creation must follow current database constraints and use unique data per browser project.
- WebKit and Firefox availability varies by local host; browser installation prerequisites must be documented.
- The E2E database currently relies on Spring `create-drop`; any tables created only by schema SQL must be checked before adding direct SQL fixture setup.
