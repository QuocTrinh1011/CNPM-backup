# Anh Lớn shop — Cửa hàng thời trang nam

React/Vite customer storefront for men's clothing. The UI is Vietnamese throughout and uses the sequence-diagram APIs directly; no mock product dataset is bundled in the frontend.

## Run

```powershell
npm install
$env:VITE_API_BASE_URL='http://localhost:8080'
npm run dev
```

The default API base URL is `http://localhost:8080`. Copy `.env.example` to `.env.local` to override it, then restart Vite. Run `npm run dev:user` on port 5173, `npm run dev:admin` on port 5174, and `npm run dev:manager` on port 5175 in separate terminals. All three connect to the same backend and use separate sessions. Admin list screens call `/api/admin/users`, `/products`, `/orders`, `/feedback`, and `/surveys`; dashboard cards call the revenue, user, and survey report endpoints.

## Source layout

```text
src/
├── main.jsx             Selects the portal for the current Vite mode
├── app/                 App shell, customer routing and portal entrypoints
├── api/                 Customer and manager API clients
├── features/
│   ├── storefront/      Shopping and checkout flows
│   ├── customer/        Customer account pages and order feedback
│   ├── support-tickets/ Support ticket views for customer and manager
│   ├── manager/         Store operations and CRM workflows
│   └── admin/           System administration
├── shared/              Shared hooks, utilities and styles
├── styles/              Global styles
└── data/                Vietnam addresses and source data license
```

Feature component tests and component-only styles live beside their component. Shared and portal-wide styles are grouped under each feature's `styles/` folder; global CSS is under `src/styles/`. Portal entrypoints retain the CSS import order required for cascade precedence.

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
