-- Dữ liệu mẫu cho website thời trang nam ANH LỚN SHOP.
-- Mật khẩu tài khoản mẫu là: password

-- Tương thích với database cũ còn cột products.stock.
-- Backend hiện dùng products.quantity_remaining nên chuyển dữ liệu tồn kho
-- trước khi chạy các câu lệnh seed bên dưới.
DO $$
DECLARE
    constraint_row RECORD;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'products'
          AND column_name = 'stock'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'products'
              AND column_name = 'quantity_remaining'
        ) THEN
            EXECUTE 'ALTER TABLE products ADD COLUMN quantity_remaining INTEGER';
        END IF;

        EXECUTE 'UPDATE products
                 SET quantity_remaining = COALESCE(quantity_remaining, stock, 0)';
        EXECUTE 'ALTER TABLE products ALTER COLUMN quantity_remaining SET DEFAULT 0';
        EXECUTE 'ALTER TABLE products ALTER COLUMN quantity_remaining SET NOT NULL';
        EXECUTE 'ALTER TABLE products DROP COLUMN stock';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'customers'
          AND column_name = 'role'
    ) THEN
        EXECUTE 'UPDATE customers SET role = ''CUSTOMER'' WHERE role IS NULL';
        EXECUTE 'ALTER TABLE customers ALTER COLUMN role SET DEFAULT ''CUSTOMER''';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'customers'
          AND column_name = 'locked'
    ) THEN
        EXECUTE 'UPDATE customers SET locked = FALSE WHERE locked IS NULL';
        EXECUTE 'ALTER TABLE customers ALTER COLUMN locked SET DEFAULT FALSE';
        EXECUTE 'ALTER TABLE customers ALTER COLUMN locked SET NOT NULL';
    END IF;

    IF to_regclass('public.survey_questions') IS NOT NULL
       AND to_regclass('public.surveys') IS NOT NULL THEN
        FOR constraint_row IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'public.survey_questions'::regclass
              AND contype = 'f'
              AND confrelid = 'public.surveys'::regclass
        LOOP
            EXECUTE format('ALTER TABLE survey_questions DROP CONSTRAINT %I', constraint_row.conname);
        END LOOP;
    END IF;

    IF to_regclass('public.survey_responses') IS NOT NULL
       AND to_regclass('public.surveys') IS NOT NULL THEN
        FOR constraint_row IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'public.survey_responses'::regclass
              AND contype = 'f'
              AND confrelid = 'public.surveys'::regclass
        LOOP
            EXECUTE format('ALTER TABLE survey_responses DROP CONSTRAINT %I', constraint_row.conname);
        END LOOP;
    END IF;
END $$;

INSERT INTO categories(name)
SELECT value
FROM (VALUES ('Áo khoác'), ('Áo thun'), ('Áo polo'), ('Quần')) AS seed(value)
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.name = seed.value);

