# Freeship từ 399.000đ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Charge 30.000đ shipping below 399.000đ after voucher discounts, waive it at and above the threshold, and show the fee clearly to customers and staff.

**Architecture:** Spring Boot calculates and stores the authoritative fee on each order and includes it in COD/PayOS totals. React uses the same threshold for checkout preview, while order detail views display the stored value. A PostgreSQL migration preserves existing order totals by defaulting their shipping fee to zero.

**Tech Stack:** Java 21, Spring Boot, PostgreSQL, Maven, React, Vite, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-16-free-shipping-399k-design.md`

## Global Constraints

- Fee is 30.000đ below a 399.000đ merchandise total after voucher; fee is zero at or above 399.000đ.
- Backend calculates the fee; the client does not submit or control it.
- Order total is merchandise subtotal minus voucher discount plus shipping fee; COD and PayOS use that same total.
- Existing orders receive shipping fee 0 so their stored totals remain unchanged.
- Do not add carrier integration, location-based fees, or voucher-rule changes.
- Storefront benefit copy is `FREESHIP ĐƠN TỪ 399K`.
- Manager total income continues to include amounts collected from customers, including shipping; carrier costs remain untracked.

## Review Focus

- **Exact threshold after voucher:** 399.000đ is free, while 398.999đ is charged. Pin both in Task 1 and Task 2 tests.
- **Voucher lowers eligibility:** a discount that takes merchandise below 399.000đ must add 30.000đ. Pin in Task 1 and Task 2 tests.
- **Client cannot choose a fee:** order requests carry no shipping-fee input; assert the server-calculated value in Task 1.
- **Stored legacy orders:** default shipping fee is zero and existing `total_amount` is not rewritten. Keep the migration additive in Task 1.
- **Payment amount consistency:** COD and PayOS use `total_amount` including the fee. Pin the COD payment amount and PayOS order amount in Task 1.

---

### Task 1: Calculate and persist shipping fee in the backend

**Files:**
- Modify: `backend/src/test/java/com/htttdn/crm/service/OrderConfirmationTest.java`
- Modify: `backend/src/main/java/com/htttdn/crm/entity/Order.java`
- Modify: `backend/src/main/java/com/htttdn/crm/service/OrderService.java`
- Modify: `database/schema.sql`
- Create: `database/migrations/023_order_shipping_fee.sql`
- Modify: `database/migrations/README.md`
- Create: `docs/superpowers/specs/2026-11-16-free-shipping-399k-design.md`
- Create: `docs/superpowers/plans/2026-11-16-free-shipping-399k.md`

**Interfaces:**
- `OrderService.OrderView` exposes `BigDecimal shippingFee`.
- `OrderService.create(...)` sets the stored fee and computes `totalAmount = subtotal - discount + shippingFee`.

- [ ] **Step 1: Write failing backend tests**

Add these test methods to `OrderConfirmationTest`:

- `codBelowThresholdAddsShippingFeeToOrderAndPayment`: use a 398.999đ product; assert serialized `OrderView.shippingFee` is 30.000đ, `totalAmount` is 428.999đ, and the saved COD `Payment.amount` is 428.999đ.
- `waivesShippingWhenPostVoucherAmountIsExactly399000`: use a 420.000đ product and stub a 21.000đ voucher discount; assert `shippingFee` is zero and `totalAmount` is 399.000đ.
- `payosUsesShippingFeeWhenVoucherLowersAmountBelowThreshold`: use a 420.000đ product and stub a 21.001đ discount; assert `shippingFee` is 30.000đ, `totalAmount` is 428.999đ, and the order passed to `PayosService.createPaymentLink` has total 428.999đ.

Use real `OrderService` code with mocked repositories and `VoucherService`; do not add a shipping-fee field to `CheckoutRequest`.

- [ ] **Step 2: Run tests to verify the expected failure**

Run: `cd backend && mvn -q -Dtest=OrderConfirmationTest test`

Expected: FAIL because order views and totals do not yet include threshold shipping.

- [ ] **Step 3: Implement the backend fee and database compatibility**

Add `Order.shippingFee` as a non-null `BigDecimal` mapped to `orders.shipping_fee`, defaulting to zero. In `OrderService.create`, calculate eligibility from `subtotal - discount` after `VoucherService.reserve`; add 30.000đ below 399.000đ and zero otherwise. Include the value in `OrderView`; leave `CheckoutRequest` unchanged.

Add `shipping_fee NUMERIC(15,2) NOT NULL DEFAULT 0` to the new-database schema and migration 023. The migration must not update `total_amount`. Add migration 023 to the ordered migration README.

- [ ] **Step 4: Run the backend test and verify schema statements**

Run: `cd backend && mvn -q -Dtest=OrderConfirmationTest test`

Expected: PASS. Inspect the migration diff to confirm it only adds the zero-default column and leaves existing totals untouched.

- [ ] **Step 5: Commit the backend slice**

```bash
git add backend/src/main/java/com/htttdn/crm/entity/Order.java backend/src/main/java/com/htttdn/crm/service/OrderService.java backend/src/test/java/com/htttdn/crm/service/OrderConfirmationTest.java database/schema.sql database/migrations/023_order_shipping_fee.sql database/migrations/README.md docs/superpowers/specs/2026-11-16-free-shipping-399k-design.md docs/superpowers/plans/2026-11-16-free-shipping-399k.md
git commit -m "feat(checkout): calculate and persist threshold shipping"
```

### Task 2: Show the threshold and checkout fee

**Files:**
- Create: `frontend/src/features/storefront/shipping-policy.js`
- Create: `frontend/src/features/storefront/shipping-policy.test.js`
- Modify: `frontend/src/features/storefront/CheckoutPage.jsx`
- Modify: `frontend/src/app/CheckoutPage.test.jsx`

**Interfaces:**
- `getShippingFee(merchandiseTotalAfterVoucher: number): number` returns `30000` below `399000`, otherwise `0`.
- `CheckoutPage` uses the helper for preview only and does not include `shippingFee` in `POST /api/orders`.

- [ ] **Step 1: Write failing fee-policy and checkout tests**

Add `chargesThirtyThousandBelow399000AndWaivesAtOrAbove` to `shipping-policy.test.js`; assert `getShippingFee(398999) === 30000`, `getShippingFee(399000) === 0`, and `getShippingFee(500000) === 0`. Add `showsShippingFeeAndTotalBelowThreshold` to `CheckoutPage.test.jsx`; for a 100.000đ subtotal assert the fee line is 30.000đ and checkout total is 130.000đ. Add `voucherDiscountIsAppliedBeforeShippingThresholdAndFeeIsServerOwned`; for 420.000đ subtotal and 21.000đ voucher discount assert shipping is free, and the `/api/orders` body has no `shippingFee` property.

- [ ] **Step 2: Run tests to verify the expected failure**

Run: `cd frontend && npx vitest run src/features/storefront/shipping-policy.test.js src/app/CheckoutPage.test.jsx`

Expected: FAIL because the policy helper and fee breakdown are not implemented.

- [ ] **Step 3: Implement the shared preview and checkout breakdown**

Implement `getShippingFee` with the exact fee and threshold in the spec. In `CheckoutPage`, calculate eligible merchandise as `max(0, cart.subtotal - voucher.discountAmount)`, show shipping as 30.000đ or `Miễn phí`, and include it in the preview and final total. Keep the POST body unchanged so the backend remains authoritative.

- [ ] **Step 4: Run the focused frontend tests**

Run: `cd frontend && npx vitest run src/features/storefront/shipping-policy.test.js src/app/CheckoutPage.test.jsx`

Expected: PASS, including tests for threshold and voucher behavior.

- [ ] **Step 5: Commit the checkout slice**

```bash
git add frontend/src/features/storefront/shipping-policy.js frontend/src/features/storefront/shipping-policy.test.js frontend/src/features/storefront/CheckoutPage.jsx frontend/src/app/CheckoutPage.test.jsx
git commit -m "feat(storefront): show threshold shipping in checkout"
```

### Task 3: Show the benefit and recorded fee on order details

**Files:**
- Modify: `frontend/src/app/App.jsx`
- Modify: `frontend/src/app/App.test.jsx`
- Modify: `frontend/src/app/CustomerOrders.jsx`
- Modify: `frontend/src/features/manager/ManagerOrderDetail.jsx`
- Modify: `frontend/src/features/manager/ManagerInvoiceDetail.jsx`
- Modify: `frontend/src/features/manager/ManagerInvoices.jsx`
- Modify: `frontend/src/app/ManagerInvoices.test.jsx`
- Modify: `frontend/src/app/ReturnDisplay.test.jsx`

**Interfaces:**
- Order detail views read the persisted `shippingFee` field; a missing value from legacy/mock responses is treated as zero.

- [ ] **Step 1: Write failing storefront and saved-order tests**

Add `showsFreeShippingThresholdInStorefrontPromiseRow` in `App.test.jsx` to assert the promise row contains `FREESHIP ĐƠN TỪ 399K`. Add `customerOrderDetailShowsRecordedShippingFee` in `App.test.jsx` to assert `OrderView` displays 30.000đ from `shippingFee`. In `ManagerInvoices.test.jsx`, set merchandise subtotal to 1.000.000đ, `discountAmount` to 100.000đ, `shippingFee` to 30.000đ, and `totalAmount` to 930.000đ; assert the invoice list subtotal is 1.000.000đ, the detail panel has a 30.000đ fee line, and total is 930.000đ. Add `managerOrderDetailShowsRecordedShippingFee` in `ReturnDisplay.test.jsx` and assert it renders the persisted 30.000đ fee.

- [ ] **Step 2: Run tests to verify the expected failure**

Run: `cd frontend && npx vitest run src/app/App.test.jsx src/app/ManagerInvoices.test.jsx src/app/ReturnDisplay.test.jsx`

Expected: FAIL because the benefit text and order-detail breakdown are absent and invoice subtotal currently assumes no shipping fee.

- [ ] **Step 3: Implement storefront and order-detail presentation**

Keep the existing size-exchange assertion scoped to `.announcement`. Replace the generic delivery benefit copy in the separate storefront promise row with `FREESHIP ĐƠN TỪ 399K`. Show the persisted fee in customer order detail, Manager order detail, and invoice detail. Adjust invoice merchandise subtotal to `totalAmount + discountAmount - shippingFee`; render zero as `Miễn phí` where a fee line is shown, and treat missing `shippingFee` in legacy/mock responses as zero.

- [ ] **Step 4: Run focused tests, then full verification**

Run: `cd frontend && npx vitest run src/app/App.test.jsx src/app/ManagerInvoices.test.jsx src/app/ReturnDisplay.test.jsx`

Expected: PASS. Then run `cd backend && mvn -q test` and `cd frontend && npx vitest run && npx vite build --mode user && npx vite build --mode admin && npx vite build --mode manager`.

Expected: backend tests and all frontend tests pass; all three portal builds succeed.

- [ ] **Step 5: Commit the order-display slice**

```bash
git add frontend/src/app/App.jsx frontend/src/app/App.test.jsx frontend/src/app/CustomerOrders.jsx frontend/src/features/manager/ManagerOrderDetail.jsx frontend/src/features/manager/ManagerInvoiceDetail.jsx frontend/src/features/manager/ManagerInvoices.jsx frontend/src/app/ManagerInvoices.test.jsx frontend/src/app/ReturnDisplay.test.jsx
git commit -m "feat(orders): display recorded shipping fees"
```
