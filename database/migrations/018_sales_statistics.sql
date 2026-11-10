BEGIN;

-- Orders can be attributed to a Manager account for employee sales reporting.
-- Existing and online orders stay NULL until a Manager explicitly assigns them.
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS salesperson_id BIGINT REFERENCES customers(customer_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_salesperson ON orders(salesperson_id, order_id)
    WHERE salesperson_id IS NOT NULL;

COMMIT;
