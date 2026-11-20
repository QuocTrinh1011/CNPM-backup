# Customer Storefront Redesign — Design Spec

- **Date:** 2026-11-20
- **Branch:** `codex/icondenim-storefront-ui` (from `origin/main` @ `5f6aa61`)
- **Scope:** customer-facing web storefront in `frontend/src/app/App.jsx`, `frontend/src/features/storefront/**`, and `frontend/src/features/customer/**`
- **Out of scope:** Admin and Manager portals, backend, database, API contracts, Electron shell, new product or account functionality
- **Delivery:** isolated local branch; no push or merge is authorized by this request

## 1. Problem

The customer storefront already has working shopping and account flows, but its visual organization differs from the supplied ICONDENIM reference. The reference presents fashion commerce through a promotion strip and category navigation, editorial campaign sections, product collections, filterable catalog pages, and a product page with a large gallery and purchase information. The project should adopt that stronger storefront structure while keeping its own products, identity, and existing behavior.

The current UI is composed from a large app orchestrator plus feature modules. `UserPortal.jsx` loads several ordered CSS layers (`storefront-base.css`, `storefront-theme.css`, `storefront-customer.css`, and `storefront-catalog.css`). The app also keeps route, cart, account, and checkout state in `App.jsx`; visual work must preserve those flows and avoid introducing a competing CSS cascade.

## 2. Goals

- Redesign the complete customer-facing storefront using the reference's page hierarchy and interaction patterns.
- Preserve current routes, request and response contracts, product and customer data sources, cart and checkout semantics, account permissions, and UI capabilities.
- Keep the project's own brand, text, product imagery, and API-backed catalog. Use ICONDENIM as a layout and interaction reference; do not copy its logo, product photos, campaign artwork, or site copy.
- Keep the existing light and dark storefront themes and make both work across the redesign.
- Validate desktop at 1440×900 and mobile at 390×844, including screenshots of the key user pages.
- Use the existing React, CSS, Vite, Playwright, and test setup. Add no dependency.

## 3. Non-goals

- No change to Admin or Manager UI.
- No backend, schema, endpoint, payload, pricing, stock, authentication, or order-flow changes.
- No new shopping, loyalty, promotional, or account feature. A visual control must continue to trigger its existing action.
- No exact clone of ICONDENIM's protected identity or content.

## 4. Chosen Direction

**Full customer storefront redesign, adapted to this project.** Rework the information hierarchy and visual composition across the existing customer routes, using ICONDENIM's retail layout patterns while preserving the project's identity and behavior. The user selected this direction over a visual-only reskin.

Alternative considered: retain the current page structure and only change colors, type, and spacing. This has a smaller regression surface, but would not meet the request to reverse and apply the complete customer-facing storefront experience.

## 5. Reference Findings and Scope Map

The live reference was inspected at its home page, all-products listing, and a product-detail page. The current home page includes a promotional strip, primary category navigation, search/account/store/cart actions, a hero campaign, featured product rails, category collections, and a broad support/store footer. The catalog has breadcrumbs, sorting, a product grid, and pagination. The product-detail page combines a thumbnail/gallery area, price and promotion information, color selection, quantity, add-to-cart and buy-now actions, shipping/return information, and related products. The exact content and number of blocks vary by campaign.

The project's complete customer scope follows existing routes and modules:

| Area | Current responsibilities to preserve | Visual direction |
|---|---|---|
| Shared storefront shell | Announcement, `StorefrontHeader`, search, account actions, menu drawer, cart access, footer, mobile navigation | Compact campaign strip; clear category navigation; grouped search/account/cart actions; responsive drawer/navigation |
| Home | `StorefrontHome`, featured products, category navigation, product catalog preview, store promises | Editorial hero, category/collection entry points, campaign and product sections driven by current catalog data |
| Catalog | `CatalogSection`, category, price and keyword filters, sorting, pagination, product cards | Breadcrumb/title, compact filter and sort toolbar, responsive product grid, clear active filters |
| Product detail | `ProductDetails`, gallery, color/size selection, product feedback, add-to-cart and buy-now | Large gallery beside purchase information on desktop; stacked gallery and purchase controls on mobile |
| Cart and checkout | `CartDrawer`, `/gio-hang`, `/dat-hang`, voucher, address, payment and order-complete states | Clear line-item, totals, shipping, voucher and progression hierarchy; preserve explicit cart selection and payment behavior |
| Customer account | Login/register/recovery, profile, addresses, password, vouchers, orders/reviews, wishlist, notifications, surveys | Reuse a consistent account shell and responsive navigation without changing authentication or page guards |

