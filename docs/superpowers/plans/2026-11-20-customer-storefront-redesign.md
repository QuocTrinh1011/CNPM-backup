# Customer Storefront Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign every existing customer-facing storefront screen around ICONDENIM's retail layout patterns while preserving the project's brand, data, routes, API contracts, and behavior.

**Architecture:** Keep `App.jsx` as the owner of navigation, session, cart, and checkout state. Rework existing storefront and customer presentation modules, splitting only the home and catalog views where a focused module makes the interface clearer. Keep visual styles scoped to the user portal and organized by storefront area.

**Tech Stack:** React 19 JSX, Vite 8, CSS, Vitest, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-20-customer-storefront-redesign-design.md`

## Global Constraints

- Preserve all existing customer routes, API endpoints, request/response contracts, and business behavior.
- Keep the project's brand, copy, product data, and image sources; use ICONDENIM as a layout/interaction reference and do not copy its logo, campaign art, product photos, or site copy.
- Preserve the light/dark themes and local-storage key `anh-lon-shop-theme`.
- Verify desktop at 1440×900 and mobile at 390×844.
- Keep styles scoped to the storefront; do not alter Admin or Manager portals, backend, database, or Electron shell.
- Add no dependencies and no new test files. Use existing tests and visual checks; ask before adding tests if a real behavior gap appears.
- Make each task an independent local commit. Do not push or merge without a separate request.

## Review Focus

- **Catalog API empty/loading/error and image fallback:** retain the current status and fallback rendering in the catalog/home task; verify with `StorefrontHome.test.jsx`, `App.test.jsx`, and a screenshot with missing imagery.
- **Category, search, price, sort, and page state:** retain existing URL/history state through catalog presentation changes; verify with `App.test.jsx` and `customer-pages.test.jsx`.
- **Product variant/gallery and incomplete selection:** keep gallery mapping, color/size selection, and add-to-cart validation; verify with `ProductDetails.test.jsx` and `product-image-gallery.test.js`.
- **Guest cart, authentication return path, and checkout selection:** preserve login gating, cart ownership/selection, and payment completion behavior; verify with `cart-selection.test.jsx`, `customer-pages.test.jsx`, and `CheckoutPage.test.jsx`.
- **Dark theme and 390px layout:** ensure the user shell, dialogs, product grid, and account pages remain readable without horizontal overflow; verify with scoped CSS checks and the final 390×844 screenshots.

---

### Task 1: Capture reference and user-flow baseline

**Files:**
- No source files. Store screenshots and notes outside tracked source files.

**Interfaces:**
- Consumes: approved design spec and the existing customer portal.
- Produces: reference notes for home, catalog, product detail, cart/checkout, and account patterns; baseline screenshot set for desktop/mobile and light/dark themes.

- [ ] After the client session exposes REA tools, passively inspect the supplied ICONDENIM home, catalog, and product pages using the installed REA skill. Do not add items to cart, submit forms, or enter account data. If REA is still unavailable in the active chat, use only the already inspected public pages and record that limitation; do not reinstall the MCP server.
- [ ] Capture baseline screenshots of the project customer home, catalog, product detail, cart/checkout, and account/orders at 1440×900 and 390×844 in both storefront themes. Keep the artifacts outside source control.
- [ ] Run the customer e2e baseline: `npm run test:e2e -- --project=chromium e2e/customer-workflow.spec.js` from `frontend/`.
- [ ] Record the existing baseline: `npm test` = 414/414; `npm run build` succeeds with existing `lucide-react` `use client` directive warnings; `npm run lint` exits 0 with 28 existing warnings. Record e2e failures separately without fixing them in this redesign.

**Commit:** none; evidence only.

### Task 2: Redesign the shared storefront shell

**Files:**
- Modify: `frontend/src/app/App.jsx` only if required to change presentation composition; keep all state and handlers intact.
- Modify: `frontend/src/features/storefront/layout/StorefrontHeader.jsx`
- Modify: `frontend/src/features/storefront/layout/StorefrontMenuDrawer.jsx`
- Modify: `frontend/src/features/storefront/layout/StorefrontMobileNavigation.jsx`
- Modify: `frontend/src/features/storefront/layout/StorefrontFooter.jsx`
- Modify: relevant existing header, navigation, drawer, and footer files under `frontend/src/features/storefront/styles/storefront-base/` and `storefront-theme/`
- Test: `frontend/src/app/App.test.jsx`, `frontend/src/app/customer-pages.test.jsx`, and `frontend/src/app/portal-redesign.test.js`

**Interfaces:**
- Consumes: current `StorefrontHeader` props and callbacks from `App.jsx`.
- Produces: the same header, menu, theme, search, account, cart, and navigation behavior with a revised layout. Keep existing exported component names and prop contracts.

- [ ] Capture the shell's current accessible names and theme toggle behavior from existing tests.
- [ ] Restyle the announcement strip, wordmark, desktop navigation, search, account actions, and cart action. Keep each action wired to the existing callback.
- [ ] Restyle the mobile menu/drawer, bottom navigation, and footer. Preserve login gating and navigation destinations.
- [ ] Keep the theme toggle and `anh-lon-shop-theme` storage key unchanged.
- [ ] Run `npm test -- App.test.jsx customer-pages.test.jsx portal-redesign.test.js`, `npm run build`, and `npm run lint` from `frontend/`; compare the home and catalog screenshots at both viewport sizes.
- [ ] Commit as `refactor(storefront): redesign shared customer shell`.

### Task 3: Recompose the home page

**Files:**
- Modify: `frontend/src/features/storefront/StorefrontHome.jsx`
- Create if decomposition is needed: `frontend/src/features/storefront/home/StorefrontHero.jsx`
- Create if decomposition is needed: `frontend/src/features/storefront/home/StorefrontCategoryGrid.jsx`
- Create if decomposition is needed: `frontend/src/features/storefront/home/StorefrontProductSections.jsx`
- Modify: existing home styles under `frontend/src/features/storefront/styles/storefront-base/` and `storefront-theme/`
- Test: `frontend/src/features/storefront/StorefrontHome.test.jsx`, `frontend/src/app/App.test.jsx`

**Interfaces:**
- Consumes: `StorefrontHome({ products, onCatalog, onProduct, imageSrc })`.
- Produces: the same `StorefrontHome` exports and callbacks; any new home presentation modules receive only data and callbacks, with no API or session ownership.

- [ ] Keep the existing `StorefrontHome` prop contract and confirm the featured product and image fallback cases in `StorefrontHome.test.jsx`.
- [ ] Build the home hierarchy around the editorial hero, category/collection entry points, product sections, and store promises using only existing catalog data and project artwork.
- [ ] Extract hero, category grid, and product sections into focused modules only where each module has a clear presentation responsibility.
- [ ] Run `npm test -- StorefrontHome.test.jsx App.test.jsx`, `npm run build`, and `npm run lint` from `frontend/`; compare the home screenshots at both viewport sizes and both themes.
- [ ] Commit as `refactor(storefront): recompose customer home page`.

### Task 4: Redesign catalog controls and product grid

**Files:**
- Modify: `frontend/src/features/storefront/CatalogSection.jsx`
- Create: `frontend/src/features/storefront/catalog/CatalogToolbar.jsx`
- Create: `frontend/src/features/storefront/catalog/CatalogFilterPanel.jsx`
- Create: `frontend/src/features/storefront/catalog/ProductGrid.jsx`
- Reuse without changing behavior: `frontend/src/features/storefront/product-details/ProductCard.jsx` and current catalog/data hooks
- Modify: existing catalog styles under `frontend/src/features/storefront/styles/storefront-base/` and `storefront-theme/`
- Test: `frontend/src/app/App.test.jsx`, `frontend/src/app/customer-pages.test.jsx`, and existing filter-related tests discovered in Task 1

**Interfaces:**
- Consumes: the current `CatalogSection` props (`catalogPage`, `products`, `categories`, `filters`, state setters, and existing action callbacks).
- Produces: the same `CatalogSection` interface; toolbar/filter/grid modules are presentational and receive current values and handlers.

- [ ] Keep URL/history filter state in `App.jsx` and preserve the exact category, search, min/max price, sort, and pagination values.
- [ ] Implement the breadcrumb/title hierarchy, category controls, sort/filter toolbar, active-filter summary, product grid, loading/error/empty states, and pagination.
- [ ] Keep product card actions connected to existing product, wishlist, and cart callbacks.
- [ ] Run the relevant catalog tests discovered in Task 1, `npm run build`, and `npm run lint` from `frontend/`; compare catalog screenshots at both viewport sizes and both themes.
- [ ] Commit as `refactor(storefront): redesign catalog and filters`.

### Task 5: Restyle product detail and purchase options

**Files:**
- Modify: `frontend/src/features/storefront/ProductDetails.jsx`
- Modify only as presentation requires: existing modules under `frontend/src/features/storefront/product-details/`
- Modify: product styles under `frontend/src/features/storefront/styles/storefront-base/` and `storefront-theme/`
- Test: `frontend/src/features/storefront/ProductDetails.test.jsx`, `frontend/src/features/storefront/product-image-gallery.test.js`, `frontend/src/app/customer-pages.test.jsx`

**Interfaces:**
- Consumes: current product detail/modal props, product data, `imageSrc`, and existing purchase callbacks.
- Produces: unchanged product detail exports and purchase behavior; existing gallery, options, feedback, and size-guide modules remain the internal seams.

- [ ] Preserve image ordering, selected-color gallery mapping, legacy-image fallback, size selection, quantity, and add-to-cart/buy-now validation.
- [ ] Present the gallery and product purchase information as a desktop two-column layout with a stacked mobile layout; retain current price, promotion, delivery, return, and related-product content.
- [ ] Run `npm test -- ProductDetails.test.jsx product-image-gallery.test.js customer-pages.test.jsx`, `npm run build`, and `npm run lint` from `frontend/`; compare product screenshots at both viewport sizes and both themes.
- [ ] Commit as `refactor(storefront): redesign product detail presentation`.

### Task 6: Redesign cart, checkout, and payment states

**Files:**
- Modify: `frontend/src/features/storefront/CartDrawer.jsx`
- Modify: `frontend/src/features/storefront/CheckoutPage.jsx`
- Modify: `frontend/src/features/storefront/CheckoutState.jsx`
- Modify only for presentation composition if needed: `frontend/src/app/App.jsx`
- Modify: cart/checkout styles under `frontend/src/features/storefront/styles/storefront-base/` and `storefront-theme/`
- Test: `frontend/src/app/cart-selection.test.jsx`, `frontend/src/app/CheckoutPage.test.jsx`, and `frontend/e2e/customer-workflow.spec.js`

**Interfaces:**
- Consumes: existing cart state, checkout props, voucher wallet, address callbacks, and order/payment responses.
- Produces: unchanged cart and checkout exports/props. Keep cart selection, login gating, voucher application, address persistence, payment handling, and order completion in existing owners.

- [ ] Keep explicit item selection, totals, shipping fee, quantity updates, voucher application, and remove-item behavior unchanged.
- [ ] Restyle empty, loading, recoverable error, checkout, payment QR, and completed-order states without adding or removing transitions.
- [ ] Run `npm test -- cart-selection.test.jsx CheckoutPage.test.jsx`, `npm run build`, and `npm run lint` from `frontend/`; compare cart and checkout screenshots at both viewport sizes and both themes.
- [ ] Run the Chromium customer e2e and compare with its baseline. If the environment has an existing failure, record it without fixing unrelated backend/database setup.
- [ ] Commit as `refactor(storefront): redesign cart and checkout`.

### Task 7: Restyle authentication and customer account pages

**Files:**
- Modify: `frontend/src/features/customer/AccountDropdown.jsx`
- Modify: `frontend/src/features/customer/CustomerDialogs.jsx`
- Modify: `frontend/src/features/customer/CustomerLayout.jsx`
- Modify: `frontend/src/features/customer/CustomerPassword.jsx`
- Modify: `frontend/src/features/customer/CustomerVouchers.jsx`
- Modify: `frontend/src/features/customer/orders/CustomerOrders.jsx`
- Modify: `frontend/src/features/customer/OrderReviews.jsx`
- Modify only for current route composition if needed: `frontend/src/app/App.jsx`
- Modify: `frontend/src/features/customer/customer-pages.css` and existing account-related styles
- Test: existing customer tests under `frontend/src/features/customer/`, `frontend/src/app/customer-pages.test.jsx`, and `frontend/e2e/customer-workflow.spec.js`

**Interfaces:**
- Consumes: current `CustomerLayout({ children, pathname, user, navigate })`, account/auth modal props, and current customer page props.
- Produces: unchanged customer route guards, page destinations, form field names, accessible names, and data/action callbacks.

- [ ] Restyle login/register/recovery, account navigation, profile, addresses, password, vouchers, orders/reviews, wishlist, notifications, and survey screens using existing customer modules.
- [ ] Preserve authentication return destinations, protected page behavior, URL navigation/history, and all current form submissions.
- [ ] Run the existing account/password/voucher/customer-page tests, `npm run build`, and `npm run lint` from `frontend/`; compare account and order screenshots at both viewport sizes and both themes.
- [ ] Commit as `refactor(storefront): redesign customer account pages`.

### Task 8: Responsive, theme, and regression pass

**Files:**
- Modify: only existing storefront and customer CSS modules that failed the visual audit.
- Test: all existing frontend unit tests and customer e2e.
- Artifacts: screenshots kept outside tracked source files.

**Interfaces:**
- Consumes: finished shell, home, catalog, product, cart/checkout, and account presentation.
- Produces: visually consistent light/dark storefront at 1440×900 and 390×844 with no behavior changes.

- [ ] Check for horizontal overflow, obscured controls, unreadable text, broken sticky elements, and image layout shifts on home, catalog, product, cart/checkout, account, and orders pages.
- [ ] Check both themes at both viewport sizes; capture final screenshots in the same set and order as the baseline.
- [ ] Run `npm test`, `npm run build`, `npm run lint`, and the Chromium customer e2e from `frontend/`. Confirm the unit total remains 414 unless intentional test maintenance is approved; report lint warnings compared with the 28-warning baseline.
- [ ] Inspect `git diff --check`, verify no API/routes/backend/database/Admin/Manager files changed, and review the entire diff for presentation-only changes.
- [ ] Commit remaining visual corrections as `refactor(storefront): polish responsive and theme layouts`.

## Baseline Recorded Before Implementation

- `npm test`: **414 tests passed in 60 files**.
- `npm run build`: **passed**; existing Rollup warning about `use client` directives in `lucide-react`.
- `npm run lint`: **0 errors, 28 warnings** (existing warnings across test files, `SystemAdminApp.jsx`, and `WarehouseMaterials.jsx`).
- Chromium customer e2e has not yet been run; establish its baseline in Task 1.
