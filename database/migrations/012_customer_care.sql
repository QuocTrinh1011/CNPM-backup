-- Append-only notes and basic care tasks; no notifications, payments or order changes.
BEGIN;
CREATE TABLE IF NOT EXISTS customer_care_notes (
 id BIGSERIAL PRIMARY KEY, customer_id BIGINT NOT NULL REFERENCES customers(customer_id),
 author_id BIGINT NOT NULL REFERENCES customers(customer_id), author_name VARCHAR(255) NOT NULL,
 content VARCHAR(4000) NOT NULL CHECK (length(trim(content))>0), created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_care_notes_customer ON customer_care_notes(customer_id,created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS customer_care_tasks (
 id BIGSERIAL PRIMARY KEY, customer_id BIGINT NOT NULL REFERENCES customers(customer_id),
 assignee_id BIGINT NOT NULL REFERENCES customers(customer_id), title VARCHAR(255) NOT NULL CHECK(length(trim(title))>0),
 description VARCHAR(4000) NOT NULL DEFAULT '', status VARCHAR(30) NOT NULL DEFAULT 'TODO' CHECK(status IN ('TODO','IN_PROGRESS','COMPLETED')),
 due_at TIMESTAMPTZ NOT NULL, created_by BIGINT NOT NULL REFERENCES customers(customer_id),updated_by BIGINT NOT NULL REFERENCES customers(customer_id),
 created_at TIMESTAMPTZ NOT NULL,updated_at TIMESTAMPTZ NOT NULL,completed_at TIMESTAMPTZ,version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_care_tasks_customer ON customer_care_tasks(customer_id,due_at,id);
CREATE INDEX IF NOT EXISTS idx_care_tasks_assignee ON customer_care_tasks(assignee_id,status,due_at);
CREATE INDEX IF NOT EXISTS idx_care_tasks_due ON customer_care_tasks(status,due_at);
COMMIT;
