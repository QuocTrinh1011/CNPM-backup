# CRM Repository Folder-by-Folder Refactor Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve module boundaries and folder-level navigation across the repository while preserving application behavior, migration names, documentation links, and CI triggers.

**Architecture:** Keep `App.jsx` and `ManagerApp.jsx` as route and shell composers, moving large UI groups into focused modules. Extract shared document-generation and PlantUML validation helpers into `tools/` and call the linter from CI. Add concise indexes for documentation, database, and test entry points; keep externally referenced migrations and workflow triggers at their current paths.

**Tech Stack:** React, JavaScript, Vite.

**Spec:** User request in the chat: refactor every top-level folder and open a PR.

## Global Constraints

- Preserve existing default and named exports from `App.jsx` and `ManagerApp.jsx`.
- Preserve customer and manager route paths, query parameters, API calls, and authorization behavior.
- Preserve the current paths and semantics of SQL migrations because project instructions and deployment procedures reference them directly.
- Preserve GitHub Actions trigger paths, required job names, and CI gate behavior.
- Classify `tools/**` changes into the existing docs lint job so extracted validation code is checked in CI.
- Keep behavior changes out of structural code edits; update documentation where it contradicts the current configuration.
- Review every top-level folder; leave a folder unchanged when its current structure has no clear maintainability problem.

## Review Focus

- Direct customer order URLs, order query state, manager URL filters, and the three Vite portal entry points remain intact.
- Existing imports of `OrdersModal`, `OrderView`, `Reports`, and `useAdminList` continue to resolve from their current entry modules.
- Shared Word formatting helpers no longer load Customer use-case data when the Admin generator runs; generated document formatting and audience-specific footer text remain explicit.
- The extracted PlantUML linter reports the same invalid source conditions as the workflow's current inline checker.
- Every migration remains at its current path; added indexes must link only to files that exist.
- Backend startup instructions match the actual default Hibernate schema validation configuration.

---

### Task 1: Refactor frontend feature modules

**Files:**
- Modify: `frontend/src/App.jsx`
- Create: `frontend/src/storefront/Catalog.jsx`
- Create: `frontend/src/storefront/CartAndAuth.jsx`
- Create: `frontend/src/storefront/Orders.jsx`
- Create: `frontend/src/storefront/Account.jsx`
- Create: `frontend/src/storefront/utils.js`
- Modify: `frontend/src/ManagerApp.jsx`
- Create: `frontend/src/manager/Dashboard.jsx`
- Create: `frontend/src/manager/Customers.jsx`
- Create: `frontend/src/manager/Products.jsx`
- Create: `frontend/src/manager/Orders.jsx`
- Create: `frontend/src/manager/Feedback.jsx`
- Create: `frontend/src/manager/Surveys.jsx`
- Create: `frontend/src/manager/Reports.jsx`
- Create: `frontend/src/manager/shared.jsx`

**Interfaces:**
- `App` remains the default export and continues to own route state and data loading.
- `ManagerApp` remains the default export and keeps route, session, navigation, theme, and notice ownership.
- Export the existing page/dialog components from their feature modules and re-export the existing public names from `App.jsx`.
- Each extracted manager screen keeps its current props and uses the existing API, filter, and resource hooks; `Reports` and `useAdminList` remain exported from `ManagerApp.jsx`.
- Preserve all current component props and callback ordering.

- [x] Move catalog cards and product detail UI into `Catalog.jsx`.
- [x] Move cart and authentication UI into `CartAndAuth.jsx`.
- [x] Move order history/detail UI into `Orders.jsx`.
- [x] Move account, notification, wishlist, and survey dialogs into `Account.jsx`.
- [x] Update `App.jsx` imports and compatibility re-exports without changing route or state logic.
- [x] Move manager dashboard, customer, product, order, feedback, survey, and report screens into feature modules; move only shared helpers into `manager/shared.jsx`.
- [x] Update `ManagerApp.jsx` imports and compatibility re-exports without changing route, session, or state logic.
- [x] Run the frontend production build and inspect the diff for accidental behavior or styling changes.

### Task 2: Refactor shared tooling and CI validation

**Files:**
- Modify: `tools/build_admin_usecase_specifications.py`
- Modify: `tools/build_customer_usecase_specifications.py`
- Modify: `.github/workflows/backend-check.yml`
- Create: `tools/usecase_spec_helpers.py`
- Create: `tools/lint_plantuml.py`

**Interfaces:**
- Both document generators import formatting helpers from `usecase_spec_helpers.py` and keep their current command-line entry points and output paths.
- CI invokes `python3 tools/lint_plantuml.py`; the script owns only PlantUML source checks and does not modify files.

- [x] Move common Word formatting functions into `usecase_spec_helpers.py`; remove the Admin generator's dependency on loading the Customer generator.
- [x] Keep each generator's output path and explicitly set the appropriate document footer.
- [x] Move the inline PlantUML validation logic to `tools/lint_plantuml.py` and make the workflow call that script.
- [x] Compile the Python scripts and run the PlantUML linter against the current diagrams.

### Task 3: Refactor repository indexes and current instructions

**Files:**
- Modify: `backend/README.md`
- Modify: `tests/README.md`
- Create: `database/README.md`
- Create: `docs/README.md`
- Review: `README.md`, `.github/pull_request_template.md`, and the remaining top-level folders.

- [x] Align backend schema and local-run instructions with the current application configuration.
- [x] Add concise database and documentation indexes without moving referenced files or guessing a mandatory migration order.
- [x] Update the test index to point to the actual backend and frontend test directories and current commands.
- [x] Confirm `.github`, `backend/src`, `database` SQL, and `tools` have each been reviewed and only changed where a clear seam or contradiction exists.

### Task 4: Review and prepare the PR

**Files:**
- Review all files changed in Tasks 1–3.

- [x] Confirm the entry modules are smaller and each extracted module has a focused responsibility.
- [x] Run the frontend production build, Python compilation/linter, and `git diff --check`.
- [x] Create commits grouped by top-level folder or cohesive cross-folder refactor, then push the branch and open PR [#96](https://github.com/duygri/do-an-htttdn-crm/pull/96) against `main`.
