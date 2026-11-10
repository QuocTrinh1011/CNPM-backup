BEGIN;
-- Apply after migration_refunds_abandoned_payos.sql. No historical dates/usages are inferred.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE store_vouchers ADD COLUMN IF NOT EXISTS per_customer_limit INTEGER
    CHECK (per_customer_limit IS NULL OR per_customer_limit > 0);
CREATE INDEX IF NOT EXISTS idx_cashflow_payos_paid ON orders(paid_at)
    WHERE payment_method='PAYOS' AND payment_status='PAID' AND total_amount>0;
CREATE INDEX IF NOT EXISTS idx_cashflow_cod_collected ON orders(cod_collected_at)
    WHERE payment_method='COD' AND cod_collected_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cashflow_refund_processed ON order_refunds(processed_at)
    WHERE status='COMPLETED';
CREATE INDEX IF NOT EXISTS idx_voucher_customer_active ON voucher_usages(voucher_id,order_id)
    WHERE released_at IS NULL;
COMMIT;
