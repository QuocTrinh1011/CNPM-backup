# Windows Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one Windows Electron application that opens the User, Admin, and Manager portals and connects securely to the existing Spring Boot API.

**Architecture:** Build the existing Vite frontend in a dedicated desktop mode and serve the packaged assets from a standard, secure `app://desktop` origin. Electron main owns API URL configuration, proxies `/api/*`, and keeps refresh-cookie handling out of renderer JavaScript; the Spring Boot service and PostgreSQL remain separately operated.

**Tech Stack:** React 19, Vite 8, Electron, Electron Forge Squirrel.Windows, Vitest, Playwright Electron automation, Node.js.

**Spec:** `docs/superpowers/specs/windows-desktop-app-design.md`

## Global Constraints

- Use Electron + Electron Forge Squirrel.Windows and produce a Windows `Setup.exe`.
- Package the frontend and Electron runtime only; do not bundle Spring Boot, PostgreSQL, database data, or credentials.
- Set `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`; expose only the minimal validated configuration bridge.
- Keep the web build's existing API URL behavior unchanged; desktop uses `VITE_DESKTOP_API_BASE_URL=/api` and must produce exactly one `/api` prefix.
- Preserve all three backend refresh-cookie contracts: customer `refreshToken` at `/api/auth`, admin `adminRefreshToken` at `/api/admin/auth`, and manager `managerRefreshToken` at `/api/manager/auth`; all remain HttpOnly and `SameSite=Lax`.
- Do not change backend cookie policy, backend CORS origins, authorization rules, or database configuration.
- Remove renderer-supplied `Origin`, `Referer`, and `X-Forwarded-For`; use `redirect: 'manual'` for proxied API calls.
- Permit `http` only for `localhost`, `127.0.0.1`, and `::1`; require `https` for all other API hosts. Missing or invalid configuration must show the configuration screen.
- Store an API origin only; reject credentials, non-root paths, query strings, fragments, and malformed values.
- Keep the desktop Electron session and refresh-cookie fallback in memory only; users sign in again after each app launch.
- When the API origin changes, clear all Chromium and fallback refresh cookies before reloading; no cookie issued by origin A may reach origin B.
- Main validates the config at startup and on save, then uses its validated in-memory value; manual file edits take effect only after a restart and startup revalidation.
- Serve `index.html` for non-file SPA routes outside `/api/`; never route API paths to the SPA fallback.
- CSP uses `script-src 'self'`, blocks inline scripts and `eval`, and sets `connect-src 'self'`; use `img-src 'self' data: https:` and explicit Google Fonts hosts in `style-src`/`font-src`.
- Load desktop bootstrap/configuration/connection UI only through a dynamic import guarded by `import.meta.env.MODE === 'desktop'`; web bundle JS/CSS sizes must remain within 1% of a baseline recorded before implementation.
- Production proxy uses Electron `net.fetch`, tests inject `fetchImpl`, request bodies use `duplex: 'half'`, and all `Set-Cookie` values are read with `headers.getSetCookie()`.
- Every Vitest unit test under `frontend/electron/` starts with `// @vitest-environment node`.
- Only allow exact approved HTTPS hosts through `shell.openExternal`, including PayOS checkout host `pay.payos.vn`.
- Keep offline operation, macOS/Linux builds, automatic updates, and code signing out of scope.

## Review Focus

- Refresh-cookie persistence and rotation for all three portal audiences, including logout clearing, no renderer access to HttpOnly values, and fresh login after relaunch (Tasks 1 and 7 E2E).
- API URL validation for remote HTTP, loopback HTTP, credentials, malformed values, edited config after startup, and origin changes (Task 2 tests).
- Cookie isolation when switching from API origin A to B, including both Chromium and main-process cookie stores (Tasks 2 and 3 tests).
- Renderer attempts to spoof trusted headers, select another proxy host/path, or follow a backend redirect (Task 3 tests).
- Direct SPA routes versus missing assets, `/api/` requests, path traversal, and untrusted navigation (Task 4 tests).
- Backend outage recovery and invalid-config recovery without silently falling back to localhost (Task 5 tests).

