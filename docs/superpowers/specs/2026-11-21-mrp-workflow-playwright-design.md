# MRP Workflow Playwright Coverage

## Intent

Verify the existing raw-material, production, finished-goods, and reporting workflow in Playwright using only the isolated `crm_e2e` database.

## Workflow under test

1. Warehouse manager creates or selects a supplier and receives raw materials; available material balance increases.
2. Manager defines a product recipe and creates a production plan with a target quantity and assigned warehouse employee.
3. Warehouse employee views the assigned plan, requests additional materials, records completed production, and requests transfer of finished goods to the sales warehouse.
4. Warehouse manager approves material issue and finished-goods transfer requests; balances and movement history reflect each decision.
5. Warehouse report can be queried by month, quarter, and year and shows material/finished-goods balances and movements for the selected period.

## Approved constraints

- Reuse the existing manager and warehouse-employee UI/API; implement workflow changes only if a Playwright scenario exposes a defect.
- All test accounts, inventory, receipts, requests, production plans, and orders stay in the disposable local `crm_e2e` database.
- Do not run the E2E backend against the shop database or the user's real PostgreSQL database.

## Acceptance criteria

- Playwright verifies a raw-material receipt changes the available quantity.
- Playwright verifies a saved recipe is used to calculate a plan's required material quantity.
- Playwright verifies an employee's material request moves through pending to approved and changes available/allocated quantities correctly.
- Playwright verifies a production run updates completed quantity and finished stock while consuming allocated material.
- Playwright verifies the finished-goods transfer request is pending before approval and approved after manager action, with finished stock reduced.
- Playwright selects MONTH, QUARTER, and YEAR report periods and asserts the corresponding API query parameters and visible period/results.
- Existing role-access checks continue to block warehouse approvals from employee accounts.

## Out of scope

- New warehouse workflow states or changes to accounting/inventory policy unless the tests expose a defect in the approved workflow.
- Running these scenarios against production or the user's live store database.

## Technical boundaries

- Add scenarios to the existing Playwright E2E workflow specs and use fixture data created by `frontend/e2e/global-setup.js`.
- Keep browser roles separate in distinct pages/contexts and assert the relevant API responses as well as visible status and balance changes.
- Preserve existing one-worker execution because tests share disposable fixtures.
