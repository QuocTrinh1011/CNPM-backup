# Review hardening follow-ups

## Goal

Address the remaining suggestions from the review after PR #15, with targeted tests and without changing business rules. Keep each backend/frontend concern testable through its existing service, configuration, or component interface.

## Decisions

1. **Survey recipients:** load explicitly selected users in one repository call with `findAllById`, then validate against the requested IDs in their original order. This removes N database lookups while preserving missing-user and inactive-user errors and the recipient set.
2. **CORS:** reject an exact `*` entry during `WebConfig` construction so a bad production environment fails at startup before a request is served. Continue accepting the configured explicit origin list.
3. **Profile SQL:** document that `select`, `from`, and `order` are trusted SQL fragments and must remain hard-coded by callers.
4. **Seed safety:** because the documented seed invocation uses `psql -f`, read `SPRING_PROFILES_ACTIVE` with psql's `\\getenv`, reject a profile list containing `prod`, and exit before the first data statement. This makes `seed_data.sql` a psql script; SQL-only clients such as pgAdmin cannot process the guard.
5. **JWT:** the analysis is already present in `docs/ops/jwt-hardening.md`; no additional JWT code change is in scope.
6. **Payment and filter behavior:** add regression tests for pending-payment polling and browser history restoration of manager filters. Do not call the real PayOS provider.
7. **User portal loading:** use `React.lazy` for route-level or interaction-only customer pages that are not rendered on the home page. Keep the storefront home and featured catalog eager because they render on the initial route. Add a small `Suspense` fallback at each lazy route boundary.
8. **App test exports:** existing named re-exports from `App.jsx` were used only by tests in this repository. Vite confirmed they prevented `CustomerOrders`, `CartDrawer`, and `AddressBook` from becoming separate chunks. Tests now import the component modules directly; route behavior, props, and the `CheckoutPage` `CheckoutState` export remain stable.

## Verification

- Backend: focused service/configuration tests, then `mvn -B -ntp verify`.
- Frontend: focused payment, filter-history, and route tests; then `npm run lint`, `npx vitest run`, and `npm run build -- --mode user`.
- Seed: inspect the psql guard and validate it with psql if the executable is available. Never execute the seed against a real or shared database.
- Compare the `UserPortal` entry chunk with the pre-change build and report the change; total assets may remain similar because lazily loaded chunks still exist in the production bundle.
