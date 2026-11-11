# Manager Promotion Campaign Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated Manager page to create, inspect, update, and delete promotion campaigns and their product, invoice, and voucher rules.

**Architecture:** Add a manager-only REST controller and a transactional service over the campaign entities and rule tables already in the schema. Add a lazy-loaded Manager feature page that uses the existing Manager API client and existing product/voucher list endpoints; keep all campaign rules as configuration data, with no checkout integration.

**Tech Stack:** Spring Boot, Spring Data JPA, PostgreSQL, React, Vite, existing `adminApi` Manager client.

**Spec:** `docs/specs/2026-11-11-manager-promotion-management-design.md`

## Global Constraints

- Campaign fields are code, name, start date, and end date; campaign code is immutable after creation.
- Product rules contain product ID and discount percent; invoice rules contain minimum invoice amount and discount percent; voucher rules contain voucher ID and discount percent.
- Create/update of a campaign and all its rules is atomic.
- Keep the current schema; do not add campaign activation/status fields.
- Do not apply campaign rules to cart, checkout, orders, payments, or invoice totals.
- Manager endpoints stay under `/api/manager/promotions` and use the existing Manager authorization flow.
- Create, update, and delete write to the shared audit log; deleting a campaign only cascades to its configuration rules.
- Do not modify standalone voucher behavior or unrelated backend/frontend areas.

## Review Focus

- Unauthenticated or non-Manager callers must not read or mutate campaigns; confirm the controller uses the established `/api/manager/**` security chain.
- Invalid date ranges, percentages outside `(0, 100]`, negative invoice thresholds, and amounts with unsupported precision must produce a clear API validation error.
- Duplicate rule keys and duplicate campaign codes must fail before persistence constraints can leave a partial update.
- Unknown product or voucher references must reject the entire create/update transaction.
- A failed replacement update must preserve the old campaign and all three old rule groups; confirm the full replacement occurs within one transaction.

---

### Task 1: Add transactional campaign persistence and validation

**Files:**
- Create: `backend/src/main/java/com/htttdn/crm/repository/PromotionCampaignRepository.java`
- Create: `backend/src/main/java/com/htttdn/crm/repository/PromotionProductRuleRepository.java`
- Create: `backend/src/main/java/com/htttdn/crm/repository/PromotionInvoiceRuleRepository.java`
- Create: `backend/src/main/java/com/htttdn/crm/repository/PromotionVoucherRuleRepository.java`
- Create: `backend/src/main/java/com/htttdn/crm/service/PromotionCampaignService.java`
- Modify: `backend/src/main/java/com/htttdn/crm/service/AuditTrail.java`
- Reference: `backend/src/main/java/com/htttdn/crm/entity/PromotionCampaign.java`, `PromotionProductRule.java`, `PromotionInvoiceRule.java`, `PromotionVoucherRule.java`
- Reference: `backend/src/main/java/com/htttdn/crm/service/AdminServiceSupport.java`, `AuditTrail.java`, `backend/src/main/java/com/htttdn/crm/repository/ProductRepository.java`, `StoreVoucherRepository.java`

**Interfaces:**
- `PromotionCampaignService.list(search, page, size)` returns `Page<CampaignSummary>`; each summary contains campaign fields and counts for product, invoice, and voucher rules.
- `PromotionCampaignService.get(id)` returns a `CampaignDetail` with campaign fields and the three ordered rule arrays.
- `PromotionCampaignService.create(input)` creates campaign plus rules and returns detail.
- `PromotionCampaignService.replace(id, input)` keeps the existing code, replaces name/dates/all rule arrays atomically, and returns detail.
- `PromotionCampaignService.delete(id)` deletes the campaign configuration and records an audit event.
- The write input uses `code`, `name`, `startDate`, `endDate`, `productRules[]`, `invoiceRules[]`, and `voucherRules[]`; a missing rule array is treated as empty.

