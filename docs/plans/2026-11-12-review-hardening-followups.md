# Review hardening follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the remaining review suggestions with performance, configuration, regression-test, and loading improvements while preserving business behavior.

**Architecture:** Keep changes behind the existing `AdminSurveyService`, `WebConfig`, `CustomerProfileService`, SQL seed script, React portal, and hook interfaces. Batch-load selected recipients, reject invalid CORS configuration at startup, and split infrequently rendered route modules behind Suspense.

**Tech Stack:** Spring Boot 3.4, Java 21, PostgreSQL/psql, React, Vite, Vitest, React Testing Library.

**Spec:** `docs/specs/review-hardening-followups.md`

## Global Constraints

- Preserve survey recipient validation semantics and current access-control checks.
- Do not change the SQL query result or ordering behavior in `CustomerProfileService`.
- The seed guard must stop before any data-writing SQL when `prod` is active.
- Do not contact the live PayOS service or use production/shared databases.
- Keep portal entry imports, route behavior, component props, and the `CheckoutPage` `CheckoutState` export stable.
- Before changing a test-facing `App.jsx` re-export, confirm no production source imports it; if the re-export blocks chunk splitting, point tests at the component module directly.

## Review Focus

- Selected survey IDs with missing, duplicate, locked, deleted, or non-customer rows retain the current validation result.
- CORS origin parsing trims whitespace and rejects `*` even when mixed into a comma-separated list.
- Payment polling runs only while pending and visible, and stops after payment confirmation.
- `popstate` restores filters from the URL after history traversal.
- Seed profile parsing recognizes `prod` among comma-separated profiles and does not mistake `production` for `prod`.
- Lazy routes resolve after loading and retain the existing URL, permissions, and page actions.

---

## Task 1: Batch selected survey recipients

**Files:** `backend/src/main/java/com/cnpm/clothingstore/service/AdminSurveyService.java`, `backend/src/test/java/com/cnpm/clothingstore/service/AdminSurveyServiceTest.java`.

- [x] Add a failing test that selected recipients use one `findAllById` call and preserve validation for inactive and missing IDs.
- [x] Run the focused test and confirm the expected failure.
- [x] Replace per-ID `findById` calls with one batch lookup and in-memory ID validation, preserving original ID iteration order and null-ID exception behavior.
- [x] Run the focused service test and confirm it passes.
- [x] Commit: `perf(survey): batch load selected recipients` (`5855946`).

## Task 2: Reject wildcard CORS origins

**Files:** `backend/src/main/java/com/cnpm/clothingstore/config/WebConfig.java`, a new `WebConfigTest.java`.

- [x] Add failing tests for exact `*`, whitespace around entries, and a valid explicit origin list.
- [x] Run the focused test and confirm the wildcard case fails for the missing validation.
- [x] Validate and normalize configured origins at bean construction; reject `*` with an actionable startup error.
- [x] Run the focused test and confirm all cases pass.
- [x] Commit: `fix(security): reject wildcard CORS origins` (`19d6743`).

## Task 3: Mark SQL query fragments as trusted constants

**Files:** `backend/src/main/java/com/cnpm/clothingstore/service/CustomerProfileService.java`.

- [x] Add one comment above `page(...)` documenting that SQL fragments are internal constants and must never contain request data.
- [x] Run `git diff --check` and inspect the limited diff.
- [x] Commit: `docs(backend): document trusted profile query fragments` (`89b844c`).

## Task 4: Guard demo seed for production profile

**Files:** `database/seed/seed_data.sql`, `database/README.md`, `README.md`.

- [x] Add a guard at the very top of the psql script that reads `SPRING_PROFILES_ACTIVE`, detects the `prod` profile in a comma-separated list, prints an error, and exits before inserts/updates.
- [x] Update the seed instructions to state that this guarded script must run via psql and that SQL-only clients do not evaluate psql meta-commands.
- [x] Verify the guard's syntax against PostgreSQL psql documentation; `psql` is unavailable locally, so no execution against a database was attempted.
- [x] Commit: `security(database): block demo seed in production profile` (`a8447e6`).

## Task 5: Test payment polling and filter history

**Files:** `frontend/src/features/storefront/PaymentQr.test.jsx`, manager filter tests under `frontend/src/app/`.

- [x] Add tests for a 10-second sync poll while pending/visible, no continued polls after paid, and filter restoration after back/forward `popstate` events.
- [x] Run the focused tests; JSDOM did not navigate with native `history.back()`/`forward()`, so the test restores URL snapshots and dispatches the browser `popstate` event.
- [x] No behavior fix was needed; the tests passed against existing logic.
- [x] Run focused tests and confirm they pass.
- [x] Commit: `test(frontend): cover payment polling and filter history` (`f6d8204`).

## Task 6: Lazy-load infrequently used customer pages

**Files:** `frontend/src/app/App.jsx`, and only the small modules needed to preserve existing loading-state exports.

- [x] Add route tests for checkout, orders, and account pages before changing imports; existing route coverage passed after the change.
- [x] Use `React.lazy` for infrequent customer pages and dialogs, with loading fallbacks at Suspense boundaries.
- [x] Preserve component props, portal entry imports, and CSS order. Vite showed static `App.jsx` re-exports made three dynamic imports ineffective; repo search found those re-exports were consumed only by tests, so tests now import components directly from their modules.
- [x] Run focused route tests and inspect generated `UserPortal` chunks. The current user entry is 72.62 kB plus its shared 222.52 kB entry chunk; the review's pre-change figure was about 309 kB for `UserPortal`.
- [x] Commit: `perf(frontend): lazy-load infrequent customer pages` (`14fb4b2`).

## Final verification

- [x] Run `mvn -B -ntp verify` from `backend/`: 195 tests, 0 failures/errors, 4 PostgreSQL tests skipped because no PostgreSQL service was configured.
- [x] Run `npm run lint`, `npx vitest run` (245 tests), and builds for user/admin/manager modes from `frontend/`.
- [x] Inspect the final diff and compare the user entry with the review-reported baseline.
- [x] Run `git diff --check`.
