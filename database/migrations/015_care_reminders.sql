-- Run after the existing care-task migrations, before starting the new backend.
-- No historical tasks or notifications are rewritten.
BEGIN;
ALTER TABLE customer_notifications ADD COLUMN IF NOT EXISTS care_task_id BIGINT REFERENCES customer_care_tasks(id);
ALTER TABLE customer_notifications ADD COLUMN IF NOT EXISTS care_due_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS uq_care_notification ON customer_notifications(customer_id,care_task_id,type,care_due_at);
CREATE INDEX IF NOT EXISTS idx_care_notification_inbox ON customer_notifications(customer_id,created_at DESC,id DESC) WHERE care_task_id IS NOT NULL;
COMMIT;
