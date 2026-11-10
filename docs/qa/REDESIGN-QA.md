# User / Manager redesign — 2026-10-08

Reference: `stitch_crm_ui_redesign (10).zip`. Implemented as portal-scoped styles,
not static HTML replacement. Existing components, URLs, API calls and mutations
remain intact. No mock products, customers, shipping charges or membership tiers
were introduced. No backend, system Admin, configuration or dependency changes.

## Coverage

| Area | Adaptation | Verification |
| --- | --- | --- |
| User home / catalog | Manrope, slate surfaces, orange actions, one search, cards | Real API products observed; desktop light/dark |
| Product detail | Responsive columns, bounded image, equal-height purchase actions | Direct URL, 390px light/dark; image 324px inside panel, both actions 48px and same Y |
| Cart | Shared cards/theme, native-size selection controls | Empty guest cart, disabled checkout, 768px; existing cart tests |
| Checkout / QR | Address, payment and totals cards; single-column breakpoint | Existing checkout/QR tests; authenticated visual check still required |
| Profile / addresses / password | Shared account shell and controls | Existing page tests; authenticated visual check still required |
| Orders / reviews / returns | Shared cards, scrollable tabs and actions | Existing order/receipt/review tests; authenticated visual check still required |
| Vouchers / notifications / surveys | Shared surfaces, voucher typography and conditions | Existing functionality tests; authenticated visual check still required |
| Manager login | Manrope, blue action, themed card | Direct URL rendered; no credentials entered |
| Manager dashboard / customers / 360 / care | Dark sidebar, shared blue CRM surfaces and controls | Existing Manager tests; authenticated visual check still required |
| Manager products / orders / feedback / surveys / reports / vouchers | Table/toolbar/dialog styling, preserved full forms | Existing functionality tests; authenticated visual check still required |
| System Admin | No new selectors targeting this portal | CSS isolation tests |

## Browser checks

- User desktop 1440px: measured document width 1432px, no horizontal overflow.
- User product 390px: measured document width 382px, no horizontal overflow.
- User guest cart tablet 768px: measured document width 760px.
- User product direct URL, catalog navigation and light/dark toggle verified.
- Browser theme/viewport changes are QA preferences, not application data changes.
- No real orders, payments, reviews or Manager mutations submitted.

## Running

Use existing `npm run dev:user` (5173), `npm run dev:manager` (5175),
`npm test` and `npm run build`. Backend contract is unchanged; no migration or
backend restart is required for these styles. Hard refresh if a browser retains
old styles. Manrope uses the existing Google Fonts delivery pattern with a
system sans-serif fallback if unavailable.

## Remaining verification

Use a test customer and Manager session to visually check populated checkout,
QR, order history, care boards and all editing dialogs at 1440/768/390px.
Do not treat automated unit tests as proof of payment-provider integration or
authenticated visual completion. Legacy styles remain to preserve prior local
edits; new styles are loaded at portal entry points and isolated by root classes.