- [ ] Define repository queries for case-insensitive campaign-code lookup, campaign search by code/name, rule retrieval by campaign ID, and rule deletion by campaign ID.
- [ ] Implement list/detail mapping with counts and stable rule ordering by row ID.
- [ ] Implement create validation: required trimmed code/name, 40/150 character limits, unique code, and end date on/after start date.
- [ ] Implement rule validation: percentage greater than zero and at most 100 with at most two fractional digits; non-negative invoice threshold within the schema precision; no duplicate product IDs, invoice thresholds, or voucher IDs; all product/voucher IDs exist.
- [ ] Add a typed, explicit-allowlist campaign snapshot to `AuditTrail` that records campaign fields and rule IDs/thresholds/percentages without serializing entities.
- [ ] Implement create, full rule replacement, and hard delete with `@Transactional`; use existing `AdminServiceSupport` audit helpers with type `PROMOTION_CAMPAIGN` and before/after aggregate snapshots.
- [ ] Compile backend production sources with `cd backend && mvn -q -DskipTests package`; expected result: success without schema changes.

### Task 2: Expose the Manager campaign API

**Files:**
- Create: `backend/src/main/java/com/htttdn/crm/controller/PromotionCampaignController.java`
- Reference: `backend/src/main/java/com/htttdn/crm/controller/AdminVoucherController.java`
- Reference: `backend/src/main/java/com/htttdn/crm/security/AdminAccessGuard.java`

**Interfaces:**
- `GET /api/manager/promotions?page=&size=&search=` returns a paged campaign summary.
- `GET /api/manager/promotions/{id}` returns campaign detail.
- `POST /api/manager/promotions` returns HTTP 201 and the created detail.
- `PUT /api/manager/promotions/{id}` replaces editable fields and rule arrays, returning detail.
- `DELETE /api/manager/promotions/{id}` returns HTTP 204.

- [ ] Add the five routes as thin controller methods delegating to `PromotionCampaignService`.
- [ ] Confirm `AdminAccessGuard` protects `/api/manager/**` and does not require a new authorization rule for this route.
- [ ] Compile backend production sources with `cd backend && mvn -q -DskipTests package`; expected result: success and all routes compile.

### Task 3: Add the Manager campaign workspace

**Files:**
- Create: `frontend/src/features/manager/PromotionCampaigns.jsx`
- Create: `frontend/src/features/manager/promotion-campaigns.css`
- Modify: `frontend/src/app/ManagerApp.jsx`
- Modify: `frontend/src/api/manager-api.js`
- Reference: `frontend/src/features/admin/AdminVouchers.jsx`, `frontend/src/features/manager/StockReceiving.jsx`, `frontend/src/shared/hooks/useManagerResource.js`

**Interfaces:**
- Export one default `PromotionCampaigns` page component.
- Add `adminEndpoints.promotions({ search, page, size })` plus detail/create/update/delete URL helpers under `/api/manager/promotions`.
- Add the `promotions` Manager route key, “Chiến dịch khuyến mãi” navigation label, an appropriate existing Lucide icon, and a lazy page mount.

- [ ] Implement a paginated/searchable campaign list showing code, name, date range, and rule counts, with inspect/edit/delete actions and loading/empty/error states.
- [ ] Implement a create/edit dialog with separate product, invoice, and voucher rule sections; permit adding/removing multiple rules, submit IDs, and make campaign code read-only while editing.
- [ ] Load product and voucher choices from existing Manager endpoints and display readable labels; keep campaign-specific API calls on `adminApi` so the existing Manager token and refresh behavior apply.
- [ ] Show campaign detail from the detail endpoint and require confirmation before hard deletion.
- [ ] Keep styling scoped to the new Manager page and preserve existing Manager responsive/theme conventions.
- [ ] Run `cd frontend && npx vite build`; expected result: the default build succeeds with the new lazy route.

### Task 4: Verify the feature boundary and report

**Files:**
- Review: `frontend/src/app/ManagerApp.jsx`, `frontend/src/api/manager-api.js`, all files created in Tasks 1–3.

- [ ] Review the diff to confirm there are no schema, checkout, order, payment, standalone voucher, backend auth, or unrelated feature changes.
- [ ] Confirm all campaign endpoints are under `/api/manager/promotions`, all mutations audit the aggregate, and create/update remain transactional.
- [ ] Run production-source compilation and frontend build from the task commands above; report exact outcomes and any environment limitation.
- [ ] Summarize the new Manager navigation/page, API routes, validation, audit behavior, and any remaining uncertainty.
