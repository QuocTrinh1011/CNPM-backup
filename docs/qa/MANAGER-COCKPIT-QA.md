# Manager Operations Cockpit — 2026-10-13

Reference: `Redesign User Web Interface (1).zip`,
`src/manager/manager-redesign.css` inside the archive.

The visual layer is scoped to `.manager-shell` / `.manager-login` and imported
only by ManagerPortal. Exported API clients, old business modules, build scripts
and document instructions were not substituted or executed.

- Deep-green sidebar, mint actions, rounded KPI/table/form/dialog surfaces.
- Manrope retained; readable light/dark button labels and login fields.
- Existing current routes remain: customers/360°, care tasks and care dashboard,
  products/stock, orders/returns, feedback, surveys/rewards, reports, vouchers.
- Polling, API contracts, permissions and business rules unchanged.
- Tablet drawer uses the existing 900px breakpoint; mobile product cards retained.
- CSS contract tests verify portal isolation, dark contrast and responsive rules.
- Existing behavioral tests cover Manager navigation, menu cleanup and polling.

Manual: login screen on desktop and 390px mobile. Authenticated Manager pages
require a Manager session for full visual inspection; none was available in the
test browser. No real orders or payments were processed.

No backend/schema/config/dependency/User/Admin changes in this task.
