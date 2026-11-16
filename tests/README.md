# Tests

Automated tests live beside the application they cover:

- Backend: `backend/src/test/java` (JUnit and Spring Boot tests).
- Frontend: `frontend/src` (`*.test.js` and `*.test.jsx`, run with Vitest).
- End-to-end: `frontend/e2e` (Playwright against the real frontend, backend, and PostgreSQL).

Run the backend suite from `backend` with `mvn test -q`. Run the frontend suite from `frontend` with `npm test`; run `npm run build` there to verify the production bundle.

## Full-stack browser tests

The E2E runner creates and drops its schema, so it only accepts a local PostgreSQL URL whose database name is exactly `crm_e2e`. Never point it at a shared, demo, or production database. See [the frontend README](../frontend/README.md#full-stack-e2e) for local setup. GitHub Actions provisions a disposable PostgreSQL service and runs this suite for frontend or backend changes.

Database backup and restore exercises are operational procedures, not automated test cases. Keep evidence and test-specific fixtures with the owning module unless they need to be shared across the backend and frontend suites.
