# payOS Promo Code Sequence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the customer checkout sequence so an optional promotion code is validated and applied server-side, the discounted payable amount is persisted and sent to payOS, and webhook amount mismatches are rejected.

**Architecture:** Keep the existing checkout, stock reservation, display-only return URL, payOS webhook, duplicate-event handling, and timeout-cleanup flow. Add promotion validation and calculation inside the checkout transaction, reserve usage against the generated order identity, persist the calculated monetary values with the order, and make the webhook compare the received amount with the stored canonical payable amount before changing payment or order status.

**Tech Stack:** PlantUML sequence diagram (`.puml`), Git, text/diff validation. No application code or raw SQL is introduced.

---

### Task 1: Update the customer payOS checkout sequence

**Files:**
- Modify: `docs/diagrams/customer/III-07-shopping-cart-order-payos.puml`
- Verify: `docs/superpowers/specs/2026-09-18-payos-promo-code-design.md`

- [ ] **Step 1: Add the optional promotion input and validation boundary**

  Change the checkout request to include optional `promoCode`, while keeping `cart`, `address`, and `paymentMethod`. Show the backend validating code existence, active period, eligibility conditions, and remaining usage. Add an invalid/not-applicable branch that rolls back checkout and returns `400 PROMO_NOT_APPLICABLE` without creating an order.

- [ ] **Step 2: Add server-side calculation and persistence**

  Show the backend calculating `subtotal`, `discountAmount`, and `finalAmount = max(subtotal - discountAmount, 0)`, with VND half-up rounding. Show the pending order storing the promotion code and calculated amounts, with the existing order `totalAmount` serving as the canonical payable amount. Make the operation order explicit: create the pending order, generate its unique `orderCode`, then reserve accepted promotion usage keyed to that order identity, all within the same checkout transaction. Make the reservation concurrency-safe.

- [ ] **Step 3: Send the discounted amount to payOS**

  Change the payOS request to visibly send `amount = finalAmount`, rather than an undiscounted total. Keep the existing payment-link fields and redirect behavior.

- [ ] **Step 4: Strengthen webhook amount validation and promotion lifecycle**

  Show the webhook loading the stored payable amount and rejecting any received amount that does not exactly match it. Keep signature, order identity, and `data.code` checks. On success, finalize the reserved promotion usage once; on failure, cancellation, expiration, or timeout cleanup, release it once. Preserve duplicate webhook no-op behavior and existing stock-release safeguards.

- [ ] **Step 5: Review the diagram against the approved spec**

  Check that the sequence contains no raw SQL, uses business-language database actions, preserves the existing stock/return/webhook/cleanup flows, and includes every acceptance criterion from the spec.

- [ ] **Step 6: Run focused verification**

  Run:

  ```powershell
  $diagram = "docs/diagrams/customer/III-07-shopping-cart-order-payos.puml"
  $required = @(
    "promoCode", "PROMO_NOT_APPLICABLE", "discountAmount", "finalAmount",
    "validity", "eligibility", "usage", "Create pending order", "unique numeric orderCode",
    "RESERVED", "CONFIRMED", "Release.*promo", "amount = finalAmount",
    "received.*amount", "stored.*finalAmount", "Verify HMAC-SHA256 signature",
    "Verify orderCode", "data.code", "Return URL and cancelUrl are for display only",
    "Duplicate webhook callback", "Release reserved stock once", "Load expired pending orders with lock",
    "No-op.*already released or confirmed", "cleanup race"
  )
  foreach ($pattern in $required) {
    if (-not (Select-String -Path $diagram -Pattern $pattern -Quiet)) {
      throw "Missing required sequence requirement: $pattern"
    }
  }
  $requestLine = Select-String -Path $diagram -Pattern "POST /api/orders" | Select-Object -First 1 -ExpandProperty Line
  if ($requestLine -notmatch "promoCode" -or $requestLine -match "discountAmount|finalAmount") {
    throw "The client request must include only optional promoCode, not calculated monetary fields"
  }
  if (Select-String -Path $diagram -Pattern "No promo code|discountAmount = 0|Round.*VND|half up" -AllMatches | Measure-Object | Select-Object -ExpandProperty Count -eq 0) {
    throw "Missing no-promo or VND rounding behavior"
  }
  if (Select-String -Path $diagram -Pattern "SELECT|INSERT|UPDATE|DELETE|FOR UPDATE|SQL" -Quiet) {
    throw "Raw SQL or SQL syntax found in the business-language diagram"
  }
  git diff --check
  if ((git diff --name-only HEAD) -ne "docs/diagrams/customer/III-07-shopping-cart-order-payos.puml") {
    throw "Unexpected files changed in the implementation worktree"
  }
  $target = "docs/diagrams/customer/III-07-shopping-cart-order-payos.puml"
  $unexpected = git status --short --untracked-files=all | Where-Object {
    $_ -and ($_ -notmatch "^(?: M|M |MM) $([regex]::Escape($target))$")
  }
  if ($unexpected) {
    throw "Unexpected staged, unstaged, or untracked changes found"
  }
  git diff -- docs/diagrams/customer/III-07-shopping-cart-order-payos.puml
  ```

  Expected: every required-pattern assertion passes, the request assertion confirms that only `promoCode` is client-supplied, the no-promo and VND-rounding assertion passes, no raw SQL terms are found, `git diff --check` exits successfully, and both staged/unstaged/untracked checks report only the intended sequence update. Review the full diff manually for the mismatch branch to ensure it does not update payment/order status.

- [ ] **Step 7: Commit the diagram update**

  ```powershell
  git add docs/diagrams/customer/III-07-shopping-cart-order-payos.puml
  git commit -m "docs: add promo flow to payOS checkout sequence"
  ```
