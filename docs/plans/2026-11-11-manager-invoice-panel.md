# Manager Invoice Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manager invoice detail modal with a responsive inline panel while preserving current invoice search, filters, pagination, and API behavior.

**Architecture:** Keep list/filter state and manager API calls in the existing invoice page. Rework the existing detail module as a read-only panel, displayed beside the list on wide screens and below it on narrow screens. Keep the existing app route and API contracts.

**Tech Stack:** React, Vite, Vitest, React Testing Library, CSS.

**Spec:** `docs/specs/2026-11-11-manager-invoice-panel-design.md`

## Global Constraints

- Start from the latest `origin/main` and do not bring unrelated changes from PR #9.
- Preserve invoice search, URL-backed filters, payment/date filters, pagination, and the existing manager order endpoints.
- Keep invoice details read-only; do not change backend, database, dependencies, or other features.
- Preserve main's removals of refunds, care, personal tasks, support tickets, and reports.

## Review Focus

- Filter state and search query remain intact when opening and closing the panel; verify with the existing server-backed search test.
- Selected order details load and render while the list stays available; verify in the invoice page test.
- Closing via the panel control and Escape does not leave stale details; verify in the invoice page test.
- Initial load and API failure/retry states remain accessible; keep the existing retry test.
- Narrow layouts stack the panel without horizontal page overflow; verify the CSS media rule and production build.

---

### Task 1: Establish a clean main-based workspace and baseline

**Files:** None.

- [ ] Confirm the worktree has no tracked or untracked edits except the approved design and plan documents.
- [ ] Create `codex/manager-invoice-panel` from `origin/main`.
- [ ] In `frontend/`, run `npm ci`, `npx vitest run`, and `npx vite build`; record baseline test counts and build result.

### Task 2: Specify the panel behavior in the invoice test

**Files:**
- Modify: `frontend/src/app/ManagerInvoices.test.jsx`

- [ ] Change the modal-focused test to select an invoice and assert a labeled detail panel appears while the invoice list remains visible.
- [ ] Keep assertions for customer, item, totals, and payment details; assert the detail endpoint is called.
- [ ] Assert the close control and Escape close the panel.
- [ ] Run `npx vitest run src/app/ManagerInvoices.test.jsx` from `frontend/` and confirm it fails because the current implementation renders a dialog.

### Task 3: Implement the responsive detail panel

**Files:**
- Modify: `frontend/src/features/manager/ManagerInvoices.jsx`
- Modify: `frontend/src/features/manager/ManagerInvoiceDetail.jsx`
- Modify: `frontend/src/features/manager/manager-invoices.css`

- [ ] Keep existing filter, URL, pagination, list fetching, and order detail endpoint logic.
- [ ] Render the existing order details in a non-modal, labeled panel beside the list on wide screens and below it on narrow screens.
- [ ] Preserve loading, error/retry, close, Escape, and focus return behavior without trapping focus in a non-modal panel.
- [ ] Run the focused invoice test and confirm it passes.

### Task 4: Verify, commit, and open a focused PR

**Files:** Invoice feature, its test, and the approved design/plan documents only.

- [ ] Run `npx vitest run` and `npx vite build` from `frontend/`.
- [ ] Run `git diff --check`; inspect the full diff and confirm it contains no backend, database, refund, care, support-ticket, report, or unrelated formatting changes.
- [ ] Commit as `feat(frontend): show invoice details in a panel`.
- [ ] Push `codex/manager-invoice-panel` and open a new PR targeting `main`, describing the panel and the passing verification.