## File Map

| File group | Responsibility |
| --- | --- |
| `frontend/electron/main.mjs`, `preload.cjs` | Electron lifecycle, secure window, and narrow configuration bridge |
| `frontend/electron/api-config.mjs`, `config-store.mjs` | Validate and persist the non-secret API endpoint under `app.getPath('userData')` |
| `frontend/electron/api-proxy.mjs`, `refresh-cookie-store.mjs` | Restrict backend requests and preserve refresh-cookie rotation without exposing tokens to React |
| `frontend/electron/protocol-router.mjs`, `external-links.mjs` | Route `app://desktop`, serve SPA/assets, set CSP, and gate external navigation |
| `frontend/src/api/api-url.js`, `frontend/src/api/api.js`, `frontend/src/api/manager-api.js` | Select the desktop same-origin API base without changing web builds |
| `frontend/src/desktop/*`, `frontend/src/main.jsx` | API configuration and connection recovery UI for desktop mode |
| `frontend/electron-forge.config.mjs`, `frontend/scripts/*`, `frontend/package.json` | Desktop build, Squirrel.Windows packaging, E2E, and installer-content checks |
| `frontend/README.md`, `README.md`, `.github/workflows/windows-desktop.yml` | Developer/user instructions and Windows packaging verification |

---

### Task 1: Prototype the `app://desktop` authentication flow

**Files:**
- Create: `frontend/electron/main.mjs`
- Create: `frontend/electron/api-proxy.mjs`
- Create: `frontend/electron/refresh-cookie-store.mjs`
- Create: `frontend/electron/test/auth-fixture.html`
- Create: `frontend/scripts/mock-auth-backend.mjs`
- Create: `frontend/scripts/desktop-auth-prototype.e2e.mjs`
- Modify: `frontend/package.json`, `frontend/package-lock.json` (set Electron `main` entry to `electron/main.mjs`)
- Test: `frontend/electron/refresh-cookie-store.test.mjs`

**Interfaces:**
- `proxyApiRequest(request, { apiBaseUrl, cookieStore, fetchImpl }) -> Promise<Response>` accepts an `app://desktop/api/*` request and a fixed API origin; production injects Electron `net.fetch`, tests inject `fetchImpl`.
- `refresh-cookie-store.mjs` exposes `cookieForPath(pathname, browserCookieHeader)`, `captureSetCookies(pathname, headers)`, and `clearAll()`; it accepts only the matching browser-managed cookie and keeps fallback values in process memory only.
- The E2E fixture runs on `app://desktop` and can call only same-origin `/api/*` endpoints.
- The desktop window uses a nonpersistent `session.fromPartition('desktop-session')`; closing Electron drops Chromium's cookie jar and all fallback cookies.

