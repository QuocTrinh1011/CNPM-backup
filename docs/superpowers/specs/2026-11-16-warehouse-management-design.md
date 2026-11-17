# Warehouse and Production Management Design

## Status

Approved and implemented in the warehouse-management branch; final verification and documentation are tracked in the implementation plan.

## Intent

Extend the existing Manager portal with a small but auditable warehouse workflow for raw materials and finished goods. `MANAGER_WAREHOUSE` owns stock policy, receipts, recipes, production plans, approvals, and reports. Employees assigned to the warehouse can request materials, record production, and request finished-goods transfers. Existing HR self-service remains available to all employees.

## Current state

- The repository has one `MANAGER_WAREHOUSE` role in the shared `/manager` portal. It can manage sellable products, suppliers, and product stock receipts.
- `stock_receipts` receive finished products directly into the product's sellable stock (`products.quantity_remaining` in PostgreSQL, exposed as `Product.stock` in Java).
- Checkout decreases sellable product stock; cancelled or expired orders can release it back. Direct stock editing also changes this same value.
- There is no raw-material catalog, recipe/BOM, production plan, raw-material issue workflow, warehouse finished-goods balance, or movement report.
- HR employee profiles distinguish `STAFF` and `TEAM_LEAD`, but do not yet store a structured work area. Warehouse task access cannot safely be granted based only on job-title text or hidden navigation.

## Goals

- Track raw-material receipts, available quantities, material allocation to production, actual consumption, and returns.
- Let managers maintain product recipes and production demand, then assign plans to warehouse employees.
- Require manager approval for employee material requests and requests to move finished goods to sale.
- Keep unfinished/finished warehouse quantities separate from the storefront's sellable `products.stock`.
- Show warehouse reports for monthly, quarterly, and yearly periods using an immutable stock-movement ledger.
- Enforce role, employee work area, production-plan assignment, and approval rules in backend services as well as the Manager UI.
- Preserve the existing customer storefront stock contract and HR workflows.

## Non-goals

- Multiple physical warehouse locations, barcode/RFID, automatic purchasing, supplier invoices, or unit conversion.
- Changing product sizes/colors into independent inventory SKUs. Product stock remains aggregated as it is today.
- Changing customer checkout/order semantics or the existing HR payroll and leave rules.
- Letting employees approve their own material or finished-goods requests.

## Roles and access

| Actor | Warehouse capabilities |
| --- | --- |
| `MANAGER_WAREHOUSE` | Manage raw-material catalog and receipts; maintain product recipes; create/assign/close production plans; approve/reject material requests; approve/reject finished-goods transfers; view warehouse reports. Existing product/supplier functions remain. |
| `EMPLOYEE` with work area `WAREHOUSE` | View assigned production plans; submit material requests against an assigned plan; record production within the plan and approved material allocation; request transfer of finished goods to sellable stock; view only own warehouse activity. Existing self-service remains. |
| Other `EMPLOYEE` work areas | Existing self-service only; no warehouse APIs or pages. |
| `MANAGER_HR` | Maintains employee records and assigns the structured work area. Has no warehouse approval or stock access. |
| `MANAGER_SALES` | Existing sales capabilities and read-only product lookup; no warehouse balances or requests. |
| `ADMIN` | Existing system-account administration. No implied warehouse approval access. |

The HR-maintained employee profile gets a structured `work_area` value (initially `GENERAL`, `SALES`, or `WAREHOUSE`). The backend will not infer authorization from `job_title`. Warehouse employee endpoints will require both role `EMPLOYEE` and `work_area = WAREHOUSE`; production endpoints will additionally scope requests and plans to the authenticated employee. Managers remain authorized by `MANAGER_WAREHOUSE`.

## Inventory terms and stock rules

- **Raw-material available stock** is the quantity physically in the central raw-material store and not allocated to a production plan.
- An approved material request transfers quantity from available stock to that plan's issued-material balance. It does not destroy inventory.
- A production record consumes issued material according to the recipe version attached to the plan, decreases the plan's issued balance, and increases finished-goods warehouse stock.
- Unused issued material must be returned to available raw-material stock before the production plan can be closed.
- Finished goods in the warehouse are not yet visible for sale. An approved employee transfer request decreases finished-goods warehouse stock and increases the existing sellable product stock (`products.quantity_remaining`, exposed as `Product.stock`) by the same amount.
- Checkout continues to decrease sellable stock. Order cancellation/expiry restores it. No transfer to sale is counted as a net loss from total finished-goods inventory.
- Every committed stock change records actor, timestamp, quantity delta, source/reference, and balance after the change in an append-only movement ledger. Requests themselves do not change balances before approval.
- A single database transaction and row-level locking protect each approval, production posting, return, and sale-stock change. Duplicate decisions/postings must not apply twice.

## Main workflows

### Raw-material receipt

Manager selects a supplier, receipt date, and material lines with quantity and unit cost. Posting the receipt increases available raw-material stock and writes receipt and movement history. Existing finished-product receipts remain unchanged and continue to increase sellable product stock.

### Recipes and production plans

Manager defines a recipe for a sellable product: each line is a raw material and quantity needed per finished unit. Recipe edits create a new version; plans keep the recipe version used at creation so later changes cannot alter historical consumption. Manager creates a production plan with product, target quantity, and assigned warehouse employee.

### Material issue request

An assigned employee requests material quantities against a plan. The manager may approve or reject the whole request with a note. Approval is allowed only when available stock and the plan's remaining recipe requirement cover all requested lines; the transaction transfers quantities to the plan's issued balance. The manager can correct a request before decision only by rejecting it and asking the employee to resubmit.

### Production and unused material

