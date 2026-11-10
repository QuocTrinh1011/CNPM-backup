# Domain CI Checks and Merge Gate Design

## Goal

Make pull-request checks domain-aware while keeping one stable, always-running gate that can be required by branch protection.

## Scope

- Replace the backend-only workflow with one `CI` workflow containing change detection, BE, FE, Docs, and gate jobs.
- Keep the Java CodeQL workflow separate, backend-scoped for pull requests and pushes, with its existing schedule and manual trigger.
- Do not change branch protection in this implementation; the repository owner can require `CI / gate` after it has run successfully.
- Do not add CODEOWNERS until the team confirms the owner mapping.

## Design

The `CI` workflow runs for every pull request targeting `main`, every push to `main`, and manual dispatch. It checks out the repository with sufficient history and grants `pull-requests: read` so `dorny/paths-filter@v3` can classify changes on both PR and push events. The classifier exposes `backend`, `frontend`, and `docs` outputs. Backend includes `backend/**`, `database/**`, `tests/**`, and shared workflow/configuration changes. Frontend includes `frontend/**`; Docs includes `docs/**` and Markdown files. Any workflow change activates all domain jobs so CI configuration changes are exercised.

BE, FE, and Docs jobs are conditional and use stable names. The current frontend is a Vite project with `package-lock.json` and a `build` script, so the FE job runs `npm ci` and `npm run build`; optional lint/typecheck scripts run only when present. A no-manifest fallback validates the placeholder structure for an intermediate future state. The Docs job runs event-aware whitespace validation and a lightweight PlantUML structural/business-language lint without requiring a PlantUML renderer. It checks all 30 PlantUML sources for one `@startuml`/`@enduml` pair and balanced block tokens, and checks PNG pairing only for the eight customer diagrams where the repository convention requires sibling PNG previews.

The `CI / gate` job always runs after the classifier and domain jobs. It treats successful and intentionally skipped domain jobs as acceptable, and fails on classifier, job failure, or cancellation. This is the only CI check recommended for Required Status Checks; conditional domain checks should not be required individually.

## Acceptance criteria

- PR/push with backend, database, or test changes runs BE and the gate.
- PR/push with frontend changes runs FE and the gate.
- PR/push with docs or Markdown changes runs Docs and the gate.
- PR/push with only unrelated files still produces a successful gate.
- Workflow changes activate all domain jobs and the gate.
- Manual CI dispatch runs all domain jobs.
- CodeQL remains backend-scoped for PR/push, scheduled weekly, and manually runnable.
- Job names are stable: `BE / tests & build`, `FE / build & lint`, `Docs / lint`, and `CI / gate`.
- `CI / gate` fails if any selected domain job fails or is cancelled.
- No CODEOWNERS or branch-protection mutation is included.