- [ ] **Step 1: Capture a clean frontend baseline before implementation.** Run `npm ci`, `npm test`, and `npx vite build --mode user`, `--mode admin`, and `--mode manager`; record test totals and each mode's total generated JS/CSS bytes in the SDD ledger.
- [ ] **Step 2: Add the Electron and Playwright test dependencies and the `desktop:test:auth-prototype` script.** Set package `main` to `electron/main.mjs`. Use current stable Electron and a Playwright version that supports it; pin resolved versions in `package-lock.json`, then run `npm ci` from `frontend`.
- [ ] **Step 3: Write the failing auth protocol E2E and Node-environment cookie-store unit test.** The HTTP fixture sets exact cookie attributes and rotates/clears each audience's cookie. Assert the renderer cannot read HttpOnly values, a fresh Electron process has no prior session, and `captureSetCookies` handles multiple `Set-Cookie` headers. Add `// @vitest-environment node` to the unit test.
- [ ] **Step 4: Run `npm run desktop:test:auth-prototype` and `npx vitest run electron/refresh-cookie-store.test.mjs`; verify the E2E fails because the custom protocol/proxy is missing and the unit test fails because the cookie store is missing.**
- [ ] **Step 5: Implement the minimum production-shaped protocol and proxy.** Register `app` as standard, secure, and fetch-capable before Electron becomes ready; create a nonpersistent session partition and register `session.protocol.handle`; use a locked test API URL only in the prototype harness; set secure `BrowserWindow` preferences; call `net.fetch` in production and inject `fetchImpl` in tests; pass `duplex: 'half'` when forwarding a request body.
- [ ] **Step 6: Run the auth E2E and cookie-store tests again.** If Chromium does not persist `Set-Cookie` inside the app session, keep the fallback in main-process memory and attach only the cookie matching the auth path. Use `headers.getSetCookie()`; never persist, expose, or log cookie values.
- [ ] **Step 7: Verify login, refresh, logout, cookie rotation/clearing, and fresh-login-after-relaunch for customer, admin, and manager.** If any audience cannot pass without backend cookie/CORS changes, stop and report the prototype gate failure before later tasks.
- [ ] **Step 8: Commit the passing prototype.** `git add frontend/package.json frontend/package-lock.json frontend/electron frontend/scripts/mock-auth-backend.mjs frontend/scripts/desktop-auth-prototype.e2e.mjs` then `git commit -m "feat(frontend-desktop): verify protocol auth cookies"`.

### Task 2: Add desktop API URL composition and validated runtime configuration

**Files:**
- Create: `frontend/src/api/api-url.js`, `frontend/src/api/api-url.test.js`
- Create: `frontend/electron/api-config.mjs`, `frontend/electron/api-config.test.mjs`
- Create: `frontend/electron/config-store.mjs`, `frontend/electron/config-store.test.mjs`
- Create: `frontend/electron/preload.cjs`
- Create: `frontend/src/desktop/DesktopConfigScreen.jsx`, `frontend/src/desktop/DesktopConfigScreen.test.jsx`
- Modify: `frontend/src/api/api.js`, `frontend/src/api/manager-api.js`, `frontend/src/api/api.test.js`, `frontend/src/main.jsx`, `frontend/electron/main.mjs`

**Interfaces:**
- `buildApiUrl(base: string, path: string) -> string` joins `/api` with existing `/api/...` call paths without duplicating the prefix; ordinary web base URLs retain their current result.
- `validateApiBaseUrl(value: string) -> { ok: true, value: string } | { ok: false, code: string }` accepts HTTPS remote origins and HTTP loopback only.
- `ConfigStore.load() -> Promise<{ apiBaseUrl: string } | null>` and `ConfigStore.save(value: string) -> Promise<{ apiBaseUrl: string }>` read/write the non-secret JSON config under Electron user data.
- `ActiveApiConfig.current()` returns the startup/save-validated origin held in memory; `ActiveApiConfig.save(value)` validates, persists, updates that origin, and clears all auth cookies if it changed.
- `window.desktopConfig.load()` and `window.desktopConfig.saveApiBaseUrl(value)` are the only renderer bridge methods; neither returns cookies, tokens, paths, or generic IPC access.

