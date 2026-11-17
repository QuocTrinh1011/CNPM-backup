# Manager Portal UI/UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Manager portal's three competing visual layers with one scoped design system and fix the shell, filter and mobile-table UX without changing any API or route.

**Architecture:** A new `manager-ui.css` loaded last provides tokens, shell, toolbar, table and dialog styling for every Manager section. `ManagerApp.jsx` gains domain-grouped navigation, a two-row mobile topbar and per-section subtitles. Shared components in `ManagerComponents.jsx` become the single source for section headers, table chrome and filter chips. Orders, Products and Invoices get collapsible advanced filters.

**Tech Stack:** React 19, Vite 8, plain CSS, Vitest + jsdom + Testing Library, lucide-react icons, Playwright for visual audit.

**Spec:** `docs/superpowers/specs/2026-11-17-manager-ui-redesign-design.md`

## Global Constraints

- Branch: `redesign/manager-ui`. Never push, never open a PR.
- Every selector in `manager-ui.css` starts with `.manager-shell` or `.manager-login`; no `:root`, no `@import`.
- Keep `h1` text equal to the nav label for every section; keep accessible names “Đổi mật khẩu”, “Đăng xuất”, “Mở menu quản lý”, “Thu gọn thanh điều hướng”.
- Keep `useManagerFilters` URL state, polling hooks and API endpoints untouched.
- Manrope only; numerics use `font-variant-numeric: tabular-nums`.
- Run from `frontend/`: `npm test`, `npm run build`, `npm run lint`.

---

### Task 1: Replace the Manager CSS layers

**Files:**
- Create: `frontend/src/features/manager/styles/manager-ui.css`
- Modify: `frontend/src/app/portals/ManagerPortal.jsx`
- Delete: `frontend/src/features/manager/styles/manager-cockpit.css`
- Delete: `frontend/src/features/manager/styles/manager-refinement.css`
- Modify: `frontend/src/app/portal-redesign.test.js:6-8,43-57`

**Interfaces:**
- Produces: `.manager-ui.css` loaded after `manager-redesign.css`, defining tokens `--admin-bg`, `--admin-card`, `--admin-text`, `--admin-muted`, `--admin-border`, `--admin-primary`, `--admin-primary-soft`, `--admin-input`, `--admin-accent`, `--manager-radius-panel`, `--manager-radius-control`.

- [ ] **Step 1: Update the isolation test to read the new file**

```js
const cockpitStyles = readFileSync('src/features/manager/styles/manager-ui.css', 'utf8');
```

Keep the assertions in `it('keeps the Manager cockpit isolated ...')` and retitle it `keeps the Manager UI layer isolated from User and Admin`. Keep these literal strings in the new CSS: `font-family: "Manrope"`, `.admin-primary { background: var(--admin-primary); color: #07100d; }`, `max-height: 90dvh;`, `.manager-product-table table { min-width: 0; }`, `@media (max-width: 900px)`, `.admin-mobile-toggle { display: grid;`, `.admin-sidebar.is-open { transform: translateX(0); }`, `prefers-reduced-motion`.

- [ ] **Step 2: Run the test and confirm it fails because the file is missing**

Run: `cd frontend && npx vitest run src/app/portal-redesign.test.js`
Expected: FAIL `ENOENT ... manager-ui.css`.

- [ ] **Step 3: Create `manager-ui.css`**

Structure the file in this exact order, all selectors scoped:

1. Token block for `.manager-shell.admin-shell, .manager-login.admin-login`, with values from spec §4.
2. Dark token block for `[data-theme="dark"]`.
3. Canvas, sidebar (252px, 76px collapsed rail), brand, nav buttons, nav groups, footer actions.
4. Topbar (64px, sticky, blur), breadcrumb, live badge, theme toggle, storefront link.
5. Page heading (`h1` clamp, accent bar removed, subtitle 13px) and page actions.
6. Panels, section header, toolbar, search, segmented tabs, filter button and chips.
7. Table: sticky 40px header, 52px rows, hover, numeric alignment, empty state.
8. Stats, quick cards, alerts, badges, avatars, thumbnails.
9. Inputs, primary/action buttons, pagination, dialogs, toasts.
10. Login page.
11. Responsive blocks: 1150px, 900px (drawer + two-row topbar), 768px (product/invoice cards), 600px (single-column filters), 480px.
12. Reduced-motion block.

