# Admin Statistics Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Replace sample Admin dashboard figures with real, ordered reports for income/expense, products, customers, and employee stock-receipt activity, filtered by year, quarter, or month.

**Architecture:** Reuse the existing SQL reporting service and its Vietnam timezone and income/expense definitions. Add an Admin-only controller route guarded by the existing AdminAccessGuard, extend report periods to quarters, and render all four report groups in the Admin dashboard.

**Tech Stack:** Spring Boot, NamedParameterJdbcTemplate, React, Vite, CSS.

## Global Constraints

- Keep Admin and Manager authorization boundaries intact.
- Keep the existing income definitions: PayOS/other captured orders use `created_at`; COD uses `cod_collected_at` with the existing fallback.
- Expenses are stock receipt costs, and employee activity means stock receipts grouped by creator.
- Report ranges use `Asia/Ho_Chi_Minh` with exclusive end timestamps.
- Do not add dependencies or change unrelated portal behavior.

## Review Focus

- Quarter and month are mutually exclusive; invalid ranges must be rejected.
- Quarter trend contains its three calendar months; month trend contains every local calendar day.
- Admin requests use `/api/admin/reports`; Manager access rules remain unchanged.
- Empty result sets render zero totals and clear empty table states.
- Year/quarter/month filter changes reload the same four report groups in order.

## Files

- Modify `backend/src/main/java/com/htttdn/crm/service/ManagerReportsService.java` to support quarter windows and bucket labels while preserving existing call signatures.
- Create `backend/src/main/java/com/htttdn/crm/controller/AdminReportsController.java` as the Admin-only reporting route.
- Modify `frontend/src/features/admin/AdminDashboard.jsx` to fetch and render the four ordered report groups with year/quarter/month filters.
- Modify `frontend/src/features/admin/SystemAdminApp.jsx` to remove the now-unused overview request and dashboard props.
- Modify `frontend/src/features/admin/styles/admin-dashboard.css` for report filters, summary, trend, and tables.

## Tasks

### Task 1: Period-aware report service and Admin route

- Add a report overload accepting year, quarter, and month; preserve the existing year/month method for Manager callers.
- Validate quarter bounds and prohibit selecting both quarter and month.
- Generate yearly monthly buckets, quarterly monthly buckets, and monthly daily buckets, preserving Asia/Ho_Chi_Minh boundaries.
- Add `GET /api/admin/reports`; rely on `AdminAccessGuard` for Admin-only authorization.
- Verify with `cd backend && mvn -q -DskipTests compile`.

### Task 2: Ordered Admin report dashboard

- Fetch `/api/admin/reports` using Admin auth and reload on filter changes or retry.
- Add year, quarter, and month selection.
- Render in order: income/expense/balance and trend; top products; top customers; employee receipt activity.
- Replace the hardcoded payment/order/organization figures with the live report data; retain useful Admin navigation shortcuts.
- Add responsive styles without changing other portals.
- Verify with `cd frontend && npx vite build --mode admin` and `npx vite build --mode user && npx vite build --mode manager`.

## Verification Scope

This run will not add or execute tests. Run the compile and build commands listed above and inspect the diff for role-boundary and data-label consistency.
