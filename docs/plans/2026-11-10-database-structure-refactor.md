# Database Structure Refactor Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to carry out this plan task by task. The user has requested inline execution and four focused commits.

**Goal:** Number and organize database scripts, move database feature guides under `docs/database/`, and update every repository reference to the new paths.

**Architecture:** Preserve SQL contents and history with `git mv`. Number the 17 migrations in dependency order derived from SQL references, document their order, then update Java test paths and repository documentation/CI references before moving the three feature guides.

**Tech Stack:** Git, PostgreSQL SQL, Java 21, Maven, Markdown, GitHub Actions.

**Spec:** User request in the current task.

## Global Constraints

- Do not edit SQL contents, backend behavior, frontend files, or `docs/design/diagrams/`.
- Keep `database/backup/README.md` unchanged.
- Use migration names `NNN_<original suffix after migration_>.sql`.
- Preserve the four requested commit groups and use `refactor(database): ...` messages.
- Verify repository references, Maven tests, Maven test compilation, and CI path coverage.

## Review Focus

- Java tests must resolve migrations from `database/migrations/` relative to `backend/`.
- Every documentation reference must use the renamed migration and relocated guide paths.
- The migration order must reflect actual SQL dependencies, including `payments.qr_code`, `order_refunds`, and `voucher_usages`.
- CI backend filters must still cover all paths under `database/**`.
- SQL file contents and the backup README must remain byte-for-byte unchanged.

---

### Task 1: Number migrations and document execution order

**Files:**
- Move/rename: all 17 flat migration scripts to `database/migrations/NNN_<suffix>.sql`
- Create: `database/migrations/README.md`

- [ ] Move files with `git mv`, preserving SQL bytes.
- [ ] Record ordered names, concise descriptions, real SQL dependencies, and backup guidance.
- [ ] Commit as `refactor(database): number and organize migrations`.

**Complete when:** Git identifies all 17 SQL files as 100% renames and the migration index records their order and dependencies.

### Task 2: Update PostgreSQL test paths

**Files:**
- Modify: `backend/src/test/java/com/htttdn/crm/service/AuditLogPostgresTest.java`
- Modify: `backend/src/test/java/com/htttdn/crm/service/CareOutcomePostgresTest.java`
- Modify: `backend/src/test/java/com/htttdn/crm/service/CareSourcePostgresTest.java`
- Modify: `backend/src/test/java/com/htttdn/crm/service/CustomerCarePostgresTest.java`

- [ ] Point test fixtures at the corresponding numbered migration under `../database/migrations/`.
- [ ] Run `mvn -q test-compile` from `backend/`.
- [ ] Commit as `refactor(database): update postgres test migration paths`.

**Complete when:** Every PostgreSQL test path resolves and Maven test compilation exits successfully.

### Task 3: Update repository references and CI documentation

**Files:**
- Modify: root and backend README files, affected feature docs, CI path-filter docs, `CareReminderScheduler.java`
- Modify: `.github/workflows/backend-check.yml` only if required by path-filter verification
- Create: `database/README.md`

- [ ] Replace old migration paths and seed paths; explain the new directory structure and link to the migration index.
- [ ] Confirm `database/**` continues to cover the new folders in CI.
- [ ] Commit as `refactor(database): update database path references`.

**Complete when:** Repository docs use the new script locations and CI retains a matching database path filter.

### Task 4: Move database feature guides

**Files:**
- Move: `MANAGER_PORTAL.md`, `VOUCHERS.md`, and `REVIEWS_REWARDS.md` to lowercase kebab-case paths under `docs/database/`
- Modify: moved guides and root README links

- [ ] Move with `git mv`, update migration commands and relative links, and preserve all other guide content.
- [ ] Commit as `refactor(database): move database feature guides`.

**Complete when:** The three guides exist only at their lowercase kebab-case destinations and links resolve there.

### Final verification

- [ ] Search again for any remaining flat migration, seed, or maintenance script paths.
- [ ] Run `mvn -q -DskipTests=false test` and `mvn -q test-compile` from `backend/`; report PostgreSQL-dependent skips/failures by test name.
- [ ] Review `git diff --check`, commit history, SQL identity, backup README identity, and CI path coverage.

**Complete when:** Both Maven commands finish, no legacy script paths remain, and only the requested files changed.
