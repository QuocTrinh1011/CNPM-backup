-- Apply before starting the updated backend. Existing counters/orders are preserved.
BEGIN;
ALTER TABLE store_vouchers ADD COLUMN IF NOT EXISTS description VARCHAR(1000);
ALTER TABLE store_vouchers ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(12,2);
-- Fails safely if legacy codes collide ignoring case; do not merge customer history.
CREATE UNIQUE INDEX IF NOT EXISTS ux_store_vouchers_code_ci ON store_vouchers (upper(code));
CREATE TABLE IF NOT EXISTS voucher_usages (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES orders(order_id),
    voucher_id BIGINT NOT NULL REFERENCES store_vouchers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ
);
COMMIT;