- [ ] **Step 1: Write API URL tests.** Assert web base `http://localhost:8080` plus `/api/products` stays unchanged; desktop base `/api` plus `/api/products` and `/api/manager/users` produces one `/api` prefix.
- [ ] **Step 2: Run `npx vitest run src/api/api-url.test.js src/api/api.test.js` and verify the desktop cases fail.**
- [ ] **Step 3: Implement `buildApiUrl` and update both API modules.** In desktop mode use only `VITE_DESKTOP_API_BASE_URL`; otherwise preserve the existing `VITE_API_BASE_URL` fallback and web request behavior.
- [ ] **Step 4: Run the API tests and verify all prior web URL assertions plus the new desktop assertions pass.**
- [ ] **Step 5: Write API config validation tests.** Accept `http://localhost:8080`, `http://127.0.0.1:8080`, `http://[::1]:8080`, and HTTPS remote origins; reject remote HTTP, credentials, malformed URLs, query strings, fragments, and non-origin paths.
- [ ] **Step 6: Implement and test the config store plus active in-memory endpoint.** Validate on startup and save; external edits to the JSON file do not change `current()` until a new runtime loads and validates the file. Invalid startup values stay unconfigured.
- [ ] **Step 7: Add the minimal preload bridge and validate IPC sender origin in main.** Saving a changed origin clears all fallback and Chromium auth cookies, updates the active endpoint, then reloads the renderer. Add tests that renderer config calls cannot request or receive a cookie/token.
- [ ] **Step 8: Write the edited-config-after-startup test.** Start with origin A, edit the persisted file to origin B externally, and assert the active runtime still returns A; construct a new runtime and assert it validates/uses B.
- [ ] **Step 9: Add the first-launch configuration screen.** Prefill the input with `http://localhost:8080`, require explicit Save/Continue, show validation errors, and reload the current route after a successful save.
- [ ] **Step 10: Run `npx vitest run src/api/api-url.test.js src/api/api.test.js src/desktop/DesktopConfigScreen.test.jsx electron/api-config.test.mjs electron/config-store.test.mjs`; verify URL composition and edited-config tests pass.**
- [ ] **Step 11: Commit.** `git add frontend/src/api frontend/src/desktop frontend/electron frontend/src/main.jsx` then `git commit -m "feat(frontend-desktop): configure the API endpoint"`.

### Task 3: Harden the main-process API proxy

**Files:**
- Modify: `frontend/electron/api-proxy.mjs`, `frontend/electron/refresh-cookie-store.mjs`, `frontend/electron/main.mjs`
- Create: `frontend/electron/api-proxy.test.mjs`, `frontend/electron/refresh-cookie-store.test.mjs`

**Interfaces:**
- `proxyApiRequest(request, { apiBaseUrl, cookieStore, fetchImpl }) -> Promise<Response>` accepts only `/api/*`, uses the validated fixed API origin, and returns a sanitized response.
- The proxy recognizes customer `refreshToken`, admin `adminRefreshToken`, and manager `managerRefreshToken` only on their corresponding auth path prefixes.
- Production passes Electron `net.fetch`; unit tests pass a fake `fetchImpl`. `Set-Cookie` parsing uses `headers.getSetCookie()`.

- [ ] **Step 1: Write proxy tests for disallowed paths and renderer-controlled target URLs.** Assert `/outside`, malformed URLs, and host override attempts are rejected before backend fetch is called.
- [ ] **Step 2: Write header tests.** Pass `Origin`, `Referer`, `X-Forwarded-For`, `Host`, and hop-by-hop headers; assert the forwarded request omits them while preserving method, body, `Authorization`, `Accept`, and `Content-Type`.
- [ ] **Step 3: Write redirect, body, cookie, origin-change, and outage tests.** Assert `fetchImpl` receives `redirect: 'manual'` and `duplex: 'half'` for streamed bodies; multiple `Set-Cookie` headers rotate/clear cookies; saving origin B after login with A clears both cookie stores and no cookie from A reaches B; cross-origin redirects are not followed; connection refusal returns status 502 with `{ code: 'BACKEND_UNREACHABLE' }`.
- [ ] **Step 4: Run `npx vitest run electron/api-proxy.test.mjs electron/refresh-cookie-store.test.mjs` and verify the new policy assertions fail.**
- [ ] **Step 5: Implement the request/response policy.** Preserve allowed auth cookie flow, strip all nonmatching and non-auth cookies, filter hop-by-hop response headers, and never return internal endpoint/configuration details. Clear the in-memory cookie store and Electron session cookies when the API origin changes.
- [ ] **Step 6: Run the proxy and cookie-store tests plus `npm run desktop:test:auth-prototype`; verify all three cookie scopes still pass.**
- [ ] **Step 7: Commit.** `git add frontend/electron` then `git commit -m "feat(frontend-desktop): secure the API proxy"`.

