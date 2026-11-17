# Manager Portal UI/UX Redesign — Design Spec

- **Date:** 2026-11-17
- **Branch:** `redesign/manager-ui` (from `origin/main` @ `ecbee8b`)
- **Scope:** `frontend/src/app/ManagerApp.jsx`, `frontend/src/features/manager/**`, Manager CSS layers
- **Out of scope:** backend/API changes, storefront, system Admin portal, desktop app shell
- **Delivery:** local commits on the branch only. No push, no pull request.

## 1. Problem

The Manager portal works but carries three accumulated UI problems:

1. **Duplicated hierarchy.** A screen shows the section name in the breadcrumb, again as `h1` in the shell, and again as `h2` inside the page panel, with two different subtitles. Orders, for example, renders “Đơn hàng” three times before the first row.
2. **Filter-heavy first paint.** `ManagerOrders` stacks a status tab strip, a toolbar and a six-field advanced filter grid before the table, roughly 200px of chrome at 1440px and several screenfuls at 390px.
3. **Broken mobile shell.** At 390px the breadcrumb drops below the fixed hamburger, the storefront link wraps to a third row, the status strip shows a permanent horizontal scrollbar, and the advanced filters stack vertically.

Underneath, four CSS layers compete: `admin-design.css` (shared base), `internal-portal.css`, `manager-redesign.css`, `manager-cockpit.css`, `manager-refinement.css`. Any fix requires guessing which layer wins.

## 2. Goals

- One page title per screen, one clear primary action.
- Data above the fold: compact toolbar, filters on demand.
- A mobile layout that is genuinely usable: two-row topbar, card rows, no permanent horizontal scrollbars.
- One consistent state language: skeleton while loading, explicit empty state, retryable error.
- A single Manager visual layer with predictable cascade and no leakage into Admin or User.
- Keep every existing API contract, role scoping rule, route, modal and test assertion intact.

## 3. Chosen Direction

**Refined Cockpit 2.0** — keep the forest-green sidebar and mint canvas identity, but rebuild tokens, shell, toolbar and data display. A small shared component set is upgraded for the shell and the highest-traffic pages (Tổng quan, Đơn hàng, Hóa đơn, Khách hàng, Sản phẩm). The CSS layer restyles all remaining sections consistently.

Rejected alternatives:

- **Full UI kit migration of all 27 sections**: too much regression surface for one branch.
- **Light SaaS shell**: loses the current identity and fights `admin-design.css` assumptions shared with Admin.

## 4. Visual System

Tokens live on `.manager-shell.admin-shell` and `.manager-login.admin-login` only (never `:root`):

| Token | Light | Dark |
|---|---|---|
| `--admin-bg` | `#f5f8f6` | `#080f0c` |
| `--admin-card` | `#ffffff` | `#101b17` |
| `--admin-text` | `#13211c` | `#eef7f2` |
| `--admin-muted` | `#5b6b64` | `#9db1a8` |
| `--admin-border` | `#dfe8e3` | `#22362e` |
| `--admin-primary` | `#0f7a5f` | `#5fd7ae` |
| `--admin-primary-soft` | `#e4f4ed` | `#153b2e` |
| `--admin-input` | `#f2f6f4` | `#14241e` |
| `--admin-accent` | `#e8834a` | `#ffb37c` |

- Typography: Manrope; page title `clamp(26px, 2.4vw, 34px)/1.25` weight 750; section title 16px/700; body 14px; table 13px; numerics `font-variant-numeric: tabular-nums`.
- One surface level only: background canvas → white panel with a hairline border and one soft shadow. Nested cards inside a panel are replaced by hairline dividers.
- Radii: 18px panel, 12px control, 999px badge. Elevation: one shadow token, stronger shadow only for dialogs.
- Accent orange is reserved for warnings and “needs attention” markers, never for primary actions.
- Focus ring: 3px primary at 3px offset, works in both themes.

## 5. Shell

