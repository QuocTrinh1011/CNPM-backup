BEGIN;
CREATE TABLE IF NOT EXISTS suppliers (
 id BIGSERIAL PRIMARY KEY, code VARCHAR(40) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
 email VARCHAR(255), phone VARCHAR(30), address VARCHAR(1000), notes VARCHAR(4000),
 active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_code_ci ON suppliers(upper(code));
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id BIGINT REFERENCES suppliers(id);
ALTER TABLE survey_definitions ADD COLUMN IF NOT EXISTS audience VARCHAR(255) NOT NULL DEFAULT 'ALL';
CREATE TABLE IF NOT EXISTS survey_recipients (
 survey_id BIGINT NOT NULL REFERENCES survey_definitions(id), customer_id BIGINT NOT NULL REFERENCES customers(customer_id), PRIMARY KEY(survey_id,customer_id)
);
CREATE TABLE IF NOT EXISTS survey_notified_customers (
 survey_id BIGINT NOT NULL REFERENCES survey_definitions(id), customer_id BIGINT NOT NULL REFERENCES customers(customer_id), PRIMARY KEY(survey_id,customer_id)
);
-- Expand legacy role/audience-only checks, without dropping unrelated constraints.
DO $$ DECLARE item RECORD; BEGIN
 FOR item IN SELECT conname FROM pg_constraint WHERE conrelid='customers'::regclass AND contype='c'
 AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='customers'::regclass AND attname='role')]::smallint[]
 LOOP EXECUTE format('ALTER TABLE customers DROP CONSTRAINT %I',item.conname); END LOOP;
 ALTER TABLE customers ADD CONSTRAINT customers_portal_role_check CHECK (role IN ('CUSTOMER','ADMIN','MANAGER'));
 FOR item IN SELECT conname FROM pg_constraint WHERE conrelid='refresh_tokens'::regclass AND contype='c'
 AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='refresh_tokens'::regclass AND attname='audience')]::smallint[]
 LOOP EXECUTE format('ALTER TABLE refresh_tokens DROP CONSTRAINT %I',item.conname); END LOOP;
 ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_portal_audience_check CHECK (audience IN ('CUSTOMER','ADMIN','MANAGER'));
END $$;
COMMIT;
