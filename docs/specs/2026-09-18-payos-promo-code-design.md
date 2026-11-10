# payOS Promo Code Checkout Sequence Design

## Goal

Extend the customer checkout sequence so an optional promotion code is validated and applied by the backend before creating a pending order and requesting payment from payOS.

## Scope

- Update `docs/diagrams/customer/III-07-shopping-cart-order-payos.puml` only.
- Add an optional `promoCode` to the existing order request; keep `cart`, `address`, and `paymentMethod` unchanged. `promoCode` is the only client-supplied promotion field.
- Show backend validation of the promotion's validity period, eligibility conditions, and remaining usage limit.
- Show server-side calculation of `subtotal`, `discountAmount`, and `finalAmount`.
- Show persistence of the promotion code and calculated amounts with the order.
- Show payOS receiving `finalAmount` as its payment amount.
- Show webhook verification that the received amount exactly matches the stored `finalAmount`.
- Keep all existing stock reservation, return URL, webhook idempotency, failure handling, and timeout cleanup flows.

## Design

### Trusted calculation boundary

The customer portal keeps sending `cart`, `address`, and `paymentMethod`, with optional `promoCode` added. It does not send `discountAmount` or `finalAmount`. The backend does not trust client-provided monetary values; it calculates them after loading the cart and before creating the pending order.

### Promotion validation and usage

Inside the existing checkout transaction, the backend validates that the code exists, is active, is within its validity period, satisfies the order conditions, and has remaining usage capacity. The reservation is an atomic, concurrency-safe business operation tied to the order code. It records a `RESERVED` usage state so concurrent orders cannot consume the same last available use.

The calculation is `finalAmount = max(subtotal - discountAmount, 0)`. Amounts use VND with no fractional unit for the payOS request; the backend rounds half up to the nearest VND before persisting and sending the amount. In the current domain model, the persisted payable amount represented as `finalAmount` maps to the order's existing `totalAmount`; it is not a second competing total.

The backend creates the pending order and makes its unique `orderCode` available before reserving the promotion usage. The reservation is keyed to that order identity and is committed in the same checkout transaction. The order stores `promoCode`, `discountAmount`, and the canonical payable amount. If a future schema introduces a separate `finalAmount` field, it must remain equal to the payable amount used by payOS and webhook verification.

If checkout cannot continue because the code is invalid or not applicable, the API returns `400 PROMO_NOT_APPLICABLE` and does not create the order. If payment fails, is cancelled, expires, or is cleaned up, the `RESERVED` usage is released exactly once. If payment succeeds, the reservation is finalized as `CONFIRMED` exactly once. Duplicate webhook delivery and cleanup races must be no-ops for an already finalized or released reservation.

### payOS and webhook verification

The payment request sends `amount = finalAmount`. The webhook verifies the signature, order identity, `data.code`, and that the received integer VND amount equals the order's stored canonical payable amount. A mismatch is rejected and does not transition the order to `CONFIRMED` or `PAID`.

### Sequence outcomes

| Situation | Result |
|---|---|
| No promo code | `discountAmount = 0`; payOS receives the calculated order total |
| Valid promo code | Code and discount are stored; payOS receives `finalAmount` |
| Invalid, expired, ineligible, or exhausted code | Checkout returns an error; no order is created |
| Webhook amount mismatch | Webhook is rejected; order/payment remains unconfirmed |
| Payment failure or timeout after reservation | Order is cancelled/expired and promo usage is released |
| Successful payment | Order is confirmed and promo usage is finalized |

## Acceptance criteria

- The request line contains `promoCode` as an optional field.
- The sequence visibly includes promotion validation, discount calculation, final amount calculation, and order persistence.
- The payOS request visibly sends `finalAmount`, not the pre-discount total.
- The webhook visibly compares the received amount with the stored `finalAmount` and rejects mismatches.
- Failure, duplicate webhook, and timeout cleanup paths remain present.
- Signature verification, `orderCode`/`data.code` validation, payment status transitions, display-only return/cancel handling, one-time stock release, and locked batch timeout cleanup remain present.
- Promotion reservation and release/finalization are represented as concurrency-safe and idempotent business actions.
- The diagram contains no raw SQL commands; database operations use business-language actions.