INSERT INTO products(category_id, name, color, size, price, quantity_remaining, gender, description, material, sale_price, image_url, badge, featured, active)
SELECT c.category_id, seed.name, seed.color, seed.size, seed.price, seed.stock, 'NAM', seed.description, seed.material, seed.sale_price, seed.image_url, seed.badge, seed.featured, TRUE
FROM (VALUES
    ('Áo khoác', 'Áo khoác bomber Essential', 'Đen,Olive', 'M,L,XL', 899000::numeric, 24, 'Phom bomber gọn gàng, dễ phối cùng denim và sneaker cho những ngày thành thị.', 'Nylon chống gió', 699000::numeric, 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=900&q=85', 'BÁN CHẠY', TRUE),
    ('Áo khoác', 'Áo khoác utility Field', 'Be,Xám', 'M,L,XL', 1199000::numeric, 16, 'Thiết kế nhiều túi với tinh thần workwear hiện đại, thực dụng nhưng vẫn nhẹ nhàng.', 'Canvas cotton', NULL, 'https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=900&q=85', 'MỚI', TRUE),
    ('Áo thun', 'Áo thun Heavyweight Signature', 'Trắng,Đen', 'S,M,L,XL', 399000::numeric, 40, 'Áo thun dày vừa, vai rơi tự nhiên và giữ dáng tốt sau nhiều lần mặc.', 'Cotton 280gsm', 299000::numeric, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=85', 'MỚI', TRUE),
    ('Áo thun', 'Áo thun Graphic Đường phố', 'Xám,Đen', 'S,M,L,XL', 449000::numeric, 30, 'Một điểm nhấn đồ họa tiết chế cho tủ đồ cuối tuần.', 'Cotton compact', NULL, 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=900&q=85', NULL, FALSE),
    ('Áo polo', 'Polo Knit Tối giản', 'Nâu,Đen', 'M,L,XL', 599000::numeric, 22, 'Cổ dệt tinh tế, bề mặt mềm và thoáng cho những dịp cần chỉn chu hơn.', 'Cotton knit', 499000::numeric, 'https://images.unsplash.com/photo-1625910513413-5fc45d9e6c0e?auto=format&fit=crop&w=900&q=85', 'ƯU ĐÃI', TRUE),
    ('Áo polo', 'Polo Pique Everyday', 'Trắng,Navy', 'M,L,XL,XXL', 499000::numeric, 27, 'Mẫu polo nền tảng cho cả đi làm và những buổi gặp gỡ nhẹ nhàng.', 'Pique cotton', NULL, 'https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?auto=format&fit=crop&w=900&q=85', NULL, FALSE),
    ('Quần', 'Quần relaxed denim Nhật', 'Indigo,Đen', '29,30,31,32,33,34', 799000::numeric, 18, 'Ống relaxed thoải mái, wash vừa đủ để mặc đẹp từ sáng đến tối.', 'Denim 12oz', 649000::numeric, 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=900&q=85', 'BÁN CHẠY', TRUE),
    ('Quần', 'Quần tây suông Daily', 'Đen,Xám', '29,30,31,32,33,34', 749000::numeric, 20, 'Đường ly gọn và phom suông cân bằng cho nhịp sống linh hoạt.', 'Tropical wool blend', NULL, 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=900&q=85', NULL, FALSE),
    ('Áo khoác', 'Áo khoác dạ dáng dài Urban', 'Nâu,Đen', 'M,L,XL', 1399000::numeric, 14, 'Dáng dạ dài thanh lịch, tạo lớp hoàn thiện gọn gàng cho những ngày se lạnh.', 'Wool blend', 1099000::numeric, 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=85', 'MỚI', TRUE),
    ('Áo khoác', 'Áo khoác denim Trucker', 'Xanh denim,Đen', 'M,L,XL', 999000::numeric, 19, 'Áo khoác denim kinh điển với phom vừa, dễ kết hợp cùng áo thun và quần kaki.', 'Denim cotton', NULL, 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=900&q=85', NULL, FALSE),
    ('Áo thun', 'Áo thun Relaxed Premium', 'Kem,Navy', 'S,M,L,XL,XXL', 479000::numeric, 35, 'Bề mặt mềm, phom relaxed thoáng và bảng màu dễ mặc mỗi ngày.', 'Cotton compact 240gsm', 379000::numeric, 'https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=900&q=85', 'ƯU ĐÃI', TRUE),
    ('Áo thun', 'Áo thun Essential Airy', 'Trắng,Xám', 'S,M,L,XL', 349000::numeric, 42, 'Thiết kế tối giản, nhẹ và thoáng cho những ngày di chuyển nhiều.', 'Cotton air', NULL, 'https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=900', NULL, FALSE),
    ('Áo polo', 'Polo dệt kim Merino Soft', 'Xám,Nâu', 'M,L,XL', 699000::numeric, 17, 'Bề mặt dệt kim mịn, cổ áo đứng dáng và cảm giác chỉn chu vừa đủ.', 'Cotton merino blend', 579000::numeric, 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=85', 'MỚI', TRUE),
    ('Áo polo', 'Polo sọc nhỏ Weekend', 'Navy,Trắng', 'M,L,XL,XXL', 549000::numeric, 24, 'Sọc nhỏ tiết chế tạo điểm nhấn nhẹ cho những buổi dạo phố cuối tuần.', 'Pique cotton', NULL, 'https://images.unsplash.com/photo-1603252110481-7ba873bf42ab?auto=format&fit=crop&w=900&q=85', NULL, FALSE),
    ('Quần', 'Quần cargo tapered Flex', 'Olive,Đen', '29,30,31,32,33,34', 849000::numeric, 21, 'Phom tapered linh hoạt, túi hộp gọn và chất vải co giãn nhẹ.', 'Cotton stretch twill', 699000::numeric, 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=85', 'BÁN CHẠY', TRUE),
    ('Quần', 'Quần short Tech Daily', 'Đen,Xám', 'M,L,XL', 499000::numeric, 29, 'Quần short nhẹ, nhanh khô và đủ gọn cho những ngày vận động trong thành phố.', 'Nylon stretch', NULL, 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=900&q=85', NULL, FALSE)
) AS seed(category_name, name, color, size, price, stock, description, material, sale_price, image_url, badge, featured)
JOIN categories c ON c.name = seed.category_name
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.name = seed.name);

UPDATE products
SET image_url = 'https://images.pexels.com/photos/1043473/pexels-photo-1043473.jpeg?auto=compress&cs=tinysrgb&w=900'
WHERE name = 'Polo Knit Tối giản';

UPDATE products
SET image_url = 'https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=900'
WHERE name = 'Áo thun Essential Airy';

INSERT INTO customers(email, full_name, phone, preferences, password_hash)
SELECT 'khachhang@example.com', 'Nguyễn Minh Khang', '0900000000', 'Phong cách tối giản, ưu tiên màu trung tính', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email = 'khachhang@example.com');

INSERT INTO admins(role, password_hash)
SELECT 'ADMIN', '$2a$10$tAL0K4zyrX8mctqJC6ldHeAvlO8OMpEDI6HD.mMkb4IMoWGiCLxyW'
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE role = 'ADMIN');

-- Admin login uses the same identity table as the application auth service.
UPDATE customers
SET email = 'admin@shop.com',
    password_hash = '$2a$10$tAL0K4zyrX8mctqJC6ldHeAvlO8OMpEDI6HD.mMkb4IMoWGiCLxyW',
    role = 'ADMIN',
    locked = FALSE
WHERE email = 'admin@example.com'
  AND role = 'ADMIN';

INSERT INTO customers(email, full_name, phone, preferences, password_hash, role)
SELECT 'admin@shop.com', 'Quản trị viên', NULL, NULL, '$2a$10$tAL0K4zyrX8mctqJC6ldHeAvlO8OMpEDI6HD.mMkb4IMoWGiCLxyW', 'ADMIN'
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email = 'admin@shop.com');

INSERT INTO survey_definitions(title, description, status, starts_at)
SELECT 'Gu thời trang của bạn', 'Trả lời nhanh để ANH LỚN SHOP gợi ý những món đồ hợp với bạn hơn.', 'PUBLISHED', now()
WHERE NOT EXISTS (SELECT 1 FROM survey_definitions WHERE title = 'Gu thời trang của bạn');

UPDATE survey_definitions
SET description = 'Trả lời nhanh để ANH LỚN SHOP gợi ý những món đồ hợp với bạn hơn.'
WHERE title = 'Gu thời trang của bạn';

INSERT INTO store_vouchers(code, discount_type, discount_value, min_order_amount, usage_limit, active)
SELECT 'ANHLON10', 'PERCENTAGE', 10, 300000, 500, TRUE
WHERE NOT EXISTS (SELECT 1 FROM store_vouchers WHERE code = 'ANHLON10');

INSERT INTO survey_questions(survey_id, text, type, display_order, options_json, required)
SELECT s.id, q.text, q.type, q.display_order, q.options_json, TRUE
FROM survey_definitions s
CROSS JOIN (VALUES
    ('Bạn thường chọn phong cách nào?', 'SINGLE_CHOICE', 0, '["Tối giản","Năng động","Workwear","Smart casual"]'),
    ('Màu sắc bạn mặc nhiều nhất?', 'SINGLE_CHOICE', 1, '["Đen","Trắng","Navy","Màu trung tính"]')
) AS q(text, type, display_order, options_json)
WHERE s.title = 'Gu thời trang của bạn'
  AND NOT EXISTS (SELECT 1 FROM survey_questions existing WHERE existing.survey_id = s.id AND existing.display_order = q.display_order);
