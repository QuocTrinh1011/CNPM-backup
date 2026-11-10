-- Existing feedback remains public. Safe to run repeatedly.
BEGIN;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
COMMIT;
