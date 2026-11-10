BEGIN;
CREATE TABLE IF NOT EXISTS support_tickets (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(customer_id),
    order_id BIGINT REFERENCES orders(order_id),
    assignee_id BIGINT REFERENCES customers(customer_id),
    created_by BIGINT NOT NULL REFERENCES customers(customer_id),
    request_key VARCHAR(36) NOT NULL,
    title VARCHAR(150) NOT NULL,
    description VARCHAR(4000) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED')),
    messages TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_support_request UNIQUE(created_by,request_key)
);
CREATE INDEX IF NOT EXISTS idx_support_customer ON support_tickets(customer_id,updated_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_support_queue ON support_tickets(status,assignee_id,updated_at DESC,id DESC);
ALTER TABLE customer_notifications ADD COLUMN IF NOT EXISTS support_ticket_id BIGINT REFERENCES support_tickets(id);
CREATE INDEX IF NOT EXISTS idx_support_notification ON customer_notifications(support_ticket_id,customer_id);
COMMIT;