An assigned employee records a positive completed quantity against the plan. The server calculates recipe consumption and rejects the posting if it would exceed the target quantity or issued-material balance. Posting consumes allocated material and creates warehouse finished goods. If production ends with unused allocation, the employee requests/records a return; manager approval transfers that quantity back to available raw-material stock before closing the plan.

### Finished-goods transfer to sale

An employee requests a quantity of a product from finished-goods warehouse stock for sale. The manager approves or rejects it. Approval atomically decreases warehouse finished-goods stock and increases `products.stock`, making that quantity available to the existing storefront and order flow.

## Proposed data model

Add a forward migration after migration 025 and keep `database/schema.sql` aligned for fresh installations.

- `raw_materials`: code, name, unit, active flag, available quantity, and timestamps.
- `raw_material_receipts` / `raw_material_receipt_items`: supplier, receipt metadata, material lines, quantity, unit cost, and line totals.
- `product_recipes` / `product_recipe_items`: product recipe versions and per-unit material requirements.
- `production_plans`: product, recipe version, target and completed quantity, assigned employee, status, creator, and timestamps.
- `material_issue_requests` / `material_issue_request_items`: employee request, plan, requested quantities, decision actor/time/note, and status.
- `production_runs` / `production_run_consumptions`: employee posting, produced quantity, recipe/material snapshots, and calculated consumption.
- `material_returns` / `material_return_items`: unused issued material returned to available stock, with manager decision.
- `finished_goods_issue_requests` / `finished_goods_issue_request_items`: employee request to transfer finished warehouse stock to sellable stock and manager decision.
- `warehouse_finished_stock`: current warehouse quantity by product.
- `inventory_movements`: append-only ledger for raw material, finished-goods warehouse, and sellable-product stock movements, with typed movement, location, optional production-plan `scope_id`, signed quantity delta, resulting balance, actor, time, and reference. `scope_id` is present only for `PRODUCTION_ALLOCATED` movements and references the owning production plan.

Use decimal quantities for raw materials and integer quantities for finished units. Check nonnegative balances and positive movement quantities in both API validation and database constraints. Receipt and movement records are never hard-deleted; a correction is a compensating movement.

## Reporting

The manager selects month, quarter, or year. Period boundaries are computed in `Asia/Ho_Chi_Minh` and queried as half-open instants. For each material and product, show opening quantity, incoming/produced, issued/consumed/transferred/sold, and closing quantity. The report aggregates the movement ledger in SQL; it does not load all movements into React.

The new ledger begins at the migration cutover. Migration records a one-time opening movement for each current `products.stock` quantity. The application cannot reconstruct older product stock history reliably because prior manual adjustments and order reservations were not all recorded; therefore reports before cutover are unavailable. New finished-product receipts, manager adjustments, checkout reservations, and order stock releases must all write ledger rows after cutover.

## Backend and frontend seams

- Backend: a warehouse inventory module owns validation, row locks, approvals, production consumption, return-to-stock, movement writing, and report aggregation behind a small set of controllers. Controllers do not perform stock arithmetic.
- Frontend: add role-filtered Manager pages for materials/receipts, recipes, production plans, employee warehouse tasks, approvals, and reports. Reuse existing product and supplier lookup where practical. Employee pages are rendered only after their profile identifies `WAREHOUSE`.
- API authorization remains deny-by-default for unknown `/api/manager/**` paths. Employee-specific routes verify warehouse work area and authenticated identity on every call.
- HR employee create/edit exposes the work area as a predefined option; this field is not an Admin system role and does not grant a Manager role.

## Verification scenarios

- Warehouse manager can receive raw materials, edit versioned recipes, assign plans, approve/reject requests, close a plan after returns, and view reports.
- A warehouse employee can access only their assigned plans and their own requests/production; a sales/general employee cannot call these APIs even with a valid Employee token.
- A manager, sales user, or employee cannot approve their own request unless they are `MANAGER_WAREHOUSE`.
- Material approval, production posting, return, finished-goods transfer, receipt, product stock adjustment, checkout, and order release each create exactly one ledger movement per balance change.
- Concurrent requests or repeated approvals cannot overspend material or finished stock or apply the same request twice.
- Transferring finished goods to sale reduces warehouse finished stock and increases storefront sellable stock equally; a later order decreases sellable stock once.
- Monthly, quarterly, and yearly reports reconcile opening + incoming - outgoing = closing, including Asia/Ho_Chi_Minh boundaries.
- PostgreSQL migration tests verify nonnegative balances, foreign keys, opening snapshots, and immutable historical movement data.

## Confirmed design choices

- Use a separate raw-material inventory and production workflow rather than stretching finished `products.stock` to represent raw materials.
- A finished-goods approval moves stock from warehouse finished goods into the existing sellable product stock (`products.quantity_remaining` in PostgreSQL). This fits the current clothing-store order flow and avoids counting a transfer as both a warehouse issue and an online sale.
- Keep one Manager portal and use backend authorization; employee warehouse access is an explicit HR-maintained work area, not job-title text.
- Preserve existing product receipt and checkout behavior while adding ledger entries for all future balance changes.

## Implemented scope

- Migration 026 provides the employee work-area field, raw-material stock and receipts, versioned recipes, assigned production plans, issue/return requests, production runs, warehouse finished stock, finished-goods transfer requests, and the immutable inventory ledger.
- Existing sellable stock is snapshotted at cutover. Warehouse reports expose month, quarter, and year views using Vietnam-local period boundaries and disclose when a selected period predates complete ledger history.
- Manager Warehouse has catalog, receipt, recipe, plan, approval, and reporting screens. Warehouse employees see only assigned production tasks and their own requests; HR assigns the work area.
- The implementation plan records the required migration checks, role-policy and workflow tests, and frontend tests/builds. Automated migration verification uses disposable databases; a live/shared database is not part of this implementation.
