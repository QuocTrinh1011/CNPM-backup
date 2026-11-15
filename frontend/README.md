# Anh Lớn shop — Cửa hàng thời trang nam

React/Vite customer storefront for men's clothing. The UI is Vietnamese throughout and uses the sequence-diagram APIs directly; no mock product dataset is bundled in the frontend.

## Run

```powershell
npm install
$env:VITE_API_BASE_URL='http://localhost:8080'
npm run dev
```

The default API base URL is `http://localhost:8080`. Copy `.env.example` to `.env.local` to override it, then restart Vite. Run `npm run dev:user` on port 5173, `npm run dev:admin` on port 5174, and `npm run dev:manager` on port 5175 in separate terminals. All three connect to the same backend and use separate sessions. Admin list screens call `/api/admin/users`, `/products`, `/orders`, `/feedback`, and `/surveys`. The Manager reports page calls `/api/manager/reports?year=2026&month=11`; omit `month` for a yearly view. It shows captured order income, posted stock-receipt costs, popular product variants, customer purchases, and receipt activity by receipt creator. COD is dated by collection time, other paid orders by creation time, and report periods use Vietnam local time.

## Windows desktop app

The Electron app opens the customer, Admin, and Manager portals from one native menu. The Spring Boot backend and PostgreSQL must run separately.

```powershell
npm ci
npm run desktop:start
npm run desktop:test:e2e
npm run desktop:make
npm run desktop:verify-package
```

On first launch, enter the API origin. HTTP is accepted only for `localhost`, `127.0.0.1`, or `::1`; remote hosts must use HTTPS. The refresh cookie fallback stays in the main process memory only, so sign in again after every app restart. The Squirrel.Windows installer is written under `out/make/squirrel.windows/`; `npm run desktop:verify-package` checks the output for environment files, backend/database payloads, and credential-like assignments.

`npm run desktop:test:e2e` runs Playwright against the built desktop renderer and an isolated disposable API mock. It uses only `@example.test` accounts and a temporary Electron profile; it does not need a running backend or production credentials.

The installer is unsigned and Windows SmartScreen may show a warning. This build targets Windows only and does not include the backend or database; offline use, auto-update, and code signing are out of scope.

## Source layout

```text
src/
├── main.jsx             Selects the portal for the current Vite mode
├── app/                 App shells, routing, portal entrypoints and integration tests
├── api/                 Customer and manager API clients
├── features/
│   ├── storefront/      Shopping and checkout flows
│   ├── customer/        Customer account pages and order feedback
│   ├── manager/         Store operations and CRM workflows
│   └── admin/           System administration
├── shared/
│   ├── address/         Shared address book, picker and shipping fields
│   ├── routing/         Customer route helpers
│   ├── hooks/           Shared hooks
│   ├── utils/           Shared utilities
│   └── styles/          Shared styles
├── styles/              Global styles
└── data/                Vietnam addresses and source data license
```

Feature component tests and component-only styles live beside their component. App-level integration tests live in src/app/; shared component tests live beside shared code. Shared and portal-wide styles are grouped under each feature styles/ folder; global CSS is under src/styles/. Portal entrypoints retain the CSS import order required for cascade precedence.

Dependency direction: app/ may import features/ and shared/; features/ may import shared/. Features do not import each other, and shared code does not import from app or features. A Vitest guard checks these boundaries.

The frontend still excludes refund, support-ticket, customer-care, and personal-task screens. Manager reporting is limited to captured order income and stock-receipt costs; its employee view identifies who created stock receipts and does not attribute sales to staff. Backend and database code are outside this frontend refactor.

## Implemented customer flows

- Product catalog with keyword search, category, price and sort filters
- Product detail with size/color selection, verified-purchase feedback and ratings
- Guest cart plus persisted customer cart
- Customer registration, login, refresh-token session and logout
- Profile and style-preference update
- COD and payOS QR checkout flows; the customer can reopen a pending QR from order history.
- Checkout page at `/dat-hang`: loads the customer session and merged cart before ordering; `/thanh-toan` remains the PayOS return URL.
- Default delivery-address summary with an explicit address picker. Choosing another address affects only the current order; adding/editing persists only on Save. Use the explicit default checkbox to change future deliveries.
- Shared address editor for checkout and the account address book; phone validation and two-level province/ward selectors. Legacy unmatched addresses must be corrected before ordering.
- Order history and delivery-status tracking
- Published style surveys and one-response protection
