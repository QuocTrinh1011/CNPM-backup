# Windows Desktop App Design

## Goal

Package the existing ANH LỚN SHOP React application as one Windows desktop client that can open the User, Admin, and Manager portals and connect to the existing Spring Boot API.

## Decisions

- Use Electron because the project already uses React and Vite and the desktop client should reuse those portal screens.
- Build one production frontend containing the existing `/`, `/admin`, and `/manager` routes. Add a small Electron menu for switching portals; backend authorization remains authoritative.
- Package the frontend in the installer and serve it from a secure, standard `app://desktop` protocol. Keep the Spring Boot service and PostgreSQL database separate; the desktop app is a client and does not install or start them.
- Use a nonpersistent Electron session partition for the desktop window and register the protocol handler on that session. Chromium cookies and the main-process cookie fallback exist only in memory; closing the app ends the refresh session, so users sign in again on each new launch.
- Keep the web build's existing API URL behavior unchanged. Build the desktop renderer with its own Vite mode/environment, including a dedicated `VITE_DESKTOP_API_BASE_URL=/api`. Existing API call paths already begin with `/api/`, so the desktop API URL helper must normalize the base and request path to produce exactly one `/api` prefix.
- Store the Spring Boot API origin in a non-secret config file under Electron's user data directory. Main validates the file at startup and retains the validated endpoint in memory; hand-edits while the app is running do not change the active endpoint, and the file is validated again on the next launch. On first launch, show a configuration screen prefilled with `http://localhost:8080` and require the user to confirm/save before connecting. Permit `http` only for `localhost`, `127.0.0.1`, and IPv6 loopback `::1`; require `https` for every other host. Reject credentials, non-root paths, query strings, fragments, and malformed URLs. An absent or invalid saved value opens the configuration screen and never silently falls back to another URL.
- When the user saves a different API origin, validate it, clear every main-process fallback refresh cookie and every Chromium refresh cookie, persist the new origin, update the active in-memory endpoint, then reload the renderer. A cookie obtained from API origin A must never be sent to API origin B.
- Electron's main process serves packaged frontend assets and handles only `app://desktop/api/*` as API proxy requests. It forwards them to the validated configured API endpoint. The renderer does not call the backend origin directly.
- Produce a Windows `Setup.exe` with Electron Forge's Squirrel.Windows maker. Handle `electron-squirrel-startup` install/uninstall events before creating a BrowserWindow so setup and removal do not open the app unexpectedly.
- Initial scope is manual installation; code signing and automatic updates are later work. Document in the desktop README that an unsigned installer can trigger a Windows SmartScreen warning.

## Authentication prototype gate

This is the first implementation step and a go/no-go gate before building the rest of the desktop client:

1. Create a minimal Electron prototype that registers `app://desktop` as a standard, secure scheme and proxies the existing auth endpoints to a disposable test backend. Prefer a Spring Boot test instance when it can run against isolated test data; a contract-faithful local HTTP fixture is acceptable for the protocol/cookie transport gate and must never use production credentials.
2. Verify login, refresh after the access token expires or is cleared, and logout for customer, admin, and manager using the existing backend cookie contracts. All three cookies remain HttpOnly and `SameSite=Lax`; customer uses `refreshToken` with `Path=/api/auth`, admin uses `adminRefreshToken` with `Path=/api/admin/auth`, and manager uses `managerRefreshToken` with `Path=/api/manager/auth`. Do not change backend cookie policy or add `app://desktop` to backend CORS.
3. Verify whether Chromium persists `Set-Cookie` returned by the `protocol.handle` response and sends it on the next `app://desktop/api/auth/*`, `/api/admin/auth/*`, and `/api/manager/auth/*` request.
4. If Chromium does not persist/send cookies reliably within the running app session, Electron main captures only the three known refresh-cookie names and stores their values in process memory. Main attaches only the cookie matching the auth path being proxied and updates/clears it from auth responses. Never use `safeStorage` or persist a refresh cookie across app launches. Cookie values are never sent to renderer JavaScript, exposed through preload/IPC, logged, or placed in the config file.
5. Repeat the login/refresh/logout flow with the selected mechanism. Verify that a fresh app process has no prior refresh cookie and requires login again. If the flow cannot preserve the existing cookie contract, stop and revisit the design before proceeding.

## API proxy and request headers

