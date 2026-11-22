# Admin Product and Supplier Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable system Admin to browse, search, filter, and sort product and supplier records using read-only, paginated views.

**Architecture:** Reuse `SystemAdminApp` and the shared `InternalDirectory` instead of creating duplicate Admin pages. Extend the existing `/api/admin` query support for supplier criteria and connect existing product criteria to a compact advanced-filter panel.

**Tech Stack:** React, Spring Boot, Spring Data JPA, PostgreSQL, existing Admin API helpers and design tokens.

**Spec:** `docs/superpowers/specs/2026-11-21-admin-product-supplier-search-design.md`

## Global Constraints

- Admin list operations use `/api/admin/**` and remain read-only.
- Manager supplier/product mutation workflows remain unchanged.
- Search and filter results remain paginated and server-side.
- No new dependencies.
- Do not add or run tests in this task; verify with frontend build, backend compile, and browser inspection.

## Review Focus

- Empty optional supplier fields must not prevent other supplier fields from matching.
- Invalid page sizes or sort keys must be rejected instead of reaching an unsafe sort path.
- Switching filters must reset to page zero and clear all filters must restore defaults.
- Product supplier selection must use supplier IDs while showing human-readable labels.
- Admin screens must not expose supplier or product mutation controls.

### Task 1: Extend the read-only supplier search API

**Files:**
- Modify: `backend/src/main/java/com/cnpm/clothingstore/controller/DirectoryController.java`
- Modify: `backend/src/main/java/com/cnpm/clothingstore/service/DirectoryService.java`

**Steps:**
- Add optional supplier code, email, phone, and address criteria to the existing Admin/Manager GET handler while keeping current callers compatible.
- Apply case-insensitive contains filters, include address in broad keyword search, and allow safe sorting by supplier code, name, or creation time.
- Validate query lengths and existing paging/sort boundaries before building the JPA criteria query.
- Compile the backend with tests skipped.

### Task 2: Add Admin product and supplier search controls

**Files:**
- Modify: `frontend/src/features/admin/SystemAdminApp.jsx`
- Modify: `frontend/src/features/admin/InternalDirectory.jsx`
- Modify: `frontend/src/features/admin/internal-directory/useInternalDirectory.js`
- Modify: `frontend/src/features/admin/internal-directory/DirectoryFilters.jsx`
- Modify: `frontend/src/features/admin/internal-directory/DirectoryTable.jsx`
- Modify: `frontend/src/features/admin/internal-directory/internalDirectoryConfig.js`
- Modify: `frontend/src/shared/styles/internal-portal.css`

**Steps:**
- Add a read-only “Nhà cung cấp” Admin navigation item and route.
- Load supplier options for product supplier filtering and display matching supplier names in product rows.
- Add a collapsible advanced-search area with filters appropriate to products and suppliers, sorting controls, applied-filter count, and clear action.
- Preserve the existing directory API pagination and show supplier address in supplier results.
- Build the frontend and inspect both Admin directories in the browser.

### Task 3: Reconcile the prior Admin navigation expectations

**Files:**
- Modify: `frontend/src/features/admin/PortalSplit.test.jsx`

**Steps:**
- Replace assertions that supplier navigation and product supplier information are intentionally hidden with assertions aligned to the requested Admin read-only lookup behavior.
- Do not run the test suite in this task.

## Execution Choice

Implement in the current isolated worktree using the native in-session workflow; do not create subagents because the backend query and Admin UI changes share a small set of interfaces.

## Verification

- `npm run build` in `frontend`.
- `mvn -q -DskipTests compile` in `backend`.
- Inspect product and supplier search behavior in the running Admin page and confirm both are read-only.
