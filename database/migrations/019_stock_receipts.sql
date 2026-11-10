BEGIN;

-- Each posted receipt is the source for received-stock expense reporting.
CREATE TABLE IF NOT EXISTS stock_receipts (
    id BIGSERIAL PRIMARY KEY,
    receipt_code VARCHAR(40) NOT NULL UNIQUE,
    supplier_id BIGINT NOT NULL REFERENCES suppliers(id),
    supplier_code VARCHAR(40) NOT NULL,
    supplier_name VARCHAR(150) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED')),
    total_cost NUMERIC(15,2) NOT NULL CHECK (total_cost >= 0),
    note VARCHAR(2000),
    created_by BIGINT REFERENCES customers(customer_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_receipts_received_at
    ON stock_receipts(received_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_stock_receipts_supplier
    ON stock_receipts(supplier_id, received_at DESC);

CREATE TABLE IF NOT EXISTS stock_receipt_items (
    id BIGSERIAL PRIMARY KEY,
    receipt_id BIGINT NOT NULL REFERENCES stock_receipts(id) ON DELETE RESTRICT,
    product_id BIGINT NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
    product_name VARCHAR(150) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(15,2) NOT NULL CHECK (unit_cost >= 0),
    line_total NUMERIC(15,2) NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_receipt_items_receipt
    ON stock_receipt_items(receipt_id, id);
CREATE INDEX IF NOT EXISTS idx_stock_receipt_items_product
    ON stock_receipt_items(product_id, receipt_id);

COMMIT;