### Task 4: Serve SPA routes and enforce navigation/CSP rules

**Files:**
- Create: `frontend/electron/protocol-router.mjs`, `frontend/electron/protocol-router.test.mjs`
- Create: `frontend/electron/external-links.mjs`, `frontend/electron/external-links.test.mjs`
- Modify: `frontend/electron/main.mjs`

**Interfaces:**
- `classifyAppRequest(url, assetExists) -> { kind: 'api' | 'asset' | 'spa' | 'reject', path?: string }` requires host `desktop`, prevents decoded path traversal, and never classifies `/api/*` as SPA.
- `approvedExternalUrl(value) -> URL | null` returns a URL only for HTTPS and exact host `pay.payos.vn`.

- [ ] **Step 1: Write route tests.** Assert `/`, `/admin`, `/manager`, and a nested portal route resolve to the SPA document; existing assets resolve to files; missing non-API files resolve to the SPA; `/api/*`, a wrong host, and encoded traversal do not resolve to `index.html`.
- [ ] **Step 2: Write external navigation tests.** Allow `https://pay.payos.vn/...`; reject HTTP, `javascript:`, `mailto:`, lookalike subdomains, and all non-allowlisted hosts.
- [ ] **Step 3: Run `npx vitest run electron/protocol-router.test.mjs electron/external-links.test.mjs` and verify failures.**
- [ ] **Step 4: Implement secure static-file resolution.** Use canonical resolved paths bounded under `frontend/dist`; return `index.html` only for non-file paths outside `/api/`.
- [ ] **Step 5: Add response CSP.** Set `script-src 'self'` with no inline script or eval; set `connect-src 'self'`; set `img-src 'self' data: https:`; allow Google Fonts only in `style-src`/`font-src`. Do not set Electron's `bypassCSP` privilege.
- [ ] **Step 6: Run the router tests and inspect a desktop response to verify the exact `script-src`, `connect-src`, and `img-src` policies and the Google Fonts exceptions.**
- [ ] **Step 7: Add the native portal menu and navigation handlers.** Add menu entries for `/`, `/admin`, and `/manager`; deny every in-app navigation outside `app://desktop`; deny all new BrowserWindows while routing only an exact approved PayOS HTTPS target through `shell.openExternal`.
- [ ] **Step 8: Run the external URL tests and verify no unapproved navigation or window can open.**
- [ ] **Step 9: Commit.** `git add frontend/electron` then `git commit -m "feat(frontend-desktop): secure routing and navigation"`.

### Task 5: Add recoverable backend connection UI

**Files:**
- Create: `frontend/src/desktop/DesktopBootstrap.jsx`, `frontend/src/desktop/DesktopBootstrap.test.jsx`
- Create: `frontend/src/desktop/DesktopConnectionScreen.jsx`, `frontend/src/desktop/DesktopConnectionScreen.test.jsx`
- Modify: `frontend/src/main.jsx`, `frontend/src/api/api.js`, `frontend/src/api/manager-api.js`

**Interfaces:**
- In desktop mode, the API error layer dispatches `shop-backend-unreachable` only for response code `BACKEND_UNREACHABLE`; ordinary business errors retain their existing behavior.
- `DesktopBootstrap` waits for `window.desktopConfig.load()` before mounting a portal; invalid/missing config renders `DesktopConfigScreen`.
- `DesktopConnectionScreen` has accessible buttons **Thử lại** (reload current route) and **Đổi địa chỉ máy chủ** (dispatch `shop-desktop-open-config`, handled by `DesktopBootstrap`).
- `main.jsx` imports `DesktopBootstrap` dynamically only inside `if (import.meta.env.MODE === 'desktop')`; its configuration and connection screens are reachable only from that desktop chunk.

