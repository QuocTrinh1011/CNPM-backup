# Manager promotion campaign management

## Intent

Give Managers a dedicated place to create, inspect, edit, and delete promotion campaigns and their product, invoice, and voucher rules. The database already has the campaign and rule tables, but no manager endpoints or campaign screen. This phase makes those definitions manageable without changing order or checkout pricing.

## Goals

- Add a **Chiến dịch khuyến mãi** entry and dedicated page in Manager Portal.
- Support campaign CRUD using the existing campaign fields: code, name, start date, and end date.
- Manage all three rule groups under one campaign:
  - Product: product ID and discount percent.
  - Invoice: minimum invoice amount and discount percent.
  - Voucher: voucher ID and discount percent.
- Validate campaign and rule values on the backend, and save a campaign plus its rules atomically.
- Restrict these operations to the existing Manager authorization flow and record changes in the shared audit log.

## Non-goals

- Do not apply campaign rules to cart, checkout, orders, payments, or invoice totals.
- Do not change standalone voucher management or customer voucher behavior.
- Do not add campaign activation/status fields absent from the current schema. The date range is displayed as stored.
- Do not alter the campaign schema unless implementation discovery finds a contract mismatch that needs approval.

## Current state

- `database/schema.sql` and migration `021_promotion_campaigns.sql` define the campaign and three rule tables.
- Backend JPA entities exist for those four records, but there is no campaign repository, manager controller, or campaign service.
- Manager Portal already has a separate voucher page backed by `/api/manager/vouchers` and an established manager authentication client.
- The migration explicitly leaves checkout behavior disabled.

## Approaches considered

1. **Dedicated Manager page (selected):** Add a separate navigation item and campaign workspace. Keep campaigns distinct from reusable voucher codes, while presenting the three rule groups together in each campaign editor. This matches the campaign's aggregate shape and leaves the existing voucher page focused.
2. **Campaign tab inside the voucher page:** Fewer navigation changes, but mixes campaign configuration with standalone voucher CRUD and makes product/invoice rules harder to discover.

## Proposed interface

Use one manager-only campaign module with a small controller surface and a transactional service behind it:

- `GET /api/manager/promotions?page=&size=&search=` returns a paginated campaign summary with rule counts.
- `GET /api/manager/promotions/{id}` returns campaign details and its three rule arrays.
- `POST /api/manager/promotions` creates a campaign and all supplied rules in one transaction.
- `PUT /api/manager/promotions/{id}` replaces the campaign fields and all three rule arrays in one transaction.
- `DELETE /api/manager/promotions/{id}` removes the campaign and its child rules; the existing `audit_logs` table retains a delete record.

The request/detail contract uses `code`, `name`, `startDate`, `endDate`, `productRules[]`, `invoiceRules[]`, and `voucherRules[]`. Rules refer to existing products/vouchers by ID. The Manager page uses existing product and voucher list endpoints to display readable labels.

## Validation and persistence

- Campaign code is unique, required, and at most 40 characters; name is required and at most 150 characters.
- End date must be on or after start date.
- Rule percentages must be greater than zero and no more than 100.
- Invoice minimum amount must be non-negative.
- Referenced products and vouchers must exist.
- Reject duplicate product IDs, invoice thresholds, or voucher IDs within the same campaign, consistent with database uniqueness constraints.
- Create/update must be atomic: a failed rule leaves the stored campaign and all rule groups unchanged.
- Delete is a hard delete of the campaign configuration and cascades only to its rules. It does not affect orders because checkout does not consume these rules in this phase.

## Manager page

Add a dedicated Manager navigation section and page. The page lists campaigns with code, name, date range, and counts for each rule group. Create and edit open a campaign form with three visibly separate rule sections. Product/voucher selectors show labels but submit IDs. Delete requires confirmation. Loading, empty, validation, and API error states follow the existing Manager page patterns.

## Security and audit

All campaign routes are under `/api/manager/**` and use the existing Manager token. Create, update, and delete write shared audit entries; audit history remains independent of campaign deletion.

## Open implementation calls

- Keep the campaign code immutable after creation, matching the existing voucher-code rule; edits can change the name, dates, and rules.
- Allow any combination of the three rule groups, including none or several entries in a group. This stores configuration only; overlap and discount stacking are intentionally undefined until checkout behavior is designed.
- Use the existing list-plus-editor patterns from Manager Portal. The builder may choose a modal or a split detail view based on the size of the three rule sections, while keeping the dedicated page and fields above.

## Acceptance criteria

- A Manager can list, create, inspect, edit, and delete campaigns from the dedicated Manager page.
- Each campaign can contain product, invoice, voucher rules, any combination of them, and updates are atomic.
- Invalid dates, percentages, duplicate rules, and unknown references return clear validation errors.
- Non-Manager requests cannot access the campaign operations.
- Standalone voucher management continues to work, and checkout/order totals remain unchanged by campaign rules.
