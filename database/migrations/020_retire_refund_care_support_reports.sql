-- Apply after taking a backup. Historical generic audit rows are intentionally retained.
BEGIN;

DROP INDEX IF EXISTS idx_cashflow_payos_paid;
DROP INDEX IF EXISTS idx_cashflow_cod_collected;
DROP INDEX IF EXISTS idx_cashflow_refund_processed;
DROP INDEX IF EXISTS idx_orders_salesperson;

ALTER TABLE customer_notifications DROP COLUMN IF EXISTS support_ticket_id;
ALTER TABLE customer_notifications DROP COLUMN IF EXISTS care_task_id;
ALTER TABLE customer_notifications DROP COLUMN IF EXISTS care_due_at;

DROP TABLE IF EXISTS support_tickets;
DROP TABLE IF EXISTS customer_care_notes;
DROP TABLE IF EXISTS customer_care_tasks;
DROP TABLE IF EXISTS order_refunds;

ALTER TABLE orders DROP COLUMN IF EXISTS refund_status;
ALTER TABLE orders DROP COLUMN IF EXISTS refunded_amount;
ALTER TABLE orders DROP COLUMN IF EXISTS refund_pending_amount;
ALTER TABLE orders DROP COLUMN IF EXISTS paid_at;
ALTER TABLE orders DROP COLUMN IF EXISTS salesperson_id;

-- Keep audit_logs and its rows, along with operational COD collection and payment review fields.
COMMIT;