### Sidebar

- Width 252px; collapsed rail 76px; local storage key unchanged (`manager-sidebar-collapsed`).
- Brand block keeps `ANH LỚN` and `Quản lý cửa hàng · CRM`, with the collapse control in the header.
- Navigation is grouped by domain instead of one flat list. Groups are filtered by role and render a small uppercase label with a hairline separator:

| Role | Groups |
|---|---|
| MANAGER_SALES | Tổng quan (standalone) · Bán hàng: Đơn hàng, Hóa đơn · Khách hàng & CSKH: Khách hàng, Phản hồi, Khảo sát · Danh mục: Sản phẩm, Voucher, Chiến dịch khuyến mãi · Phân tích: Báo cáo |
| MANAGER_WAREHOUSE | Tổng quan (standalone) · Danh mục: Sản phẩm · Kho: Nhập kho, Nguyên liệu, Công thức sản phẩm · Sản xuất: Kế hoạch sản xuất, Duyệt yêu cầu kho · Phân tích: Báo cáo kho |
| MANAGER_HR | Tổng quan (standalone) · Nhân sự: Nhân viên, Duyệt đơn nghỉ, Chấm công, Bảng lương, Báo cáo nhân sự |
| EMPLOYEE | Của tôi: Thông tin, Đơn nghỉ, Chấm công, Phiếu lương · Nhóm (TEAM_LEAD): Nhân viên trong nhóm, Chấm công nhóm · Công việc (WAREHOUSE): Công việc kho |

- Active item: soft primary surface, 2px inset left bar, primary icon and label. Hover: 5% white overlay.
- Footer: profile card, then a two-button action row (`Đổi mật khẩu`, `Đăng xuất`) sized as secondary ghost buttons. Accessible names must stay exactly “Đổi mật khẩu” and “Đăng xuất”. Collapsed rail shows icons with tooltips and visually hidden labels.

### Topbar

- Sticky, 64px desktop, translucent canvas with blur, hairline bottom border.
- Left: breadcrumb `Quản lý / <Section>`. Right: live badge, icon theme toggle, ghost storefront link.
- Mobile (≤900px): two-row grid. Row 1 reserves 64px for the fixed hamburger and shows the current section name; row 2 right-aligns compact actions. Breadcrumb and live badge are hidden. No wrapping into a third row.

### Page header

- Single `h1` (unchanged text source so role/navigation tests keep passing) plus a per-section subtitle map:
  - dashboard: date greeting (existing behaviour)
  - orders: “Theo dõi và xử lý đơn hàng trong ngày.”
  - products: “Danh mục, giá bán và tồn kho.”
  - users: “Hồ sơ và lịch sử mua hàng của khách.”
  - invoices: “Đối soát hóa đơn và thanh toán.”
  - reports: “Hiệu quả bán hàng theo kỳ.”
  - fallback: “Quản lý và cập nhật dữ liệu cửa hàng.”
- No action slot is added globally; page-level primary actions stay inside their panels.

## 6. Content Components

### PanelTitle

Becomes a **section header**, not a page header: 12px uppercase muted eyebrow is removed; `h2` drops to 16px/700; subtitle becomes 12.5px muted and sits on the same row when space allows, wrapping under on mobile. The first panel's title copy is changed to a section-specific label so the page title is not repeated:

| Page | New section title |
|---|---|
| Orders | Danh sách đơn hàng |
| Products | Danh mục sản phẩm |
| Users | Danh sách khách hàng |
| Feedback | Hộp thư phản hồi |
| Invoices | Danh sách hóa đơn |
| Surveys | Danh sách khảo sát |
| Employees | Danh sách nhân viên |
| Vouchers / Promotions | Danh sách voucher / Chiến dịch đang chạy |

### Toolbar and filters (Orders, Products, Invoices)

