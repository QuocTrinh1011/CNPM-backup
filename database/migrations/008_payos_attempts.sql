-- Run once before starting the updated backend with ddl-auto=none. Safe to rerun.
CREATE TABLE IF NOT EXISTS payment_attempts (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(order_id),
    provider_order_code BIGINT NOT NULL UNIQUE,
    payment_link_id VARCHAR(255),
    checkout_url VARCHAR(2000),
    qr_code TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_order ON payment_attempts(order_id, id DESC);
INSERT INTO payment_attempts (order_id, provider_order_code, payment_link_id, checkout_url, qr_code, status, expires_at, created_at, updated_at)
SELECT p.order_id, o.order_code, p.payment_link_id, p.checkout_url, p.qr_code, p.status, p.expires_at, p.created_at, p.updated_at
FROM payments p JOIN orders o ON o.order_id = p.order_id
WHERE o.payment_method = 'PAYOS' AND p.payment_link_id IS NOT NULL
ON CONFLICT (provider_order_code) DO NOTHING;
