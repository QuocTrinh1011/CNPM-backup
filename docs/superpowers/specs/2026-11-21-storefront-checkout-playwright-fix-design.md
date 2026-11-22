# Storefront Checkout Playwright Locator Fix

## Intent

Restore the existing customer checkout E2E scenario after the product-card accessible label changed.

## Evidence and root cause

- The failed Playwright capture shows the `E2E Playwright Tee` card is present in the catalog.
- Its current accessible action is `Xem chi tiết E2E Playwright Tee`.
- The test searches for the obsolete label `Chi tiết E2E Playwright Tee`, so the locator fails before opening the product.

## Behavior

- Update the E2E test to locate the product card action by its current accessible name and continue the existing COD checkout scenario.
- Do not change storefront behavior or product-card markup to match a stale test selector.

## Acceptance criteria

- The customer E2E flow opens the seeded product through its accessible detail action, completes checkout, and finds the order afterward.
- The checkout test passes in the Chromium Playwright project against the guarded `crm_e2e` database.

## Out of scope

- Catalog layout, product naming, accessibility-label changes, or checkout behavior changes.
