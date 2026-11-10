-- Run before starting the updated backend. No historical feedback is reassigned.
BEGIN;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES orders(order_id);
DO $$
DECLARE old_constraint RECORD;
BEGIN
 FOR old_constraint IN
  SELECT c.conname FROM pg_constraint c
  WHERE c.conrelid='feedback'::regclass AND c.contype='u'
  AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
       FROM unnest(c.conkey) k JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k)
      = ARRAY['customer_id','product_id']::text[]
 LOOP
  EXECUTE format('ALTER TABLE feedback DROP CONSTRAINT %I',old_constraint.conname);
 END LOOP;
END $$;
DROP INDEX IF EXISTS uq_feedback_customer_product;
CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_order_product ON feedback(order_id,product_id);
ALTER TABLE store_vouchers ADD COLUMN IF NOT EXISTS owner_customer_id BIGINT REFERENCES customers(customer_id);
ALTER TABLE store_vouchers ADD COLUMN IF NOT EXISTS reward_survey_id BIGINT REFERENCES survey_definitions(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_survey_reward_customer ON store_vouchers(reward_survey_id,owner_customer_id);
ALTER TABLE survey_definitions ADD COLUMN IF NOT EXISTS reward_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE survey_definitions ADD COLUMN IF NOT EXISTS reward_type VARCHAR(255);
ALTER TABLE survey_definitions ADD COLUMN IF NOT EXISTS reward_value NUMERIC(12,2);
ALTER TABLE survey_definitions ADD COLUMN IF NOT EXISTS reward_minimum NUMERIC(12,2);
ALTER TABLE survey_definitions ADD COLUMN IF NOT EXISTS reward_maximum NUMERIC(12,2);
ALTER TABLE survey_definitions ADD COLUMN IF NOT EXISTS reward_days INTEGER;
COMMIT;
