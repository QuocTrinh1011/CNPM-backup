# Pull Request Workflow Scope Design

## Goal

Run each GitHub Actions workflow only when the changed files are relevant to that workflow. Backend changes should trigger the backend build/test and Java CodeQL checks; frontend-only or documentation-only changes should not trigger backend checks.

The path filters in this design apply only to `pull_request` and `push` events. Manual runs remain available without path filtering, and the scheduled CodeQL scan remains available for its full repository scope.

## Scope

- Keep two independent workflows: `Backend Check` and `CodeQL`.
- Scope the backend workflow to `backend/**` and its own workflow file for PR and push events.
- Scope the CodeQL workflow to `backend/**` and its own workflow file for PR and push events.
- Preserve pull-request targeting of `main`, pushes to `main`, and manual execution.
- Preserve the CodeQL schedule `30 2 * * 1` (UTC).
- Keep the existing job names so any future status-check mapping remains stable.
- Do not change the current `main` branch approval or conversation-resolution rules.

## Design

### Backend check

The `Backend Check` workflow runs `mvn -B -ntp verify` with Java 21 from the `backend` directory when a pull request or push changes `backend/**` or `.github/workflows/backend-check.yml`. The broad `backend/**` match intentionally includes backend documentation such as `backend/README.md`, because it is part of the backend area. It does not run for frontend-only or repository-documentation-only changes.

Permissions remain `contents: read`.

### Security scan

The `CodeQL` workflow analyzes Java with manual build mode and runs the Maven package step from the `backend` directory when a pull request or push changes `backend/**` or `.github/workflows/codeql.yml`. The scheduled Monday 02:30 UTC scan and `workflow_dispatch` runs are not path-filtered. The scan keeps `actions: read`, `contents: read`, and `security-events: write` at the job level.

### Path-to-workflow mapping

The entries under each `paths` list are ORed. A trigger runs when at least one listed path changes.

| Changed area | Backend Check | CodeQL |
|---|---:|---:|
| `backend/**` | Run | Run |
| `backend/README.md` | Run | Run |
| `.github/workflows/backend-check.yml` | Run | Skip |
| `.github/workflows/codeql.yml` | Skip | Run |
| both workflow files | Run | Run |
| `frontend/**` only | Skip | Skip |
| `docs/**` only | Skip | Skip |
| `database/**`, `tests/**`, root files, or other `.github/**` only | Skip | Skip |
| mixed backend + frontend/docs changes | Run | Run |

Root-level files do not trigger these workflows because the repository's Maven project is under `backend/`. If a root-level build configuration is introduced later, the path filters must be revisited.

### Event behavior

| Event | Backend Check | CodeQL | Path-filtered |
|---|---|---|---:|
| `pull_request` targeting `main` | Enabled | Enabled | Yes |
| `push` to `main` | Enabled | Enabled | Yes |
| `workflow_dispatch` | Enabled | Enabled | No |
| CodeQL `schedule` at `30 2 * * 1` UTC | N/A | Enabled | No |

### Branch protection

The current repository configuration does not require the two status checks for merging. The workflow changes in this design do not re-enable those requirements; the existing approving-review and conversation-resolution rules remain unchanged.

## Acceptance criteria

- A PR or push changing `backend/**` runs `Backend Check / Build and test` and `CodeQL / Analyze (java)`.
- A PR or push changing only `frontend/**`, `docs/**`, or unrelated paths does not run either backend workflow.
- A PR or push changing one workflow file runs that workflow so its configuration is exercised.
- A PR or push with mixed backend and frontend/docs changes runs both backend workflows.
- A manual CodeQL run is available regardless of changed paths.
- The scheduled CodeQL run remains configured for `30 2 * * 1` UTC.
- The workflow files use the documented least-privilege permissions and retain Java 21.
- `git diff --check` passes and both workflow files remain valid YAML.