Core shell rules to include verbatim:

```css
.manager-shell.admin-shell {
  --admin-bg: #f5f8f6;
  --admin-card: #ffffff;
  --admin-text: #13211c;
  --admin-muted: #5b6b64;
  --admin-border: #dfe8e3;
  --admin-primary: #0f7a5f;
  --admin-primary-soft: #e4f4ed;
  --admin-input: #f2f6f4;
  --admin-accent: #e8834a;
  --manager-radius-panel: 18px;
  --manager-radius-control: 12px;
  background: radial-gradient(circle at 62% -12%, rgb(15 122 95 / 9%), transparent 34rem), var(--admin-bg);
  font-family: "Manrope", system-ui, sans-serif;
}
.manager-shell.admin-shell .admin-sidebar { width: 252px; padding: 16px 12px; border-right: 1px solid rgb(255 255 255 / 7%); background: #0b1f19; }
.manager-shell.admin-shell .admin-main { flex: 1; min-width: 0; max-width: 1680px; padding: 0 32px 56px; }
.manager-shell.admin-shell .admin-topbar { position: sticky; top: 0; z-index: 20; min-height: 64px; margin: 0 -32px; padding: 0 32px; background: color-mix(in srgb, var(--admin-bg) 86%, transparent); backdrop-filter: blur(18px) saturate(140%); border-bottom: 1px solid var(--admin-border); }
.manager-shell.admin-shell .admin-page-heading { margin: 30px 0 22px; padding: 0; }
.manager-shell.admin-shell .admin-page-heading h1 { font-size: clamp(26px, 2.4vw, 34px); font-weight: 750; letter-spacing: -.035em; line-height: 1.25; }
.manager-shell.admin-shell .admin-page-heading p { margin-top: 4px; color: var(--admin-muted); font-size: 13px; }
```

- [ ] **Step 4: Wire the new file and delete old ones**

`ManagerPortal.jsx` becomes:

```jsx
import '../../shared/styles/admin-design.css';
import '../../features/manager/styles/manager-redesign.css';
import '../../features/manager/styles/manager-ui.css';
export {default} from '../ManagerApp';
```

Delete `manager-cockpit.css` and `manager-refinement.css` with `git rm`.

- [ ] **Step 5: Run isolation tests and build**

