-- Promotion campaign rules are data definitions only; checkout behavior is not enabled by this migration.
BEGIN;

CREATE TABLE IF NOT EXISTS promotion_campaigns (
    id BIGSERIAL PRIMARY KEY,
    campaign_code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    CONSTRAINT chk_promotion_campaign_dates CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS promotion_product_rules (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES promotion_campaigns(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
    discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
    CONSTRAINT uq_promotion_product_rule UNIQUE(campaign_id,product_id)
);

CREATE TABLE IF NOT EXISTS promotion_invoice_rules (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES promotion_campaigns(id) ON DELETE CASCADE,
    minimum_invoice_amount NUMERIC(15,2) NOT NULL CHECK (minimum_invoice_amount >= 0),
    discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
    CONSTRAINT uq_promotion_invoice_rule UNIQUE(campaign_id,minimum_invoice_amount)
);

CREATE TABLE IF NOT EXISTS promotion_voucher_rules (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES promotion_campaigns(id) ON DELETE CASCADE,
    voucher_id BIGINT NOT NULL REFERENCES store_vouchers(id) ON DELETE RESTRICT,
    discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
    CONSTRAINT uq_promotion_voucher_rule UNIQUE(campaign_id,voucher_id)
);

CREATE INDEX IF NOT EXISTS idx_promotion_campaign_dates ON promotion_campaigns(start_date,end_date);
COMMIT;