Only routes and capabilities that already exist in the project are in scope. Do not add ICONDENIM policy/store routes that the project does not currently implement.

## 6. Visual and Responsive Rules

- Keep the current project wordmark, product/catalog data, and image resolver. Do not hotlink ICONDENIM assets.
- Define visual tokens in the existing storefront CSS scope, not global `:root`, so styles cannot leak into Admin or Manager.
- Preserve theme selection and the existing local-storage key `anh-lon-shop-theme`.
- Preserve accessible names, headings needed by tests, focus states, reduced-motion behavior, and keyboard operation.
- At 1440×900, use a composed multi-column retail layout with an editorial home page and a readable catalog density.
- At 390×844, keep primary navigation and purchase controls reachable, use an appropriate drawer or bottom navigation where the existing interaction supports it, and prevent horizontal overflow.
- Verify light and dark storefront appearances at both viewport sizes. Keep image aspect ratios, avoid layout shifts, and retain current product-image fallbacks.

## 7. Architecture and Module Seams

- `App.jsx` remains the coordinator for session, cart, navigation, and checkout. Keep data and side-effect ownership there unless an existing hook or feature module already owns it.
- Keep presentational modules under `features/storefront/` and customer-account modules under `features/customer/`.
- Split the home page into focused presentation modules for the hero, category/collection sections, product rails, and store promises where the current props provide enough data. Keep product navigation callbacks at the existing seam.
- Keep catalog controls and product cards independent from filter state and API loading; pass the existing values and handlers down without reimplementing them.
- Reuse current product-detail modules (`product-details/`) and customer modules. Change layout/presentation while preserving their existing callbacks and state transitions.
- Organize styles by shell, home, catalog, product, checkout/cart, customer pages, and responsive rules. Retain the existing import order until selector ownership is clear; remove or replace a CSS rule only after confirming its current owner and coverage.
- Avoid a large rewrite of `App.jsx` and avoid new generic design-system abstractions that do not simplify an actual storefront seam.

## 8. Implementation Sequence

1. Capture baseline screenshots and run the relevant frontend baseline checks. Record current behavior and CSS contracts before changing presentation.
2. Redesign the shared shell: announcement, header/search/category navigation, mobile menu/navigation, and footer. Verify home and catalog still navigate through existing callbacks.
3. Redesign home content sections using current API products and project imagery.
4. Redesign catalog toolbar, filters, cards, grid, and pagination without changing filter state or query parameters.
5. Redesign product detail gallery, options, purchase actions, policies, and related products without changing selected-variant/cart behavior.
6. Redesign cart and checkout presentation while preserving login gating, explicit cart selection, voucher application, address handling, payment and order confirmation.
7. Apply the account visual system to existing authentication and customer pages.
8. Run frontend unit/build/lint and customer e2e checks, then capture desktop/mobile screenshots in both storefront themes and compare them with the baseline/reference patterns.

Each implementation step should be a small commit-sized change. Do not delete an existing module or selector until repository search and tests show it has no remaining use.

## 9. Verification

Use the existing commands from `frontend/`:

```text
npm test
npm run build
npm run lint
```

Run the existing customer workflow e2e (`frontend/e2e/customer-workflow.spec.js`) when its disposable test database prerequisites are available. Keep targeted tests for home, product details, customer routes, checkout, cart selection, and `portal-redesign.test.js` green. No new test files are planned unless a real behavior gap is discovered and the user authorizes test additions.

Capture at least the home, catalog, product detail, cart/checkout, and customer-account/order views at 1440×900 and 390×844; inspect both light and dark storefront themes. Record failures already present before implementation separately from new regressions.

## 10. Risks and Open Implementation Details

- **CSS cascade:** four stylesheet entry points and selector overrides can make a local change appear correct on one page while breaking another. Preserve portal scope and verify all page groups after each CSS layer change.
- **App orchestration:** `App.jsx` owns route and session decisions; a visual rewrite could accidentally change protected routes, login return destinations, or cart ownership. Keep these state transitions at the existing seam.
- **Image availability:** use current product data and local artwork/fallbacks. Do not add or download reference-site imagery; if project imagery is inadequate, report the gap for a user decision.
- **External analysis tooling:** the REA skill and MCP registration are installed for Codex; the active client must restart before the REA MCP tools become available. Continue source work only after the reference investigation has sufficient evidence.
- **Scope breadth:** authentication, orders, checkout, and account pages are part of the request because they are user-facing storefront screens. Keep their existing content and operations intact while changing layout.
