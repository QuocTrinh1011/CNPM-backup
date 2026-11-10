-- Source links are optional. Old tasks remain unchanged. Run after migration_customer_care.sql.
BEGIN;
ALTER TABLE customer_care_tasks ADD COLUMN IF NOT EXISTS source_type VARCHAR(30);
ALTER TABLE customer_care_tasks ADD COLUMN IF NOT EXISTS source_id BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_care_source_open ON customer_care_tasks(source_type,source_id)
 WHERE source_type IS NOT NULL AND status <> 'COMPLETED';
CREATE INDEX IF NOT EXISTS idx_care_source ON customer_care_tasks(source_type,source_id);
COMMIT;
