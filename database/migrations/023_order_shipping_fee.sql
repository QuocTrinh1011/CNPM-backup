BEGIN;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(15,2);
UPDATE orders SET shipping_fee = 0 WHERE shipping_fee IS NULL;
ALTER TABLE orders ALTER COLUMN shipping_fee SET DEFAULT 0;
ALTER TABLE orders ALTER COLUMN shipping_fee SET NOT NULL;

COMMIT;