Run: `cd frontend && npx vitest run src/app/portal-redesign.test.js && npm run build`
Expected: PASS and successful build.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/manager/styles/manager-ui.css frontend/src/app/portals/ManagerPortal.jsx frontend/src/app/portal-redesign.test.js
git commit -m "refactor(manager): replace overlay styles with one scoped UI layer"
```

---

### Task 2: Grouped navigation and responsive shell

**Files:**
- Modify: `frontend/src/app/ManagerApp.jsx:75-104` (add groups), `:303-368` (render groups), `:369-400` (footer), `:401-451` (topbar/heading)
- Test: `frontend/src/app/ManagerApp.test.jsx`

**Interfaces:**
- Consumes: `navItems`, `managerRoleSections`, `section`, `go`, `renderNavItem`.
- Produces: `managerNavGroups` map keyed by role; `pageSubtitle` helper; markup `div.manager-nav-group` with `span.manager-nav-group-label`, and `div.manager-sidebar-actions`.

- [ ] **Step 1: Add the group map after `managerLandingPaths`**

```js
const managerNavGroups = {
  MANAGER_SALES: [
    ["Tổng quan", ["dashboard"]],
    ["Bán hàng", ["orders", "invoices"]],
    ["Khách hàng & CSKH", ["users", "feedback", "surveys"]],
    ["Danh mục", ["products", "vouchers", "promotions"]],
    ["Phân tích", ["reports"]],
  ],
  MANAGER_WAREHOUSE: [
    ["Tổng quan", ["dashboard"]],
    ["Danh mục", ["products"]],
    ["Kho", ["stock-receipts", "materials", "recipes"]],
    ["Sản xuất", ["production-plans", "warehouse-approvals"]],
    ["Phân tích", ["warehouse-reports"]],
  ],
  MANAGER_HR: [["Nhân sự", ["employees", "leave-requests", "attendance", "payroll", "hr-reports"]]],
  EMPLOYEE: [
    ["Của tôi", ["my-profile", "my-requests", "my-attendance", "my-payslips"]],
    ["Nhóm", ["my-team", "my-team-attendance"]],
    ["Công việc", ["warehouse-tasks"]],
  ],
};
const pageSubtitles = {
  orders: "Theo dõi và xử lý đơn hàng trong ngày.",
  products: "Danh mục, giá bán và tồn kho.",
  users: "Hồ sơ và lịch sử mua hàng của khách.",
  invoices: "Đối soát hóa đơn và thanh toán.",
  reports: "Hiệu quả bán hàng theo kỳ.",
  feedback: "Phản hồi mới từ khách hàng.",
  surveys: "Khảo sát và mức độ hài lòng.",
  employees: "Hồ sơ và tình trạng làm việc.",
};
```

- [ ] **Step 2: Render grouped nav**

Replace `nav` children with:

```jsx
<nav aria-label="Chức năng quản lý">
  {(managerNavGroups[admin.role] || [])
    .map(([label, keys]) => [label, keys.filter(key => roleSections.has(key))])
    .filter(([, keys]) => keys.length)
    .map(([label, keys]) => (
      <div className="manager-nav-group" role="group" aria-label={label} key={label}>
        <span className="manager-nav-group-label" aria-hidden="true">{label}</span>
        {keys.map(key => renderNavItem(navItems.find(item => item[0] === key)))}
      </div>
    ))}
</nav>
```

Remove the old `promotionNavItems` block. Keep `roleNavItems` only if still used elsewhere; otherwise delete it.

- [ ] **Step 3: Compact sidebar footer**

Wrap the two actions:

```jsx
<div className="manager-sidebar-actions">
  <button type="button" className="admin-logout manager-change-pw-btn" title={sidebarCollapsed ? "Đổi mật khẩu" : undefined} aria-label="Đổi mật khẩu" onClick={() => setPasswordModalOpen(true)}>
    <KeyRound size={16} aria-hidden="true" /> <span className="admin-logout-label">Đổi mật khẩu</span>
  </button>
  <button className="admin-logout" onClick={async () => { setAdmin(null); go("login"); await adminSignOut(); }}>
    <LogOut size={16} aria-hidden="true" /> <span className="admin-logout-label">Đăng xuất</span>
  </button>
</div>
```

Keep both accessible names intact.

- [ ] **Step 4: Topbar mobile title and per-section subtitle**

Add inside `.admin-topbar-left` after the breadcrumb:

```jsx
<span className="manager-mobile-title">{navItems.find(item => item[0] === section)?.[1] || "Tổng quan"}</span>
```

Replace the static paragraph:

```jsx
<p>{section === "dashboard"
  ? `${new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} — Xin chào, ${admin.fullName || "Admin"}`
  : pageSubtitles[section] || "Quản lý và cập nhật dữ liệu cửa hàng."}</p>
```

- [ ] **Step 5: Add responsive rules**

In `manager-ui.css` 900px block, make the topbar a two-row grid and hide the breadcrumb/live badge:

```css
.manager-shell.admin-shell .admin-topbar { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-content: center; gap: 6px 12px; margin: 0 -16px; padding: 10px 16px 10px 64px; min-height: 64px; }
.manager-shell.admin-shell .admin-breadcrumb { display: none; }
.manager-shell.admin-shell .manager-mobile-title { display: block; font-weight: 700; }
.manager-shell.admin-shell .admin-topbar-actions { flex-wrap: nowrap; justify-content: flex-end; gap: 8px; }
.manager-shell.admin-shell .admin-live-dot { display: none; }
```

Outside media queries set `.manager-shell .manager-mobile-title { display: none; }`.

- [ ] **Step 6: Run shell tests**

Run: `cd frontend && npx vitest run src/app/ManagerApp.test.jsx`
Expected: PASS (role routing, nav filtering, h1 per section, collapse, dialogs).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/ManagerApp.jsx frontend/src/features/manager/styles/manager-ui.css
git commit -m "feat(manager): group navigation and fix the responsive shell"
```