- One compact toolbar row: search field, status segmented strip (horizontally scrollable on mobile with no visible scrollbar), `Bộ lọc` toggle with an active-count badge, record count, refresh icon button.
- Advanced filters collapse by default behind `Bộ lọc`. Open state is local, not URL state; values remain URL-synced through `useManagerFilters` as today.
- Active filters render as removable chips under the toolbar (`Thanh toán: PAID ×`). Clearing a chip updates the URL filters.
- The redundant “Lọc trạng thái” select in the Orders toolbar is removed; the segmented strip already covers status selection, and the advanced sheet keeps return-status options in a dedicated select.

### Data display

- Tables: sticky header at 40px, 52px rows, hover tint, hairline row separators, right-aligned numeric columns, status badge with dot and tinted background, row actions as a compact button group (icon + “Chi tiết”).
- `< 768px`: order tables use the existing card renderer (`admin-order-cards`). Products and invoices use the existing `data-label` mechanism turned into stacked cards. No page may require horizontal scrolling at 390px.
- Empty state: icon, one sentence, primary CTA when the page can create a record. Error state keeps `ListError` with retry. Loading uses skeleton rows inside the table instead of replacing the whole panel.

### Dialogs

- Keep dialog markup and focus behaviour. Restyle to 20px radius, sticky header area, footer with right-aligned actions; mobile becomes a bottom sheet capped at `90dvh`.

## 7. Architecture

- Delete `manager-cockpit.css` and `manager-refinement.css`.
- Add `frontend/src/features/manager/styles/manager-ui.css` as the single Manager visual layer, imported after `manager-redesign.css` in `ManagerPortal.jsx`.
- `manager-redesign.css` stays as the structural base (tokens, login, 900px drawer, reduced motion) because the isolation contract already pins it.
- Every selector in `manager-ui.css` must start with `.manager-shell` or `.manager-login`; no `:root`, no `@import`.
- Update `portal-redesign.test.js` so the cockpit assertions read `manager-ui.css` and keep the same contract: dark theme block, Manrope, primary button colours, `max-height: 90dvh`, 900px drawer, `.admin-mobile-toggle { display: grid;`, `.admin-sidebar.is-open { transform: translateX(0); }`, `.manager-product-table table { min-width: 0; }`, `prefers-reduced-motion`.
- Shared UI primitives live in `ManagerComponents.jsx`: `PanelTitle`, `Table`, `ListError`, `PageControls`, plus new `FilterChip` and `ToolbarButton`. No new dependency.

## 8. Accessibility

- All interactive elements keep an accessible name after icon-only restyling.
- Toggle buttons expose `aria-expanded`; filter panel is labelled by its toggle.
- Drawer and dialogs keep Escape handling; focus ring visible in both themes; contrast at least 4.5:1 for body text, 3:1 for large text and UI borders.
- Motion limited to 160–220ms and disabled under `prefers-reduced-motion`.

## 9. Verification

For each phase run:

```
cd frontend
npm test
npm run build
npm run lint
```

Manual visual audit with Playwright mock routes at 1440, 1024, 768 and 390px for: Tổng quan, Đơn hàng, Hóa đơn, Khách hàng, Sản phẩm, Nhân viên, Báo cáo, plus one warehouse page. Dark theme checked on Orders and Dashboard.

Existing tests that must stay green include `ManagerApp.test.jsx` (role routing, nav filtering, h1 per section, sidebar collapse, password dialog, order actions) and `portal-redesign.test.js` (CSS isolation).

## 10. Risks

- **Cascade regressions:** mitigated by deleting the two overlay files and loading one new layer last.
- **Test assertions on labels/headings:** mitigated by keeping `h1` text, nav labels, and accessible names unchanged; only section titles and grouping wrappers change.
- **Mobile card conversion for non-order tables:** limited to tables that already expose `data-label`; otherwise keep a scroll container but hide low-priority columns at 390px.
- **Scope creep:** pages outside the agreed five are restyled by CSS only; structural changes are limited to shared components and the three filter-heavy pages.
