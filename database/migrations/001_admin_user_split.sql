-- Compatibility migration for databases created before the storefront/auth split.
-- Safe to run repeatedly; it only adds columns required by the current entities.

BEGIN;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS lock_reason VARCHAR(2000);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE products ADD COLUMN IF NOT EXISTS badge VARCHAR(80);
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'PENDING';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address VARCHAR(1000);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_released BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS audience VARCHAR(20);
UPDATE refresh_tokens SET audience = 'CUSTOMER' WHERE audience IS NULL;

-- Remove foreign keys left by the legacy users table. The current application
-- authenticates against customers, so these constraints reject new orders and
-- other customer-owned records even when the customers row is valid.
DO $$
DECLARE
    legacy_fk RECORD;
BEGIN
    IF to_regclass('public.users') IS NOT NULL THEN
        FOR legacy_fk IN
            SELECT conrelid::regclass AS table_name, conname
            FROM pg_constraint
            WHERE contype = 'f'
              AND confrelid = 'public.users'::regclass
        LOOP
            EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', legacy_fk.table_name, legacy_fk.conname);
        END LOOP;
    END IF;
END $$;

COMMIT;
