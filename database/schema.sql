-- Schema cho database PostgreSQL htttdn.
-- Phần đầu giữ nguyên mô hình categories/products/customers/admins/orders
-- của dự án; các cột/bảng mở rộng phục vụ luồng customer storefront.

CREATE TABLE IF NOT EXISTS categories (
    category_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_name ON categories(name);

CREATE TABLE IF NOT EXISTS products (
    product_id BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL REFERENCES categories(category_id),
    name VARCHAR(150) NOT NULL,
    color VARCHAR(1000),
    size VARCHAR(1000),
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    quantity_remaining INTEGER NOT NULL DEFAULT 0 CHECK (quantity_remaining >= 0)
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS gender VARCHAR(20) NOT NULL DEFAULT 'NAM';
ALTER TABLE products ADD COLUMN IF NOT EXISTS description VARCHAR(4000);
ALTER TABLE products ADD COLUMN IF NOT EXISTS material VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(2000);
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge VARCHAR(80);
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS customers (
    customer_id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    age SMALLINT,
    preferences VARCHAR(4000),
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone VARCHAR(40);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lock_reason VARCHAR(2000);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_email ON customers(email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS admins (
    admin_id BIGSERIAL PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    order_id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(customer_id),
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_code BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'PENDING';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address VARCHAR(1000);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_released BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
-- Có thể orders đã có dữ liệu từ phiên bản cũ. Tách bước backfill để PostgreSQL
-- không cố thêm cột NOT NULL vào các dòng cũ đang có giá trị NULL.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2);
UPDATE orders SET discount_amount = 0 WHERE discount_amount IS NULL;
ALTER TABLE orders ALTER COLUMN discount_amount SET DEFAULT 0;
ALTER TABLE orders ALTER COLUMN discount_amount SET NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS voucher_code VARCHAR(40);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_code VARCHAR(120);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(1000);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_reason VARCHAR(1000);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_status VARCHAR(30) NOT NULL DEFAULT 'NONE';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_requested_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_order_code ON orders(order_code) WHERE order_code IS NOT NULL;
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

CREATE TABLE IF NOT EXISTS order_items (
    order_item_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(product_id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL
);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size VARCHAR(1000);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS color VARCHAR(1000);

CREATE TABLE IF NOT EXISTS cart_items (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(product_id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    size VARCHAR(1000),
    color VARCHAR(1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_customer_product_variant
    ON cart_items(customer_id, product_id, COALESCE(size, ''), COALESCE(color, ''));

CREATE TABLE IF NOT EXISTS wishlists (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS customer_addresses (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    label VARCHAR(80),
    recipient_name VARCHAR(150) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    address_line VARCHAR(500) NOT NULL,
    ward VARCHAR(100),
    district VARCHAR(100),
    province VARCHAR(100),
    default_address BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_vouchers (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE',
    discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
    min_order_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    usage_limit INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

ALTER TABLE store_vouchers ADD COLUMN IF NOT EXISTS description VARCHAR(1000);
ALTER TABLE store_vouchers ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(12,2);
CREATE UNIQUE INDEX IF NOT EXISTS ux_store_vouchers_code_ci ON store_vouchers (upper(code));
CREATE TABLE IF NOT EXISTS voucher_usages (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES orders(order_id),
    voucher_id BIGINT NOT NULL REFERENCES store_vouchers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS customer_notifications (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    content VARCHAR(2000) NOT NULL,
    type VARCHAR(30),
    order_id BIGINT REFERENCES orders(order_id) ON DELETE SET NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback (
    feedback_id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(customer_id),
    admin_id BIGINT REFERENCES admins(admin_id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS product_id BIGINT REFERENCES products(product_id);
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS rating INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'NEW';
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS admin_response VARCHAR(4000);
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES orders(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_order_product ON feedback(order_id, product_id);

-- survey_definitions là mẫu khảo sát mà frontend hiển thị cho khách hàng.
CREATE TABLE IF NOT EXISTS survey_definitions (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(4000),
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS survey_questions (
    id BIGSERIAL PRIMARY KEY,
    survey_id BIGINT NOT NULL REFERENCES survey_definitions(id) ON DELETE CASCADE,
    text VARCHAR(1000) NOT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'TEXT',
    display_order INTEGER NOT NULL DEFAULT 0,
    options_json VARCHAR(4000),
    required BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE survey_definitions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS survey_responses (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(customer_id),
    survey_id BIGINT NOT NULL REFERENCES survey_definitions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(customer_id, survey_id)
);

CREATE TABLE IF NOT EXISTS survey_answers (
    id BIGSERIAL PRIMARY KEY,
    response_id BIGINT NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES survey_questions(id),
    answer VARCHAR(4000) NOT NULL
);

-- Database cũ có thể còn các khóa ngoại survey_id trỏ nhầm sang bảng surveys.
-- Backend hiện dùng survey_definitions nên chỉ giữ khóa ngoại đúng này.
DO $$
DECLARE constraint_row RECORD;
BEGIN
    FOR constraint_row IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'survey_questions'::regclass
          AND contype = 'f'
          AND to_regclass('public.surveys') IS NOT NULL
          AND confrelid = to_regclass('public.surveys')
    LOOP
        EXECUTE format('ALTER TABLE survey_questions DROP CONSTRAINT %I', constraint_row.conname);
    END LOOP;

    FOR constraint_row IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'survey_responses'::regclass
          AND contype = 'f'
          AND to_regclass('public.surveys') IS NOT NULL
          AND confrelid = to_regclass('public.surveys')
    LOOP
        EXECUTE format('ALTER TABLE survey_responses DROP CONSTRAINT %I', constraint_row.conname);
    END LOOP;

    FOR constraint_row IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'survey_responses'::regclass
          AND contype = 'f'
          AND to_regclass('public.users') IS NOT NULL
          AND confrelid = to_regclass('public.users')
    LOOP
        EXECUTE format('ALTER TABLE survey_responses DROP CONSTRAINT %I', constraint_row.conname);
    END LOOP;
END $$;

-- Bổ sung sequence cho database cũ nếu cột id của survey_questions chưa có default.
CREATE SEQUENCE IF NOT EXISTS survey_questions_id_seq;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'survey_questions'
          AND column_name = 'id'
          AND column_default IS NULL
          AND is_identity = 'NO'
    ) THEN
        ALTER TABLE survey_questions ALTER COLUMN id SET DEFAULT nextval('survey_questions_id_seq');
        PERFORM setval('survey_questions_id_seq', COALESCE((SELECT MAX(id) FROM survey_questions), 0) + 1, false);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    family_id VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    audience VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER',
    revoke_reason VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES orders(order_id),
    amount NUMERIC(15,2) NOT NULL,
    payment_link_id VARCHAR(255),
    checkout_url VARCHAR(2000),
    qr_code TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS qr_code TEXT;

CREATE TABLE IF NOT EXISTS payment_attempts (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(order_id),
    provider_order_code BIGINT NOT NULL UNIQUE,
    payment_link_id VARCHAR(255),
    checkout_url VARCHAR(2000),
    qr_code TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_order ON payment_attempts(order_id, id DESC);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id BIGSERIAL PRIMARY KEY,
    event_key VARCHAR(255) NOT NULL UNIQUE,
    order_code BIGINT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_catalog ON products(active, gender, category_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_created ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_feedback_customer ON feedback(customer_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_wishlists_customer ON wishlists(customer_id);
CREATE INDEX IF NOT EXISTS idx_addresses_customer ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_customer_created ON customer_notifications(customer_id, created_at DESC);
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

BEGIN;
CREATE TABLE IF NOT EXISTS suppliers (
 id BIGSERIAL PRIMARY KEY, code VARCHAR(40) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
 email VARCHAR(255), phone VARCHAR(30), address VARCHAR(1000), notes VARCHAR(4000),
 active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_code_ci ON suppliers(upper(code));
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id BIGINT REFERENCES suppliers(id);
ALTER TABLE survey_definitions ADD COLUMN IF NOT EXISTS audience VARCHAR(255) NOT NULL DEFAULT 'ALL';
CREATE TABLE IF NOT EXISTS survey_recipients (
 survey_id BIGINT NOT NULL REFERENCES survey_definitions(id), customer_id BIGINT NOT NULL REFERENCES customers(customer_id), PRIMARY KEY(survey_id,customer_id)
);
CREATE TABLE IF NOT EXISTS survey_notified_customers (
 survey_id BIGINT NOT NULL REFERENCES survey_definitions(id), customer_id BIGINT NOT NULL REFERENCES customers(customer_id), PRIMARY KEY(survey_id,customer_id)
);
-- Expand legacy role/audience-only checks, without dropping unrelated constraints.
DO $$ DECLARE item RECORD; BEGIN
 FOR item IN SELECT conname FROM pg_constraint WHERE conrelid='customers'::regclass AND contype='c'
 AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='customers'::regclass AND attname='role')]::smallint[]
 LOOP EXECUTE format('ALTER TABLE customers DROP CONSTRAINT %I',item.conname); END LOOP;
 ALTER TABLE customers ADD CONSTRAINT customers_portal_role_check CHECK (role IN ('CUSTOMER','ADMIN','MANAGER'));
 FOR item IN SELECT conname FROM pg_constraint WHERE conrelid='refresh_tokens'::regclass AND contype='c'
 AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='refresh_tokens'::regclass AND attname='audience')]::smallint[]
 LOOP EXECUTE format('ALTER TABLE refresh_tokens DROP CONSTRAINT %I',item.conname); END LOOP;
 ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_portal_audience_check CHECK (audience IN ('CUSTOMER','ADMIN','MANAGER'));
END $$;
COMMIT;

-- Internal portal operation history. Account deletion never cascades into this history.
BEGIN;
CREATE TABLE IF NOT EXISTS audit_logs (
 id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
 actor_id BIGINT NOT NULL,actor_name VARCHAR(150) NOT NULL,actor_role VARCHAR(20) NOT NULL,
 action VARCHAR(40) NOT NULL,entity_type VARCHAR(40) NOT NULL,target_id BIGINT NOT NULL,
 before_data TEXT NOT NULL,after_data TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at,id);
CREATE INDEX IF NOT EXISTS idx_audit_actor_role ON audit_logs(actor_role,created_at);
-- Payment collection and review state remain operational; refunds are no longer modeled here.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_collected_amount NUMERIC(15,2) CHECK (cod_collected_amount >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_collected_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_collected_by BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_collection_note VARCHAR(1000);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_review_required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_review_reason VARCHAR(120);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_review_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_orders_payment_review ON orders(payment_review_required,order_id);
CREATE INDEX IF NOT EXISTS idx_orders_abandoned ON orders(expires_at,order_id)
    WHERE payment_method='PAYOS' AND status IN ('PENDING','PENDING_PAYMENT') AND payment_status IN ('PENDING','EXPIRED','FAILED','CANCELLED');
ALTER TABLE store_vouchers ADD COLUMN IF NOT EXISTS per_customer_limit INTEGER
    CHECK (per_customer_limit IS NULL OR per_customer_limit > 0);
CREATE INDEX IF NOT EXISTS idx_voucher_customer_active ON voucher_usages(voucher_id,order_id)
    WHERE released_at IS NULL;

-- Posted inventory receipts provide a traceable source for supplier purchase costs.
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
CREATE INDEX IF NOT EXISTS idx_stock_receipts_received_at ON stock_receipts(received_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_stock_receipts_supplier ON stock_receipts(supplier_id,received_at DESC);

CREATE TABLE IF NOT EXISTS stock_receipt_items (
    id BIGSERIAL PRIMARY KEY,
    receipt_id BIGINT NOT NULL REFERENCES stock_receipts(id) ON DELETE RESTRICT,
    product_id BIGINT NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
    product_name VARCHAR(150) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(15,2) NOT NULL CHECK (unit_cost >= 0),
    line_total NUMERIC(15,2) NOT NULL CHECK (line_total >= 0)
);
CREATE INDEX IF NOT EXISTS idx_stock_receipt_items_receipt ON stock_receipt_items(receipt_id,id);
CREATE INDEX IF NOT EXISTS idx_stock_receipt_items_product ON stock_receipt_items(product_id,receipt_id);

CREATE TABLE IF NOT EXISTS promotion_campaigns (
    id BIGSERIAL PRIMARY KEY,
    campaign_code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    CONSTRAINT chk_promotion_campaign_dates CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS promotion_product_rules (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES promotion_campaigns(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
    discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
    CONSTRAINT uq_promotion_product_rule UNIQUE(campaign_id,product_id)
);

CREATE TABLE IF NOT EXISTS promotion_invoice_rules (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES promotion_campaigns(id) ON DELETE CASCADE,
    minimum_invoice_amount NUMERIC(15,2) NOT NULL CHECK (minimum_invoice_amount >= 0),
    discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
    CONSTRAINT uq_promotion_invoice_rule UNIQUE(campaign_id,minimum_invoice_amount)
);

CREATE TABLE IF NOT EXISTS promotion_voucher_rules (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES promotion_campaigns(id) ON DELETE CASCADE,
    voucher_id BIGINT NOT NULL REFERENCES store_vouchers(id) ON DELETE RESTRICT,
    discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
    CONSTRAINT uq_promotion_voucher_rule UNIQUE(campaign_id,voucher_id)
);
CREATE INDEX IF NOT EXISTS idx_promotion_campaign_dates ON promotion_campaigns(start_date,end_date);
COMMIT;
