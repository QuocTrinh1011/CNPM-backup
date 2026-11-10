# Domain CI Checks and Merge Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add path-aware BE/FE/Docs checks and an always-running CI gate while preserving the separate backend-scoped CodeQL workflow.

**Architecture:** Convert `backend-check.yml` into a stable `CI` workflow with a classifier, conditional domain jobs, and an `always()` gate. Keep `codeql.yml` independent and backend-scoped. The current placeholder frontend gets a meaningful validation path and will automatically use Node scripts when `frontend/package.json` exists.

**Tech Stack:** GitHub Actions, `dorny/paths-filter@v3`, Java 21/Maven, Node.js/npm when applicable, Python standard library for docs lint, YAML, PowerShell/Git verification.

---

### Task 1: Replace the backend-only workflow with domain CI and gate

**Files:**
- Modify: `.github/workflows/backend-check.yml`

- [ ] **Step 1: Add an always-running change classifier**

  Keep pull-request targeting `main`, push targeting `main`, and manual dispatch without workflow-level path filters. Add checkout with `fetch-depth: 0`, `pull-requests: read` permission, and `changes` using `dorny/paths-filter@v3` with backend (`backend/**`, `database/**`, `tests/**`, `.github/workflows/**`), frontend (`frontend/**`, `.github/workflows/**`), and docs (`docs/**`, `**/*.md`, `.github/workflows/**`) filters. Expose all three outputs. Manual dispatch must activate all domain jobs.

- [ ] **Step 2: Add the conditional BE job**

  Preserve Java 21, Maven cache, and `mvn -B -ntp verify`, but use stable job name `BE / tests & build`. Run when backend output is true or the event is manual.

- [ ] **Step 3: Add the conditional FE job**

  Use stable name `FE / build & lint`. When `frontend/package.json` exists, set up Node, run `npm ci` with the checked-in lockfile, then run `npm run lint --if-present`, `npm run typecheck --if-present`, and `npm run build`. The current repository must exercise this Vite build path. When no manifest exists, validate the placeholder README and `src` directory and report that the frontend toolchain is not present yet.

- [ ] **Step 4: Add the conditional Docs job**

  Use stable name `Docs / lint`. Check out with `fetch-depth: 0`. Run `git diff --check` over `base.sha...sha` for pull requests, `before...sha` for pushes (falling back to `HEAD^...HEAD` when the before SHA is unavailable), and `HEAD^...HEAD` for manual dispatch. Run a Python structural lint over all 30 `docs/**/*.puml` sources: exactly one anchored `@startuml` and `@enduml`, balanced anchored block tokens (`alt`, `opt`, `loop`, `par`, `break`, `critical`, `group`, `end`), and no SQL-shaped syntax such as `SELECT ... FROM`, `INSERT INTO`, `UPDATE ... SET`, `DELETE FROM`, or `FOR UPDATE`. Check sibling PNG pairing only for `docs/diagrams/customer/*.puml`; preview sources without PNGs are intentional.

- [ ] **Step 5: Add the always-running gate**

  Use stable name `CI / gate`, `needs` on classifier and all domain jobs, and `if: always()`. Pass only when classifier and every domain job result is exactly `success` or `skipped`; fail for `failure`, `cancelled`, or any unexpected result. Add scenario assertions for success/skipped, failure, and cancelled result combinations. Keep least-privilege `contents: read` and `pull-requests: read` permissions.

### Task 2: Preserve and verify CodeQL scope

**Files:**
- Verify only: `.github/workflows/codeql.yml`

- [ ] **Step 1: Confirm existing behavior without modifying the file**

  Keep backend path filters, Java 21, manual dispatch, weekly `30 2 * * 1` schedule, manual build mode, and job permissions. Do not make CodeQL a required check for docs-only PRs; require `CI / gate` instead.

### Task 3: Validate workflows and trigger behavior

**Files:**
- Test: `.github/workflows/backend-check.yml`
- Test: `.github/workflows/codeql.yml`

- [ ] **Step 1: Parse and lint YAML**

  Run `npx --yes prettier@3 --check --parser yaml .github/workflows/backend-check.yml`, run `npx --yes prettier@3 --parser yaml .github/workflows/codeql.yml > $null` as a parse-only check because the preserved CodeQL file is pre-existing and intentionally not reformatted, and run `git diff --check`. Run `actionlint` against both workflows when available; if it is unavailable locally, document that limitation and rely on GitHub's workflow parser plus the successful CI checks.

- [ ] **Step 2: Assert stable jobs and trigger mapping**

  Verify the new workflow contains `changes`, `be-check`, `fe-check`, `docs-check`, and `gate`; the stable names are present; the gate uses `always()`; manual dispatch activates all domain jobs; and CodeQL keeps its schedule/path behavior.

- [ ] **Step 3: Run the docs lint locally**

  Run the same Python structural checks against all 30 PlantUML sources and verify the eight customer sources have PNG counterparts while preview sources are excluded from the pairing assertion.

- [ ] **Step 4: Confirm branch protection was not changed**

  Read `gh api repos/duygri/do-an-htttdn-crm/branches/main/protection` and confirm this implementation did not mutate it. The final handoff should tell the owner to require only `CI / gate` after it appears on a PR.

### Task 4: Commit the focused CI change

**Files:**
- Modify: `.github/workflows/backend-check.yml`
- Verify only: `.github/workflows/codeql.yml`
- Create: `docs/superpowers/specs/2026-09-18-domain-ci-gate-design.md`
- Create: `docs/superpowers/plans/2026-09-18-domain-ci-gate.md`

- [ ] **Step 1: Confirm status contains only planned files**

- [ ] **Step 2: Commit**

  ```powershell
  git add .github/workflows/backend-check.yml docs/superpowers/specs/2026-09-18-domain-ci-gate-design.md docs/superpowers/plans/2026-09-18-domain-ci-gate.md
  git commit -m "ci: add domain checks and merge gate"
  ```
