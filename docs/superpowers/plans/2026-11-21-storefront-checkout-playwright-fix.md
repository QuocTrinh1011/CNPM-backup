# Storefront Checkout Playwright Locator Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for native execution, or `superpowers:subagent-driven-development` if the user explicitly chooses delegated execution. Steps use checkbox syntax.

**Goal:** Repair the existing customer COD checkout E2E test by locating the product card with its current accessible name.

**Architecture:** Change only the test locator in the existing customer workflow. Keep catalog UI and product-card accessibility labels unchanged.

**Tech Stack:** Playwright, existing React storefront, disposable PostgreSQL E2E backend.

**Spec:** `docs/superpowers/specs/2026-11-21-storefront-checkout-playwright-fix-design.md`

## Global Constraints

- Do not modify storefront product-card markup to match a stale test selector.
- Run the scenario only against the guarded local `crm_e2e` database.

## Review Focus

- The locator must use the card action label `Xem chi tiết E2E Playwright Tee`, not the obsolete `Chi tiết ...` label.
- The test must click the product detail action, not the separate product-title or quick-view action.
- Checkout assertions must continue through order creation and order-history retrieval.

---

### Task 1: Correct the customer product locator and verify COD checkout

**Files:**
- Modify: `frontend/e2e/customer-workflow.spec.js`
- Reference: `frontend/src/features/storefront/product-details/ProductCard.jsx`

- [x] **Step 1: Reproduce the existing failure**

  Run from `frontend`: `npm run test:e2e -- --project=chromium e2e/customer-workflow.spec.js` with `E2E_DATABASE_URL` pointing only to the local disposable `crm_e2e` database.

  Expected: FAIL at the product locator because the test asks for `Chi tiết E2E Playwright Tee` while the page exposes `Xem chi tiết E2E Playwright Tee`.

- [x] **Step 2: Update the accessible locator**

  Replace the obsolete button name with the exact current `Xem chi tiết E2E Playwright Tee` accessible name; retain the rest of the test flow.

- [x] **Step 3: Verify the full customer workflow passes**

  Re-run `npm run test:e2e -- --project=chromium e2e/customer-workflow.spec.js`; confirm registration, saved address, product details, COD order creation, and order-history lookup all pass.

- [x] **Step 4: Commit the locator fix**

  Commit only `frontend/e2e/customer-workflow.spec.js`.

## Verification

- Focused Chromium scenario: `npm run test:e2e -- --project=chromium e2e/customer-workflow.spec.js` against local disposable `crm_e2e` only.
- Full Chromium E2E suite after the fix: `npm run test:e2e -- --project=chromium`.
