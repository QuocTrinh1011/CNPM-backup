-- Chỉ lưu lịch sử xử lý; không thay đổi thanh toán, tồn kho hoặc voucher.
BEGIN;
CREATE TABLE IF NOT EXISTS order_return_events (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(order_id),
    manager_id BIGINT REFERENCES customers(customer_id),
    manager_name VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL,
    note VARCHAR(1000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_return_event_order_status UNIQUE(order_id,status),
    CONSTRAINT chk_return_event_status CHECK(status IN ('APPROVED','REJECTED','COMPLETED'))
);
CREATE INDEX IF NOT EXISTS idx_return_events_order ON order_return_events(order_id,id);
COMMIT;
