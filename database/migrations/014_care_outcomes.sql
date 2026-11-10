-- Extend the existing table only. Old completed tasks intentionally keep NULL outcomes.
BEGIN;
ALTER TABLE customer_care_tasks ADD COLUMN IF NOT EXISTS outcome VARCHAR(30);
ALTER TABLE customer_care_tasks ADD COLUMN IF NOT EXISTS result_note VARCHAR(4000);
ALTER TABLE customer_care_tasks ADD COLUMN IF NOT EXISTS parent_task_id BIGINT REFERENCES customer_care_tasks(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_care_parent_task ON customer_care_tasks(parent_task_id);
COMMIT;