---

### Task 3: Shared section header and table chrome

**Files:**
- Modify: `frontend/src/features/manager/ManagerComponents.jsx`
- Modify: `frontend/src/features/manager/ManagerOrders.jsx:97-100`
- Modify: `frontend/src/features/manager/ManagerProducts.jsx:172`
- Modify: `frontend/src/features/manager/ManagerInvoices.jsx:55-59`
- Modify: `frontend/src/features/manager/ManagerFeedback.jsx:61-64`
- Modify: `frontend/src/features/manager/ManagerEmployees.jsx:95`

**Interfaces:**
- Produces: `PanelTitle({ title, subtitle, actions })` renders `div.manager-section-head` with `h2` and optional `div.manager-section-actions`; `Table` unchanged API; new `FilterChip({ label, onRemove })` and `ToolbarButton({ children, active, count, ...props })` exported.

- [ ] **Step 1: Rewrite PanelTitle**

```jsx
export function PanelTitle({ title, subtitle, actions }) {
  return (
    <div className="manager-section-head">
      <div className="manager-section-copy">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="manager-section-actions">{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Add FilterChip and ToolbarButton**

```jsx
export function FilterChip({ label, onRemove }) {
  return (
    <span className="manager-filter-chip">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Bỏ lọc ${label}`}>
        <X size={12} aria-hidden="true" />
      </button>
    </span>
  );
}
export function ToolbarButton({ active = false, count = 0, children, ...props }) {
  return (
    <button type="button" className={`manager-filter-toggle${active ? " is-active" : ""}`} aria-expanded={active} {...props}>
      <SlidersHorizontal size={15} aria-hidden="true" />
      {children}
      {count > 0 && <span className="manager-filter-count">{count}</span>}
    </button>
  );
}
```

Import `X, SlidersHorizontal` from `lucide-react`.

- [ ] **Step 3: Replace duplicated page/section titles**

- Orders: `title="Danh sách đơn hàng"` subtitle `"Theo dõi và cập nhật tiến trình giao hàng."` stays.
- Products: `title="Danh mục sản phẩm"` subtitle `"Quản lý catalog và tồn kho."`.
- Invoices: replace the inline `admin-panel-title` block with `<PanelTitle title="Danh sách hóa đơn" subtitle="Tra cứu hóa đơn theo mã đơn, khách hàng, ngày lập và trạng thái thanh toán." />` and import `PanelTitle`.
- Feedback: title `"Hộp thư phản hồi"`.
- Employees: title `"Danh sách nhân viên"`.

- [ ] **Step 4: Style the section header**

```css
.manager-shell .manager-section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.manager-shell .manager-section-copy h2 { margin: 0; font-size: 16px; font-weight: 700; letter-spacing: -.01em; }
.manager-shell .manager-section-copy p { margin: 3px 0 0; color: var(--admin-muted); font-size: 12.5px; }
.manager-shell .manager-section-actions { display: flex; gap: 8px; flex-wrap: wrap; }
```

- [ ] **Step 5: Run tests**

Run: `cd frontend && npx vitest run src/app/ManagerApp.test.jsx src/app/portal-redesign.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/manager/ManagerComponents.jsx frontend/src/features/manager/ManagerOrders.jsx frontend/src/features/manager/ManagerProducts.jsx frontend/src/features/manager/ManagerInvoices.jsx frontend/src/features/manager/ManagerFeedback.jsx frontend/src/features/manager/ManagerEmployees.jsx frontend/src/features/manager/styles/manager-ui.css
git commit -m "feat(manager): add section header and filter primitives"
```

---

### Task 4: Collapsible filters on Orders

**Files:**
- Modify: `frontend/src/features/manager/ManagerOrders.jsx:12-170`
- Test: `frontend/src/app/ManagerApp.test.jsx` (existing order tests)

**Interfaces:**
- Consumes: `ToolbarButton`, `FilterChip`, `useManagerFilters`.
- Produces: local `filtersOpen` and `activeFilters` array; advanced grid rendered only when open; chips clear individual URL filters.

- [ ] **Step 1: Add state and derived chips**

```jsx
const [filtersOpen, setFiltersOpen] = useState(false);
const activeFilters = [
  filters.paymentStatus && { key: 'paymentStatus', label: `Thanh toán: ${filters.paymentStatus}` },
  filters.paymentReview && { key: 'paymentReview', label: filters.paymentReview === 'true' ? 'Cần đối soát' : 'Không cảnh báo' },
  filters.fromDate && { key: 'fromDate', label: `Từ ${filters.fromDate}` },
  filters.toDate && { key: 'toDate', label: `Đến ${filters.toDate}` },
  (filters.sort !== 'createdAt' || filters.direction !== 'DESC') && { key: 'sort', label: `${filters.sort === 'totalAmount' ? 'Tổng tiền' : filters.sort === 'orderCode' ? 'Mã đơn' : 'Ngày đặt'} · ${filters.direction === 'ASC' ? 'Tăng' : 'Giảm'}` },
].filter(Boolean);
```

- [ ] **Step 2: Replace the toolbar tail and advanced grid**

In `.admin-order-toolbar`, remove the status `<select>` block, keep search, then:

```jsx
<ToolbarButton active={filtersOpen} count={activeFilters.length} onClick={() => setFiltersOpen(value => !value)}>
  Bộ lọc
</ToolbarButton>
<span className="manager-toolbar-count">{data?.totalElements ?? 0} đơn hàng</span>
<button type="button" className="manager-icon-btn" onClick={load} aria-label="Tải lại trạng thái thanh toán">
  <RefreshCw size={16} />
</button>
```

Render chips and conditionally the grid:

```jsx
{activeFilters.length > 0 && (
  <div className="manager-filter-chips">
    {activeFilters.map(item => (
      <FilterChip key={item.key} label={item.label} onRemove={() => changeFilters(item.key === 'sort' ? { sort: 'createdAt', direction: 'DESC' } : { [item.key]: '' })} />
    ))}
  </div>
)}
{filtersOpen && <div className="manager-advanced-filters">…existing six labels…</div>}
```

Keep the six existing labels exactly as-is inside the conditional.

- [ ] **Step 3: Preserve the status tab strip**

Keep the tab strip and its counts. Style it as a single-line scroll strip:

```css
.manager-shell .admin-order-status-tabs { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 8px; scrollbar-width: none; }
.manager-shell .admin-order-status-tabs::-webkit-scrollbar { display: none; }
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/app/ManagerApp.test.jsx -t "order"`
Expected: PASS. The test clicking “Tải lại trạng thái thanh toán” still finds the icon button by `aria-label`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/manager/ManagerOrders.jsx frontend/src/features/manager/styles/manager-ui.css
git commit -m "feat(manager): collapse order filters behind a toggle"
```

---

### Task 5: Collapsible filters on Products and Invoices

**Files:**
- Modify: `frontend/src/features/manager/ManagerProducts.jsx:196-237`
- Modify: `frontend/src/features/manager/ManagerInvoices.jsx:60-86`

**Interfaces:**
- Consumes: `ToolbarButton`, `FilterChip`.
- Produces: `filtersOpen` state per page and conditional advanced grids; no URL keys change.

- [ ] **Step 1: Products**

Add `const [filtersOpen, setFiltersOpen] = useState(false);` with the other state hooks. In the toolbar, append:

```jsx
<ToolbarButton active={filtersOpen} count={[filters.minPrice, filters.maxPrice, filters.stock !== 'ALL', filters.active === 'false', filters.sort !== 'createdAt', filters.direction !== 'DESC'].filter(Boolean).length} onClick={() => setFiltersOpen(value => !value)}>
  Bộ lọc
</ToolbarButton>
```

Wrap `manager-advanced-filters` in `{filtersOpen && (...)}`. Keep the six labels unchanged.

- [ ] **Step 2: Invoices**

Add `const [filtersOpen, setFiltersOpen] = useState(false);`. Replace the always-visible advanced block with:

```jsx
<div className="manager-invoice-toolbar-row">
  <ToolbarButton active={filtersOpen} count={[filters.paymentStatus, filters.fromDate, filters.toDate].filter(Boolean).length} onClick={() => setFiltersOpen(value => !value)}>
    Bộ lọc
  </ToolbarButton>
</div>
{filtersOpen && <div className="manager-advanced-filters invoice-filters">…existing three labels and reload button…</div>}
```

Move the reload action next to the toggle so it stays reachable when the sheet is closed.

- [ ] **Step 3: Shared chip/toggle styles**

```css
.manager-shell .manager-filter-toggle { display: inline-flex; align-items: center; gap: 7px; min-height: 38px; padding: 0 12px; border: 1px solid var(--admin-border); border-radius: var(--manager-radius-control); background: var(--admin-card); color: var(--admin-text); font-weight: 650; }
.manager-shell .manager-filter-toggle.is-active { border-color: var(--admin-primary); background: var(--admin-primary-soft); color: var(--admin-primary); }
.manager-shell .manager-filter-count { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--admin-primary); color: #fff; font-size: 11px; }
.manager-shell .manager-filter-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 0; }
.manager-shell .manager-filter-chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 4px 4px 10px; border: 1px solid var(--admin-border); border-radius: 999px; background: var(--admin-input); font-size: 12px; color: var(--admin-text); }
.manager-shell .manager-filter-chip button { display: grid; place-items: center; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 999px; background: transparent; color: var(--admin-muted); }
```

- [ ] **Step 4: Run tests and build**

Run: `cd frontend && npm test && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/manager/ManagerProducts.jsx frontend/src/features/manager/ManagerInvoices.jsx frontend/src/features/manager/styles/manager-ui.css
git commit -m "feat(manager): collapse product and invoice filters"
```

---

### Task 6: Mobile data display and visual audit

**Files:**
- Modify: `frontend/src/features/manager/styles/manager-ui.css`
- Modify: `frontend/src/features/manager/styles/manager-invoices.css` (if its table rules conflict)

- [ ] **Step 1: Add mobile card rules**

Under the 768px block:

```css
.manager-shell .manager-product-table { border: 0; overflow: visible; }
.manager-shell .manager-product-table table { min-width: 0; }
.manager-shell .manager-product-table thead { display: none; }
.manager-shell .manager-product-table tbody { display: grid; gap: 10px; }
.manager-shell .manager-product-table tr { display: grid; gap: 2px; padding: 14px; border: 1px solid var(--admin-border); border-radius: 14px; background: var(--admin-card); }
.manager-shell .manager-product-table td { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; border: 0; white-space: normal; }
.manager-shell .manager-product-table td::before { content: attr(data-label); color: var(--admin-muted); font-size: 12px; }
.manager-shell .manager-product-table td:first-child::before, .manager-shell .manager-product-table td:last-child::before { content: none; }
```

Mirror the same pattern for `.invoice-table` and any table with `data-label` inside `.manager-shell`, scoped so Admin is untouched.

- [ ] **Step 2: Playwright mock audit**

Start `npm run dev:manager`, route `**/api/manager/**` to fixture responses, and capture 1440/1024/768/390 for Tổng quan, Đơn hàng, Hóa đơn, Khách hàng, Sản phẩm, Nhân viên, Báo cáo and one warehouse page. Fix any overflow, clipped label or duplicated title found. Re-check dark theme on Orders and Dashboard.

- [ ] **Step 3: Full verification**

Run: `cd frontend && npm test && npm run build && npm run lint`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/manager/styles/manager-ui.css frontend/src/features/manager/styles/manager-invoices.css
git commit -m "fix(manager): make data tables usable on mobile"
```

## Self-Review Notes

- Spec §4 tokens → Task 1. Spec §5 sidebar/topbar → Task 2. Spec §6 section header/filters/tables → Tasks 3–6. Spec §7 architecture → Task 1. Spec §9 verification → every task plus Task 6.
- Filter chips and toggle names are consistent (`filtersOpen`, `activeFilters`, `manager-filter-toggle`, `manager-filter-chip`).
- The only deliberately unchanged contracts are route names, API calls, `h1` text and accessible names, all pinned by `ManagerApp.test.jsx`.
