# Manager Invoice Detail Panel

## Intent

Replace the invoice detail modal with an expandable detail panel while keeping the invoice list visible. Preserve the current search, URL-backed filters, date and payment filters, pagination, read-only behavior, and manager order API calls.

## Approaches

1. Replace the current invoice page with the stale PR component. This is smaller, but drops the existing payment/date filters and URL-backed state. Rejected.
2. Keep the current invoice list and turn its existing detail module into a panel. Selection opens the panel beside the list on wide screens and below it on narrow screens. This retains the current capabilities and is the selected approach.
3. Keep the modal and add a second invoice route for the panel. This duplicates the invoice experience. Rejected.

## Constraints

- Base the change on current `main`; preserve the removal of refunds, care, personal tasks, support tickets, and reports.
- Limit product changes to the manager invoice UI and its existing frontend test.
- Do not change backend, database, dependencies, or invoice API behavior.
- The detail panel remains read-only and uses the existing manager order detail endpoint.

## Verification

Update the invoice UI test to cover panel open/close, invoice details, and the existing server-backed search behavior. Run the frontend test suite and production build before opening a focused PR.
