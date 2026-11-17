-- Internal accounts are stored in customers with an ADMIN role.
-- The separate admins table and feedback.admin_id are not used by the backend.
-- Apply after backing up an existing database.
BEGIN;

ALTER TABLE feedback DROP COLUMN IF EXISTS admin_id;
DROP TABLE IF EXISTS admins;

COMMIT;