- [ ] **Step 1: Write tests for the error mapping.** A 502 `BACKEND_UNREACHABLE` emits the desktop event; 4xx business errors and all non-desktop web mode errors do not.
- [ ] **Step 2: Write bootstrap tests.** Assert a valid configured endpoint mounts the selected portal, a missing/invalid endpoint mounts configuration first, and no portal API load occurs before configuration is accepted.
- [ ] **Step 3: Write connection-screen tests.** Assert Retry reloads the current route and Change server opens the configuration screen.
- [ ] **Step 4: Run `npx vitest run src/desktop` and verify these tests fail before implementation.**
- [ ] **Step 5: Implement the desktop-only event and screen behavior with a dynamic import gated by `import.meta.env.MODE === 'desktop'`.** Preserve all existing web error handling and route selection.
- [ ] **Step 6: Build `user`, `admin`, and `manager` modes and verify there are no emitted DesktopBootstrap/Config/Connection chunks; compare generated JS/CSS sizes to the Task 1 baseline and require each combined total to stay within 1%.**
- [ ] **Step 7: Run `npx vitest run src/desktop src/api` and verify all tests pass.**
- [ ] **Step 8: Commit.** `git add frontend/src/desktop frontend/src/main.jsx frontend/src/api` then `git commit -m "feat(frontend-desktop): recover from backend outages"`.

### Task 6: Package a Windows installer and scan its contents

**Files:**
- Create: `frontend/electron-forge.config.mjs`
- Create: `frontend/scripts/build-desktop.mjs`
- Create: `frontend/scripts/verify-desktop-package.mjs`, `frontend/scripts/verify-desktop-package.test.js`
- Modify: `frontend/package.json`, `frontend/package-lock.json`, `frontend/README.md`, `README.md`, `.gitignore`

**Interfaces:**
- `npm run desktop:build` sets `VITE_DESKTOP_API_BASE_URL=/api` and runs `vite build --mode desktop` without changing `npm run build` or the user/admin/manager modes.
- `npm run desktop:make` builds the desktop renderer and invokes Electron Forge Squirrel.Windows to create `Setup.exe`.
- `npm run desktop:verify-package` scans `out/` and fails for `.env` files, backend/database payloads, and likely embedded credential assignments.

- [ ] **Step 1: Write scanner tests.** Create temporary `out/` fixtures containing `.env`, backend/database paths, and secret-like credential assignments; assert each fails. Assert ordinary minified UI text containing the words “password” or “secret” without an assigned value does not create a false positive.
- [ ] **Step 2: Run `npx vitest run scripts/verify-desktop-package.test.js` and verify the tests fail because the scanner is missing.**
- [ ] **Step 3: Implement the scanner.** Inspect generated app contents (including `app.asar` through `@electron/asar`) and fail with the exact offending path/pattern; do not print secret values.
- [ ] **Step 4: Add Forge, Electron Squirrel startup, and metadata.** Add `@electron/asar` for package inspection; configure Squirrel.Windows, stable `productName`/package identifier, required author/description, production file allowlist, and early `electron-squirrel-startup` handling before BrowserWindow creation.
- [ ] **Step 5: Add desktop npm scripts and ignore generated output.** Keep existing web scripts intact; add build, start, make, E2E, and package verification scripts; add `frontend/out/` to the root `.gitignore`.
- [ ] **Step 6: Run `npm run desktop:build`, `npm run desktop:make`, and `npm run desktop:verify-package` on Windows.** Verify one `Setup.exe` is produced and the scanner passes on the actual generated `out/` tree.
- [ ] **Step 7: Update both READMEs.** Document setup/launch, API endpoint configuration, that the backend/database must be run separately, sign-in is required each time the desktop app starts, unsigned-installer SmartScreen warning, and the explicit out-of-scope items.
- [ ] **Step 8: Commit.** `git add frontend/package.json frontend/package-lock.json frontend/electron-forge.config.mjs frontend/scripts/build-desktop.mjs frontend/scripts/verify-desktop-package.mjs frontend/scripts/verify-desktop-package.test.js frontend/README.md README.md .gitignore` then `git commit -m "feat(frontend-desktop): package Windows installer"`.

### Task 7: Complete full Electron E2E and acceptance verification

