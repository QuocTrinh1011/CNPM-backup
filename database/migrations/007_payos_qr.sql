-- Run once on an existing database before starting the updated backend with ddl-auto=none.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS qr_code TEXT;