- Accept only same-origin renderer requests whose path begins with `/api/`; reject other paths and malformed URLs. Join the path to the validated API origin without allowing the renderer to select a host.
- Remove renderer-supplied `Origin`, `Referer`, and `X-Forwarded-For` headers before forwarding. This avoids CORS origin changes and prevents renderer-controlled forwarding metadata from affecting `app.rate-limit.trusted-proxies`. Forward only the required application headers, including the bearer `Authorization` header and request content headers.
- For `/api/auth/*`, `/api/admin/auth/*`, and `/api/manager/auth/*`, forward only the browser-managed refresh cookie matching that path. Renderer JavaScript cannot set the forbidden `Cookie` request header; strip cookies from all non-auth requests and strip any nonmatching cookie names. If the prototype shows Chromium does not persist/send the cookie, use only the main-process fallback described above. Never accept a refresh-cookie value from renderer-controlled APIs.
- Use Electron's `net.fetch` in production and a dependency-injected `fetchImpl` in tests. Include `duplex: 'half'` whenever a forwarded request body is streamed. Read every response cookie with `headers.getSetCookie()` so rotation/clearing is not lost when multiple `Set-Cookie` headers exist.
- Keep the validated API endpoint in main-process memory after startup. A manual edit of the config file does not affect requests until restart; startup revalidates the edited value before using it.
- Use `redirect: 'manual'`. Do not follow redirects to another origin. Reject or safely translate redirect responses so the renderer cannot navigate to an untrusted backend URL.
- Return backend status, safe response headers, and body to the renderer while filtering hop-by-hop headers and never exposing internal configuration.
- If the backend cannot be reached, return HTTP 502 with a stable JSON error code `BACKEND_UNREACHABLE`.

## Frontend connection state

- Update the shared frontend API layer to recognize `BACKEND_UNREACHABLE` separately from normal HTTP/business errors.
- Provide a recoverable app-level connection screen for all three portals with **Thử lại** and **Đổi địa chỉ máy chủ** actions. Retry re-attempts the current route's initial load; changing the server opens the desktop configuration screen. This requires frontend changes as well as Electron main-process work.
- Use a minimal, sender-validated preload bridge only for reading configuration status and saving a validated API URL. Expose no Node/Electron APIs and no cookie or token values to React.
- Load `DesktopBootstrap`, `DesktopConfigScreen`, and `DesktopConnectionScreen` only through a dynamic import guarded by `import.meta.env.MODE === 'desktop'`. Web builds in user/admin/manager modes must not emit desktop modules and their total JS/CSS bundle size must remain within 1% of a baseline recorded before implementation.
- Keep web portal error behavior and API URL selection unchanged outside the dedicated desktop build.

## Routing, navigation, and content security

- Keep path-based SPA routes. The `app://desktop` asset handler serves a requested packaged static file when it exists; for every non-file path that is not under `/api/`, it serves `index.html`. This supports direct launch and reload of `/`, `/admin`, and `/manager`. API paths never fall back to the SPA document.
- Set `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`. Do not expose a general Electron/Node API to React. Restrict navigation to the packaged `app://desktop` origin and block every `window.open` request.
- Open external links only through a main-process allowlist. `shell.openExternal` accepts HTTPS URLs only and only exact approved hostnames; include the PayOS checkout host `pay.payos.vn` needed by the existing payment flow. Reject all other schemes and hosts. Never pass renderer-supplied arbitrary URLs directly to `shell.openExternal`.
- Attach a Content-Security-Policy to `app://desktop` responses with `script-src 'self'`, no inline scripts, no `eval`, and `connect-src 'self'`. Set `img-src 'self' data: https:` because admin-entered product images may use arbitrary HTTPS URLs. Permit the existing Google Fonts stylesheet and font hosts in `style-src` and `font-src` only.

## Installer contents

- Package the Electron runtime and production frontend only. Exclude `.env` files, the backend directory, database files/data, and development-only artifacts.
- Add a packaging verification script that scans the generated `out/` directory and fails if it finds `.env` files, backend/database payloads, or likely embedded credentials such as `password`, `secret`, API keys, and database URLs. Keep the scanner's allowlist narrow and document intentional matches.
- Do not bundle database credentials, Spring Boot configuration, or PostgreSQL data.

## Testing and acceptance checks

- First pass the authentication prototype gate above before proceeding.
- Add automated Electron end-to-end coverage using Playwright for login, refresh, and logout for customer, admin, and manager, plus backend-unreachable UI. Run against a disposable test backend/configuration; do not require production credentials.
- Add focused automated tests for API URL validation, exactly-one `/api` path composition, proxy path/header allowlisting, manual redirect handling, `BACKEND_UNREACHABLE`, SPA route fallback, external URL allowlisting, and installer-content scanning.
- Keep a manual checklist for opening all three portals from the menu, paying through the PayOS QR/link flow, and loading/reloading `/manager` directly.
- After Task 7, manually test login, refresh, and logout against a real Spring Boot backend for all three portals.
- Verify that each portal retains its current route and API behavior, and that user/admin/manager web bundles contain no desktop-only code and remain within 1% of the recorded JS/CSS baseline.
- Verify the installer contains no `.env`, backend, database data, or credentials.

## Out of scope

- Bundling or auto-starting Spring Boot or PostgreSQL.
- Offline operation, macOS/Linux builds, automatic updates, and code signing.
- Changing backend refresh-cookie policy, expanding backend CORS origins, or changing authorization rules.

## References

- [Electron security recommendations](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron custom protocols](https://www.electronjs.org/docs/latest/api/protocol)
- [Electron packaging](https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging)
- [Electron Forge Squirrel.Windows maker](https://www.electronforge.io/config/makers/squirrel.windows)
- [Playwright Electron support](https://playwright.dev/docs/api/class-electron)
