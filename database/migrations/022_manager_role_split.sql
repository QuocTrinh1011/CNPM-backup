BEGIN;

DO $$ DECLARE item RECORD; BEGIN
    FOR item IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'customers'::regclass AND contype = 'c'
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'customers'::regclass AND attname = 'role')]::smallint[]
    LOOP
        EXECUTE format('ALTER TABLE customers DROP CONSTRAINT %I', item.conname);
    END LOOP;

    FOR item IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'refresh_tokens'::regclass AND contype = 'c'
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'refresh_tokens'::regclass AND attname = 'audience')]::smallint[]
    LOOP
        EXECUTE format('ALTER TABLE refresh_tokens DROP CONSTRAINT %I', item.conname);
    END LOOP;
END $$;

UPDATE refresh_tokens
SET status = 'REVOKED',
    revoke_reason = 'ROLE_MIGRATION',
    revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
    audience = 'MANAGER_SALES'
WHERE audience = 'MANAGER';

UPDATE customers SET role = 'MANAGER_SALES' WHERE role = 'MANAGER';

ALTER TABLE customers
    ADD CONSTRAINT customers_portal_role_check
    CHECK (role IN ('CUSTOMER', 'ADMIN', 'MANAGER_HR', 'MANAGER_WAREHOUSE', 'MANAGER_SALES', 'EMPLOYEE'));

ALTER TABLE refresh_tokens
    ADD CONSTRAINT refresh_portal_audience_check
    CHECK (audience IN ('CUSTOMER', 'ADMIN', 'MANAGER_HR', 'MANAGER_WAREHOUSE', 'MANAGER_SALES'));

COMMIT;