**Files:**
- Create: `frontend/scripts/desktop-e2e.mjs`
- Create: `.github/workflows/windows-desktop.yml`
- Modify: `frontend/scripts/mock-auth-backend.mjs`, `frontend/package.json`, `frontend/README.md`

**Interfaces:**
- `npm run desktop:test:e2e` launches the packaged-mode app with an isolated temporary user-data directory and disposable mock API; it does not use developer or production credentials.
- The mock API can simulate normal auth, rotated/cleared refresh cookies, and a backend that becomes unreachable.

- [ ] **Step 1: Add Playwright E2E for the full built application.** Verify login/refresh/logout for customer, admin, and manager through `app://desktop`; verify an unreachable backend displays the connection screen and both actions work; verify direct `/manager` launch/reload and menu route switching.
- [ ] **Step 2: Run `npm run desktop:build` followed by `npm run desktop:test:e2e`; verify the complete login, refresh, logout, outage recovery, and route flow passes against the disposable backend.**
- [ ] **Step 3: Run final web and desktop checks from `frontend`:**

  ```powershell
  npm test
  npm run build -- --mode user
  npm run build -- --mode admin
  npm run build -- --mode manager
  npm run desktop:build
  npm run desktop:test:e2e
  npm run desktop:make
  npm run desktop:verify-package
  ```

- [ ] **Step 4: Complete the manual checklist.** Open all three portals from the menu, reload `/manager`, verify PayOS QR rendering and approved checkout-link handoff without making a real payment, and verify invalid API configuration plus backend outage recovery.
- [ ] **Step 5: With a disposable Spring Boot backend and test accounts, manually verify login, refresh, and logout on customer, admin, and manager.** Confirm no backend cookie/CORS change was needed; verify relaunch requires login again and switching API origin cannot reuse the old session.
- [ ] **Step 6: Add Windows packaging CI.** Trigger on `frontend/**`, relevant workflow changes, and manual dispatch. On `windows-latest`, run `npm ci`, `npm test`, desktop build, desktop E2E, `desktop:make`, and package scan. Keep the existing frontend workflow's `frontend/**` filter covering the new files.
- [ ] **Step 7: Confirm backend and database files are unchanged.** Review `git diff -- backend database` and verify it is empty.
- [ ] **Step 8: Commit the final E2E/CI verification.** `git add frontend/scripts/desktop-e2e.mjs frontend/scripts/mock-auth-backend.mjs frontend/package.json frontend/README.md .github/workflows/windows-desktop.yml` then `git commit -m "test(frontend-desktop): verify Windows portal flows"`.

## Implementation Notes

- Playwright documents Electron automation as experimental. Keep it isolated to the desktop E2E script, pin the resolved dependency in the lockfile, and keep pure proxy/config/router tests in Vitest.
- Squirrel.Windows package generation runs on Windows in this project; verify the actual installer rather than treating a successful Vite build as a package check.
- The existing frontend `index.html` loads Google Fonts. Preserve those resources only through explicit `style-src` and `font-src` entries; do not broaden `connect-src` beyond `'self'`.
- The backend currently has three distinct refresh-cookie paths/names. Tests must cover each portal instead of assuming a single `/api/auth` cookie.
- The first auth E2E is a go/no-go protocol transport check. A local fixture may stand in for Spring Boot only to test the browser/Electron cookie boundary; it must reproduce the current cookie attributes and use no real credentials.
- The Electron cookie jar uses a nonpersistent session; main-process fallback cookies are memory-only. Restarting the app requires login again.
- Record the three web-mode bundle baselines in the Task 1 ledger and compare them in Task 5; the desktop-only React chunk must be absent from web builds.

## Implementation References

- [Electron custom protocols](https://www.electronjs.org/docs/latest/api/protocol)
- [Electron security recommendations](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron Forge Squirrel.Windows maker](https://www.electronforge.io/config/makers/squirrel.windows)
- [Playwright Electron automation](https://playwright.dev/docs/api/class-electron)
