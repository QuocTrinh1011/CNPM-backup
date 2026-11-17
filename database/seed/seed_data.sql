-- Dữ liệu mẫu cho website thời trang nam ANH LỚN SHOP.
-- Mật khẩu tài khoản mẫu là: password
-- CHỈ dùng cho local/demo; tuyệt đối không chạy seed này trên production.
-- Nếu lỡ nạp vào production, phải đổi mật khẩu của tất cả tài khoản mẫu ngay.

-- Guard requires psql; the documented psql invocation inherits this environment variable.
\set spring_profiles_active ''
\getenv spring_profiles_active SPRING_PROFILES_ACTIVE
SELECT coalesce(bool_or(lower(btrim(profile)) = 'prod'), false) AS active_prod
FROM regexp_split_to_table(:'spring_profiles_active', ',') AS profiles(profile)
\gset
\if :active_prod
\echo Refusing to load demo seed while SPRING_PROFILES_ACTIVE includes prod.
DO $$ BEGIN RAISE EXCEPTION 'Demo seed is disabled for the prod profile.'; END $$;
\quit
\endif

BEGIN;

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
    ('Áo khoác', 'Áo khoác bomber Essential', 'Đen,Olive', 'M,L,XL', 899000::numeric, 24, 'Phom bomber gọn gàng, dễ phối cùng denim và sneaker cho những ngày thành thị.', 'Nylon chống gió', 699000::numeric, 'https://cdn.hstatic.net/products/1000360022/ao-khoac-bomber-nam-allstar-form-regular_42576155b8f04664a169dc0e71518101_large.jpg', 'BÁN CHẠY', TRUE),
    ('Áo khoác', 'Áo khoác utility Field', 'Be,Xám', 'M,L,XL', 1199000::numeric, 16, 'Thiết kế nhiều túi với tinh thần workwear hiện đại, thực dụng nhưng vẫn nhẹ nhàng.', 'Canvas cotton', NULL, 'https://cdn.hstatic.net/products/1000360022/ao-khoac-phao-nam-waypoint-form-regular__5__bed84fd58f6c4b1db2b4e48cc91e701f_large.jpg', 'MỚI', TRUE),
    ('Áo thun', 'Áo thun Heavyweight Signature', 'Trắng,Đen', 'S,M,L,XL', 399000::numeric, 40, 'Áo thun dày vừa, vai rơi tự nhiên và giữ dáng tốt sau nhiều lần mặc.', 'Cotton 280gsm', 299000::numeric, 'https://product.hstatic.net/1000360022/product/dsc02109_c9ae1601bac24dd19846b47acd42d0ae_large.jpg', 'MỚI', TRUE),
    ('Áo thun', 'Áo thun Graphic Đường phố', 'Xám,Đen', 'S,M,L,XL', 449000::numeric, 30, 'Một điểm nhấn đồ họa tiết chế cho tủ đồ cuối tuần.', 'Cotton compact', NULL, 'https://cdn.hstatic.net/products/1000360022/ao-thun-nam-game-day-form-regular_b61c9fa6ada6443ab45dbe6ec8a1e545_grande.jpg', NULL, FALSE),
    ('Áo polo', 'Polo Knit Tối giản', 'Nâu,Đen', 'M,L,XL', 599000::numeric, 22, 'Cổ dệt tinh tế, bề mặt mềm và thoáng cho những dịp cần chỉn chu hơn.', 'Cotton knit', 499000::numeric, 'https://product.hstatic.net/1000360022/product/id-005381a_cb911ee4f1914356846cadc4e6a2b5cc.jpg', 'ƯU ĐÃI', TRUE),
    ('Áo polo', 'Polo Pique Everyday', 'Trắng,Navy', 'M,L,XL,XXL', 499000::numeric, 27, 'Mẫu polo nền tảng cho cả đi làm và những buổi gặp gỡ nhẹ nhàng.', 'Pique cotton', NULL, 'https://product.hstatic.net/1000360022/product/img_4344_bde7b54eb5914ec4b5e67c176c4be06f_large.jpg', NULL, FALSE),
    ('Quần', 'Quần relaxed denim Nhật', 'Indigo,Đen', '29,30,31,32,33,34', 799000::numeric, 18, 'Ống relaxed thoải mái, wash vừa đủ để mặc đẹp từ sáng đến tối.', 'Denim 12oz', 649000::numeric, 'https://cdn.hstatic.net/products/1000360022/quan-jean-nam-sieu-nhe-ong-suong-indigo-icon105-form-straight_78ccf6d5297a42cd8318e05e9345544f.jpg', 'BÁN CHẠY', TRUE),
    ('Quần', 'Quần tây suông Daily', 'Đen,Xám', '29,30,31,32,33,34', 749000::numeric, 20, 'Đường ly gọn và phom suông cân bằng cho nhịp sống linh hoạt.', 'Tropical wool blend', NULL, 'https://cdn.hstatic.net/products/1000360022/quan-tay-nam-city-straight-form-straight__4__5748074e56b445f58aa001f63e541a33_large.jpg', NULL, FALSE),
    ('Áo khoác', 'Áo khoác dạ dáng dài Urban', 'Nâu,Đen', 'M,L,XL', 1399000::numeric, 14, 'Dáng dạ dài thanh lịch, tạo lớp hoàn thiện gọn gàng cho những ngày se lạnh.', 'Wool blend', 1099000::numeric, 'https://cdn.hstatic.net/products/1000360022/ao-khoac-nam-da-lon-fireside-form-regular__2__2e52cdd8aa9446e99138b79debc2b2ab_large.jpg', 'MỚI', TRUE),
    ('Áo khoác', 'Áo khoác denim Trucker', 'Xanh denim,Đen', 'M,L,XL', 999000::numeric, 19, 'Áo khoác denim kinh điển với phom vừa, dễ kết hợp cùng áo thun và quần kaki.', 'Denim cotton', NULL, 'https://cdn.hstatic.net/products/1000360022/ao-khoac-jeans-nam-skyfold-form-regular_7e741a9897ed4c4e8aa4f27ba6b6f35b_large.jpg', NULL, FALSE),
    ('Áo thun', 'Áo thun Relaxed Premium', 'Kem,Navy', 'S,M,L,XL,XXL', 479000::numeric, 35, 'Bề mặt mềm, phom relaxed thoáng và bảng màu dễ mặc mỗi ngày.', 'Cotton compact 240gsm', 379000::numeric, 'https://product.hstatic.net/1000360022/product/dsc02115_7ba8ed59166a4216b4b740b7cda0058c_large.jpg', 'ƯU ĐÃI', TRUE),
    ('Áo thun', 'Áo thun Essential Airy', 'Trắng,Xám', 'S,M,L,XL', 349000::numeric, 42, 'Thiết kế tối giản, nhẹ và thoáng cho những ngày di chuyển nhiều.', 'Cotton air', NULL, 'https://product.hstatic.net/1000360022/product/dsc02109_c9ae1601bac24dd19846b47acd42d0ae_large.jpg', NULL, FALSE),
    ('Áo polo', 'Polo dệt kim Merino Soft', 'Xám,Nâu', 'M,L,XL', 699000::numeric, 17, 'Bề mặt dệt kim mịn, cổ áo đứng dáng và cảm giác chỉn chu vừa đủ.', 'Cotton merino blend', 579000::numeric, 'https://product.hstatic.net/1000360022/product/dsc06204_c7b1670ba3724a87a8d577e27acd8904_large.jpg', 'MỚI', TRUE),
    ('Áo polo', 'Polo sọc nhỏ Weekend', 'Navy,Trắng', 'M,L,XL,XXL', 549000::numeric, 24, 'Sọc nhỏ tiết chế tạo điểm nhấn nhẹ cho những buổi dạo phố cuối tuần.', 'Pique cotton', NULL, 'https://product.hstatic.net/1000360022/product/dsc06202_ebf8fb42b1014c6e97845f90547ec887_large.jpg', NULL, FALSE),
    ('Quần', 'Quần cargo tapered Flex', 'Olive,Đen', '29,30,31,32,33,34', 849000::numeric, 21, 'Phom tapered linh hoạt, túi hộp gọn và chất vải co giãn nhẹ.', 'Cotton stretch twill', 699000::numeric, 'https://cdn.hstatic.net/products/1000360022/quan-kaki-cargo-icondenim-icdn-tag_5c4bb2e4768d43bb82463cb948760ae5_large.png', 'BÁN CHẠY', TRUE),
    ('Quần', 'Quần short Tech Daily', 'Đen,Xám', 'M,L,XL', 499000::numeric, 29, 'Quần short nhẹ, nhanh khô và đủ gọn cho những ngày vận động trong thành phố.', 'Nylon stretch', NULL, 'https://cdn.hstatic.net/products/1000360022/quan-short-nam-minimal-luxe-form-regular-1_0f55bd47367e4f6481fd7f72f737f9e7_large.jpg', NULL, FALSE)
) AS seed(category_name, name, color, size, price, stock, description, material, sale_price, image_url, badge, featured)
JOIN categories c ON c.name = seed.category_name
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.name = seed.name);

-- Reapply only the catalog photo fields for the seeded products. Match the
-- stable name and exact color list because products do not have a SKU column.
WITH seeded_galleries(category_name, product_name, expected_colors, default_color, color_images) AS (
    VALUES
        ('Áo khoác', 'Áo khoác bomber Essential', 'Đen,Olive', 'Đen', jsonb_build_object(
            'Đen', jsonb_build_array('https://cdn.hstatic.net/products/1000360022/ao-khoac-bomber-nam-allstar-form-regular_42576155b8f04664a169dc0e71518101_large.jpg'),
            'Olive', jsonb_build_array('https://cdn.hstatic.net/products/1000360022/ao-khoac-gio-nam-wind-guard-form-regular__6__97171ef15d96434488a7cc840193961d_large.jpg')
        )),
        ('Áo khoác', 'Áo khoác utility Field', 'Be,Xám', 'Be', jsonb_build_object(
            'Be', jsonb_build_array('https://cdn.hstatic.net/products/1000360022/ao-khoac-phao-nam-waypoint-form-regular__5__bed84fd58f6c4b1db2b4e48cc91e701f_large.jpg'),
            'Xám', jsonb_build_array('https://cdn.hstatic.net/products/1000360022/ao-khoac-gio-nam-wind-guard-form-regular__3__ca3bb5479af34b4d87b21bb2ece1de04_large.jpg')
        )),
        ('Áo thun', 'Áo thun Heavyweight Signature', 'Trắng,Đen', 'Trắng', jsonb_build_object(
            'Trắng', jsonb_build_array('https://product.hstatic.net/1000360022/product/dsc02109_c9ae1601bac24dd19846b47acd42d0ae_large.jpg'),
            'Đen', jsonb_build_array('https://product.hstatic.net/1000360022/product/dsc02105_c146a3f22b774fabbcddff026bf4bf5c_large.jpg')
        )),
        ('Áo thun', 'Áo thun Graphic Đường phố', 'Xám,Đen', 'Xám', jsonb_build_object(
            'Xám', jsonb_build_array('https://cdn.hstatic.net/products/1000360022/ao-thun-nam-game-day-form-regular_b61c9fa6ada6443ab45dbe6ec8a1e545_grande.jpg'),
            'Đen', jsonb_build_array('https://cdn.hstatic.net/products/1000360022/ao-thun-nam-brew-mates-form-boxy__4__2577baee3f6047959475b18ec7b0df92_large.jpg')
        )),
        ('Áo polo', 'Polo Knit Tối giản', 'Nâu,Đen', 'Nâu', jsonb_build_object(
            'Nâu', jsonb_build_array('https://product.hstatic.net/1000360022/product/id-005381a_cb911ee4f1914356846cadc4e6a2b5cc.jpg'),
            'Đen', jsonb_build_array('https://product.hstatic.net/1000360022/product/id-005378a_846077cdc2c34d4ebcd1a79bec0ebbd2.jpg')
        )),
        ('Áo polo', 'Polo Pique Everyday', 'Trắng,Navy', 'Trắng', jsonb_build_object(
            'Trắng', jsonb_build_array('https://product.hstatic.net/1000360022/product/img_4344_bde7b54eb5914ec4b5e67c176c4be06f_large.jpg'),
            'Navy', jsonb_build_array('https://product.hstatic.net/1000360022/product/dsc06202_ebf8fb42b1014c6e97845f90547ec887_large.jpg')
        )),
        ('Quần', 'Quần relaxed denim Nhật', 'Indigo,Đen', 'Indigo', jsonb_build_object(
            'Indigo', jsonb_build_array('https://cdn.hstatic.net/products/1000360022/quan-jean-nam-sieu-nhe-ong-suong-indigo-icon105-form-straight_78ccf6d5297a42cd8318e05e9345544f.jpg'),
            'Đen', jsonb_build_array('https://product.hstatic.net/1000360022/product/anh_sp__qjid0226__doc__585f4729f8b544c19c0b8deeb6161d59_large.jpg')
        )),
        ('Quần', 'Quần tây suông Daily', 'Đen,Xám', 'Đen', jsonb_build_object(
            'Đen', jsonb_build_array('https://cdn.hstatic.net/products/1000360022/quan-tay-nam-city-straight-form-straight__4__5748074e56b445f58aa001f63e541a33_large.jpg'),
            'Xám', jsonb_build_array('https://cdn.hstatic.net/products/1000360022/qt_straight_fabedaf93961461788617ddebe47d586_large.jpg')
        )),
        ('Áo khoác', 'Áo khoác dạ dáng dài Urban', 'Nâu,Đen', 'Nâu', jsonb_build_object(
            'Nâu', jsonb_build_array('https://cdn.hstatic.net/products/1000360022/ao-khoac-nam-da-lon-fireside-form-regular__2__2e52cdd8aa9446e99138b79debc2b2ab_large.jpg'),
            'Đen', jsonb_build_array('https://cdn.hstatic.net/products/1000360022/ao-khoac-bomber-nam-allstar-form-regular_42576155b8f04664a169dc0e71518101_large.jpg')
        )),
        ('Áo khoác', 'Áo khoác denim Trucker', 'Xanh denim,Đen', 'Xanh denim', jsonb_build_object(
            'Xanh denim', jsonb_build_array('https://cdn.hstatic.net/products/1000360022/ao-khoac-jeans-nam-skyfold-form-regular_7e741a9897ed4c4e8aa4f27ba6b6f35b_large.jpg'),
            'Đen', jsonb_build_array('https://cdn.hstatic.net/products/1000360022/ao-khoac-bomber-nam-allstar-form-regular_42576155b8f04664a169dc0e71518101_large.jpg')
        )),
        ('Áo thun', 'Áo thun Relaxed Premium', 'Kem,Navy', 'Kem', jsonb_build_object(
            'Kem', jsonb_build_array('https://product.hstatic.net/1000360022/product/dsc02115_7ba8ed59166a4216b4b740b7cda0058c_large.jpg'),
            'Navy', jsonb_build_array('https://product.hstatic.net/1000360022/product/dsc02112_99e1ce7f36cc417c9ae8686a429fb23c_large.jpg')
        )),
        ('Áo thun', 'Áo thun Essential Airy', 'Trắng,Xám', 'Trắng', jsonb_build_object(
            'Trắng', jsonb_build_array('https://product.hstatic.net/1000360022/product/dsc02109_c9ae1601bac24dd19846b47acd42d0ae_large.jpg'),
            'Xám', jsonb_build_array('https://product.hstatic.net/1000360022/product/dsc02110_0989f404efdf4c36b4e79574c1139cc9_large.jpg')
        )),
        ('Áo polo', 'Polo dệt kim Merino Soft', 'Xám,Nâu', 'Xám', jsonb_build_object(
            'Xám', jsonb_build_array('https://product.hstatic.net/1000360022/product/dsc06204_c7b1670ba3724a87a8d577e27acd8904_large.jpg'),
            'Nâu', jsonb_build_array('https://product.hstatic.net/1000360022/product/id-005381a_cb911ee4f1914356846cadc4e6a2b5cc.jpg')
        )),
        ('Áo polo', 'Polo sọc nhỏ Weekend', 'Navy,Trắng', 'Navy', jsonb_build_object(
            'Navy', jsonb_build_array('https://product.hstatic.net/1000360022/product/dsc06202_ebf8fb42b1014c6e97845f90547ec887_large.jpg'),
            'Trắng', jsonb_build_array('https://product.hstatic.net/1000360022/product/img_4344_bde7b54eb5914ec4b5e67c176c4be06f_large.jpg')
        )),
        ('Quần', 'Quần cargo tapered Flex', 'Olive,Đen', 'Olive', jsonb_build_object(
            'Olive', jsonb_build_array('https://cdn.hstatic.net/products/1000360022/quan-kaki-cargo-icondenim-icdn-tag_5c4bb2e4768d43bb82463cb948760ae5_large.png'),
            'Đen', jsonb_build_array('https://product.hstatic.net/1000360022/product/quan-kaki-cargo-icondenim-icdn-tag__3__0b245c22f7bb47ba86edcff6c5aadcc4_large.jpg')
        )),
        ('Quần', 'Quần short Tech Daily', 'Đen,Xám', 'Đen', jsonb_build_object(
            'Đen', jsonb_build_array('https://cdn.hstatic.net/products/1000360022/quan-short-nam-minimal-luxe-form-regular-1_0f55bd47367e4f6481fd7f72f737f9e7_large.jpg'),
            'Xám', jsonb_build_array('https://cdn.hstatic.net/products/1000360022/quan-short-nam-minimal-luxe-form-regular-06_1b9a47435d4c49878bbbd8c47dfd9121_large.jpg')
        ))
)
UPDATE products AS product
SET image_url = gallery.color_images -> gallery.default_color ->> 0,
    color_images = gallery.color_images
FROM seeded_galleries AS gallery
JOIN categories AS category ON category.name = gallery.category_name
WHERE product.category_id = category.category_id
  AND product.name = gallery.product_name
  AND product.color = gallery.expected_colors;

-- Seed products may be added after the migration's initial stock snapshot.
-- Record their opening sellable balance before demo sales and receipts change it.
INSERT INTO warehouse_finished_stock(product_id, quantity)
SELECT product_id, 0 FROM products
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO inventory_movements(
    item_type, item_id, location, scope_id, quantity_delta, quantity_after,
    movement_type, reference_type, reference_id, actor_id, actor_name, actor_role, created_at
)
SELECT 'PRODUCT', p.product_id, 'SELLABLE', NULL, p.quantity_remaining,
       p.quantity_remaining, 'OPENING', 'SEED_OPENING', p.product_id,
       NULL, 'System (demo seed opening balance)', 'SYSTEM', now()
FROM products p
WHERE NOT EXISTS (
    SELECT 1 FROM inventory_movements m
    WHERE m.item_type = 'PRODUCT'
      AND m.item_id = p.product_id
      AND m.location = 'SELLABLE'
      AND m.movement_type = 'OPENING'
)
ON CONFLICT DO NOTHING;

INSERT INTO customers(email, full_name, phone, preferences, password_hash)
SELECT 'khachhang@example.com', 'Nguyễn Minh Khang', '0900000000', 'Phong cách tối giản, ưu tiên màu trung tính', '$2a$10$5e3JotDKvazJWuvExc/S3.FsD54I6dk65pTa4uk/TjYSt.YfenXmC'
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email = 'khachhang@example.com');

-- Admin login uses the same identity table as the application auth service.
UPDATE customers
SET email = 'admin@shop.com',
    password_hash = '$2a$10$5e3JotDKvazJWuvExc/S3.FsD54I6dk65pTa4uk/TjYSt.YfenXmC',
    role = 'ADMIN',
    locked = FALSE
WHERE email = 'admin@example.com'
  AND role = 'ADMIN';

UPDATE customers
SET full_name = 'Quản trị viên',
    password_hash = '$2a$10$5e3JotDKvazJWuvExc/S3.FsD54I6dk65pTa4uk/TjYSt.YfenXmC',
    role = 'ADMIN',
    locked = FALSE,
    lock_reason = NULL,
    deleted_at = NULL
WHERE lower(email) = 'admin@shop.com';

INSERT INTO customers(email, full_name, phone, preferences, password_hash, role)
SELECT 'admin@shop.com', 'Quản trị viên', NULL, NULL, '$2a$10$5e3JotDKvazJWuvExc/S3.FsD54I6dk65pTa4uk/TjYSt.YfenXmC', 'ADMIN'
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email = 'admin@shop.com');

-- Internal and employee test accounts: password is "password" (local/demo only).
-- This BCrypt hash was checked with Spring BCryptPasswordEncoder.
WITH demo_accounts(email, full_name, role) AS (
    VALUES
        ('manager.hr@shop.com', 'Quản lý nhân sự', 'MANAGER_HR'),
        ('manager.sales@shop.com', 'Quản lý bán hàng', 'MANAGER_SALES'),
        ('manager.warehouse@shop.com', 'Quản lý kho', 'MANAGER_WAREHOUSE'),
        ('qlnhansu@shop.com', 'Quản lý nhân sự', 'MANAGER_HR'),
        ('employee.directory@shop.com', 'Nhân viên tổng hợp', 'EMPLOYEE'),
        ('nvbh01@shop.com', 'Nhân viên bán hàng 01', 'EMPLOYEE'),
        ('nvbh02@shop.com', 'Nhân viên bán hàng 02', 'EMPLOYEE'),
        ('nvbh03@shop.com', 'Nhân viên bán hàng 03', 'EMPLOYEE'),
        ('nvkho01@shop.com', 'Nhân viên kho 01', 'EMPLOYEE'),
        ('nvkho02@shop.com', 'Nhân viên kho 02', 'EMPLOYEE'),
        ('nvkho03@shop.com', 'Nhân viên kho 03', 'EMPLOYEE')
)
UPDATE customers AS account
SET full_name = demo.full_name,
    password_hash = '$2a$10$5e3JotDKvazJWuvExc/S3.FsD54I6dk65pTa4uk/TjYSt.YfenXmC',
    role = demo.role,
    locked = FALSE,
    lock_reason = NULL,
    deleted_at = NULL
FROM demo_accounts AS demo
WHERE lower(account.email) = demo.email;

INSERT INTO customers(email, full_name, password_hash, role)
SELECT demo.email,
       demo.full_name,
       '$2a$10$5e3JotDKvazJWuvExc/S3.FsD54I6dk65pTa4uk/TjYSt.YfenXmC',
       demo.role
FROM (VALUES
    ('manager.hr@shop.com', 'Quản lý nhân sự', 'MANAGER_HR'),
    ('manager.sales@shop.com', 'Quản lý bán hàng', 'MANAGER_SALES'),
    ('manager.warehouse@shop.com', 'Quản lý kho', 'MANAGER_WAREHOUSE'),
    ('qlnhansu@shop.com', 'Quản lý nhân sự', 'MANAGER_HR'),
    ('employee.directory@shop.com', 'Nhân viên tổng hợp', 'EMPLOYEE'),
    ('nvbh01@shop.com', 'Nhân viên bán hàng 01', 'EMPLOYEE'),
    ('nvbh02@shop.com', 'Nhân viên bán hàng 02', 'EMPLOYEE'),
    ('nvbh03@shop.com', 'Nhân viên bán hàng 03', 'EMPLOYEE'),
    ('nvkho01@shop.com', 'Nhân viên kho 01', 'EMPLOYEE'),
    ('nvkho02@shop.com', 'Nhân viên kho 02', 'EMPLOYEE'),
    ('nvkho03@shop.com', 'Nhân viên kho 03', 'EMPLOYEE')
) AS demo(email, full_name, role)
WHERE NOT EXISTS (
    SELECT 1 FROM customers AS account WHERE lower(account.email) = demo.email
);

INSERT INTO employee_profiles(
    employee_id, employee_code, education_level, job_title, permission_profile,
    work_area, hire_date, monthly_base_salary, insurance_salary_base
)
SELECT account.customer_id,
       demo.employee_code,
       demo.education_level,
       demo.job_title,
       demo.permission_profile,
       demo.work_area,
       (current_date - demo.tenure_years * INTERVAL '1 year')::date,
       demo.monthly_base_salary,
       demo.insurance_salary_base
FROM customers AS account
JOIN (VALUES
    ('qlnhansu@shop.com', 'HR-001', 'Đại học', 'Quản lý nhân sự', 'STAFF', 'GENERAL', 3, 15000000, 15000000),
    ('employee.directory@shop.com', 'EMP-001', 'Cao đẳng', 'Nhân viên tổng hợp', 'STAFF', 'GENERAL', 2, 7500000, 7500000),
    ('nvbh01@shop.com', 'SALES-001', 'Cao đẳng', 'Nhân viên bán hàng', 'TEAM_LEAD', 'SALES', 3, 9500000, 9500000),
    ('nvbh02@shop.com', 'SALES-002', 'Trung cấp', 'Nhân viên bán hàng', 'STAFF', 'SALES', 2, 8500000, 8500000),
    ('nvbh03@shop.com', 'SALES-003', 'Trung cấp', 'Nhân viên bán hàng', 'STAFF', 'SALES', 1, 8500000, 8500000),
    ('nvkho01@shop.com', 'WAREHOUSE-001', 'Cao đẳng', 'Nhân viên kho', 'TEAM_LEAD', 'WAREHOUSE', 4, 10000000, 10000000),
    ('nvkho02@shop.com', 'WAREHOUSE-002', 'Trung cấp', 'Nhân viên kho', 'STAFF', 'WAREHOUSE', 2, 9000000, 9000000),
    ('nvkho03@shop.com', 'WAREHOUSE-003', 'Trung cấp', 'Nhân viên kho', 'STAFF', 'WAREHOUSE', 1, 9000000, 9000000)
) AS demo(email, employee_code, education_level, job_title, permission_profile, work_area, tenure_years, monthly_base_salary, insurance_salary_base)
  ON lower(account.email) = demo.email
ON CONFLICT (employee_id) DO UPDATE
SET employee_code = EXCLUDED.employee_code,
    education_level = EXCLUDED.education_level,
    job_title = EXCLUDED.job_title,
    permission_profile = EXCLUDED.permission_profile,
    work_area = EXCLUDED.work_area,
    hire_date = EXCLUDED.hire_date,
    monthly_base_salary = EXCLUDED.monthly_base_salary,
    insurance_salary_base = EXCLUDED.insurance_salary_base;

UPDATE employee_profiles AS subordinate
SET reports_to_employee_id = lead.employee_id
FROM employee_profiles AS lead
JOIN customers AS lead_account ON lead_account.customer_id = lead.employee_id
WHERE lead_account.email IN ('nvbh01@shop.com', 'nvkho01@shop.com')
  AND subordinate.employee_code IN ('SALES-002', 'SALES-003', 'WAREHOUSE-002', 'WAREHOUSE-003')
  AND ((subordinate.employee_code LIKE 'SALES-%' AND lead_account.email = 'nvbh01@shop.com')
    OR (subordinate.employee_code LIKE 'WAREHOUSE-%' AND lead_account.email = 'nvkho01@shop.com'));

UPDATE customers
SET password_hash = '$2a$10$5e3JotDKvazJWuvExc/S3.FsD54I6dk65pTa4uk/TjYSt.YfenXmC',
    locked = FALSE,
    lock_reason = NULL,
    deleted_at = NULL
WHERE lower(email) = 'khachhang@example.com';

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

-- One campaign demonstrates product, invoice and voucher rule groups.
INSERT INTO promotion_campaigns(campaign_code, name, start_date, end_date)
SELECT 'DEMO-CTKM-01', 'Ưu đãi khách hàng tháng này', date_trunc('month', current_date)::date,
       (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date
WHERE NOT EXISTS (SELECT 1 FROM promotion_campaigns WHERE campaign_code = 'DEMO-CTKM-01');

INSERT INTO promotion_product_rules(campaign_id, product_id, discount_percent)
SELECT campaign.id, product.product_id, 10
FROM promotion_campaigns campaign
JOIN products product ON product.name = 'Polo Pique Everyday'
WHERE campaign.campaign_code = 'DEMO-CTKM-01'
ON CONFLICT (campaign_id, product_id) DO NOTHING;

INSERT INTO promotion_invoice_rules(campaign_id, minimum_invoice_amount, discount_percent)
SELECT id, 1000000, 5
FROM promotion_campaigns
WHERE campaign_code = 'DEMO-CTKM-01'
ON CONFLICT (campaign_id, minimum_invoice_amount) DO NOTHING;

INSERT INTO promotion_voucher_rules(campaign_id, voucher_id, discount_percent)
SELECT campaign.id, voucher.id, 10
FROM promotion_campaigns campaign
CROSS JOIN store_vouchers voucher
WHERE campaign.campaign_code = 'DEMO-CTKM-01'
  AND voucher.code = 'ANHLON10'
ON CONFLICT (campaign_id, voucher_id) DO NOTHING;

-- Default address for the sample customer.
INSERT INTO customer_addresses(
    customer_id, label, recipient_name, phone, address_line, ward, district, province, default_address
)
SELECT customer.customer_id, 'Nhà riêng', customer.full_name, '0900000000',
       '12 Nguyễn Văn Bảo', 'Phường 4', 'Gò Vấp', 'TP. Hồ Chí Minh', TRUE
FROM customers customer
WHERE customer.email = 'khachhang@example.com'
  AND NOT EXISTS (
      SELECT 1 FROM customer_addresses address
      WHERE address.customer_id = customer.customer_id AND address.label = 'Nhà riêng'
  );

-- Sample orders include delivered COD sales and one waiting COD order.
INSERT INTO orders(
    customer_id, order_code, total_amount, discount_amount, shipping_fee, created_at, updated_at,
    status, payment_status, payment_method, delivery_address, stock_released,
    cod_collected_at, cod_collected_amount, cod_collected_by, cod_collection_note
)
SELECT customer.customer_id, demo.order_code, demo.total_amount, 0, demo.shipping_fee,
       demo.created_at, now(), demo.status, 'COD', 'COD',
       '12 Nguyễn Văn Bảo, Phường 4, Gò Vấp, TP. Hồ Chí Minh', FALSE,
       demo.cod_collected_at, demo.cod_collected_amount, manager.customer_id, demo.cod_collection_note
FROM customers customer
CROSS JOIN customers manager
CROSS JOIN (VALUES
    (990000000001::bigint, 499000::numeric, 0::numeric, 'DELIVERED', now() - interval '2 hours', now() - interval '1 hour', 499000::numeric, 'Đã thu COD - dữ liệu demo'),
    (990000000002::bigint, 379000::numeric, 30000::numeric, 'DELIVERED', now() - interval '1 hour', now() - interval '30 minutes', 379000::numeric, 'Đã thu COD - dữ liệu demo'),
    (990000000003::bigint, 329000::numeric, 30000::numeric, 'PENDING', now(), NULL::timestamptz, NULL::numeric, NULL::text)
) AS demo(order_code, total_amount, shipping_fee, status, created_at, cod_collected_at, cod_collected_amount, cod_collection_note)
WHERE customer.email = 'khachhang@example.com'
  AND manager.email = 'manager.sales@shop.com'
  AND NOT EXISTS (SELECT 1 FROM orders existing WHERE existing.order_code = demo.order_code);

INSERT INTO order_items(order_id, product_id, quantity, unit_price, size, color)
SELECT orders.order_id, product.product_id, demo.quantity, demo.unit_price, demo.size, demo.color
FROM (VALUES
    (990000000001::bigint, 'Polo Pique Everyday', 1, 499000::numeric, 'L', 'Trắng'),
    (990000000002::bigint, 'Áo thun Essential Airy', 1, 349000::numeric, 'M', 'Trắng'),
    (990000000003::bigint, 'Áo thun Heavyweight Signature', 1, 299000::numeric, 'L', 'Đen')
) AS demo(order_code, product_name, quantity, unit_price, size, color)
JOIN orders ON orders.order_code = demo.order_code
JOIN products product ON product.name = demo.product_name
WHERE NOT EXISTS (
    SELECT 1 FROM order_items existing
    WHERE existing.order_id = orders.order_id
      AND existing.product_id = product.product_id
      AND coalesce(existing.size, '') = demo.size
      AND coalesce(existing.color, '') = demo.color
);

-- The seed orders reduce sellable stock and write to the append-only inventory ledger.
WITH seeded_sales AS (
    SELECT orders.order_id, item.product_id, sum(item.quantity)::integer AS quantity
    FROM orders
    JOIN order_items item ON item.order_id = orders.order_id
    WHERE orders.order_code IN (990000000001, 990000000002, 990000000003)
      AND NOT EXISTS (
          SELECT 1 FROM inventory_movements movement
          WHERE movement.movement_type = 'SALE_RESERVATION'
            AND movement.reference_type = 'SEED_ORDER'
            AND movement.reference_id = orders.order_id
            AND movement.item_type = 'PRODUCT'
            AND movement.item_id = item.product_id
            AND movement.location = 'SELLABLE'
      )
    GROUP BY orders.order_id, item.product_id
), updated_products AS (
    UPDATE products product
    SET quantity_remaining = product.quantity_remaining - sale.quantity,
        updated_at = now()
    FROM seeded_sales sale
    WHERE product.product_id = sale.product_id
      AND product.quantity_remaining >= sale.quantity
    RETURNING product.product_id, sale.order_id, sale.quantity, product.quantity_remaining
)
INSERT INTO inventory_movements(
    item_type, item_id, location, scope_id, quantity_delta, quantity_after,
    movement_type, reference_type, reference_id, actor_id, actor_name, actor_role, created_at
)
SELECT 'PRODUCT', updated.product_id, 'SELLABLE', NULL, -updated.quantity,
       updated.quantity_remaining, 'SALE_RESERVATION', 'SEED_ORDER', updated.order_id,
       customer.customer_id, customer.full_name, customer.role, now()
FROM updated_products updated
JOIN orders ON orders.order_id = updated.order_id
JOIN customers customer ON customer.customer_id = orders.customer_id
ON CONFLICT DO NOTHING;

INSERT INTO feedback(customer_id, product_id, order_id, content, rating, status, hidden, created_at)
SELECT customer.customer_id, product.product_id, orders.order_id,
       'Sản phẩm đúng mô tả, chất liệu mặc thoải mái. (Đánh giá demo)', 5, 'APPROVED', FALSE, now()
FROM customers customer
JOIN orders ON orders.order_code = 990000000001 AND orders.customer_id = customer.customer_id
JOIN products product ON product.name = 'Polo Pique Everyday'
WHERE customer.email = 'khachhang@example.com'
  AND NOT EXISTS (
      SELECT 1 FROM feedback existing
      WHERE existing.order_id = orders.order_id AND existing.product_id = product.product_id
  );

INSERT INTO survey_responses(customer_id, survey_id)
SELECT customer.customer_id, survey.id
FROM customers customer
CROSS JOIN survey_definitions survey
WHERE customer.email = 'khachhang@example.com'
  AND survey.title = 'Gu thời trang của bạn'
  AND NOT EXISTS (
      SELECT 1 FROM survey_responses existing
      WHERE existing.customer_id = customer.customer_id AND existing.survey_id = survey.id
  )
ON CONFLICT (customer_id, survey_id) DO NOTHING;

INSERT INTO survey_answers(response_id, question_id, answer)
SELECT response.id, question.id,
       CASE question.display_order WHEN 0 THEN 'Tối giản' ELSE 'Navy' END
FROM survey_responses response
JOIN customers customer ON customer.customer_id = response.customer_id
JOIN survey_definitions survey ON survey.id = response.survey_id
JOIN survey_questions question ON question.survey_id = survey.id
WHERE customer.email = 'khachhang@example.com'
  AND survey.title = 'Gu thời trang của bạn'
  AND NOT EXISTS (
      SELECT 1 FROM survey_answers existing
      WHERE existing.response_id = response.id AND existing.question_id = question.id
  );

INSERT INTO wishlists(customer_id, product_id)
SELECT customer.customer_id, product.product_id
FROM customers customer
CROSS JOIN products product
WHERE customer.email = 'khachhang@example.com'
  AND product.name = 'Áo khoác utility Field'
ON CONFLICT (customer_id, product_id) DO NOTHING;

INSERT INTO cart_items(customer_id, product_id, quantity, size, color)
SELECT customer.customer_id, product.product_id, 1, 'L', 'Đen'
FROM customers customer
CROSS JOIN products product
WHERE customer.email = 'khachhang@example.com'
  AND product.name = 'Áo thun Heavyweight Signature'
  AND NOT EXISTS (
      SELECT 1 FROM cart_items existing
      WHERE existing.customer_id = customer.customer_id
        AND existing.product_id = product.product_id
        AND coalesce(existing.size, '') = 'L'
        AND coalesce(existing.color, '') = 'Đen'
  );

INSERT INTO customer_notifications(customer_id, title, content, type, order_id, created_at)
SELECT orders.customer_id, 'Đơn hàng đã giao', 'Đơn hàng mẫu đã được giao thành công.', 'ORDER', orders.order_id, now()
FROM orders
WHERE orders.order_code = 990000000001
  AND NOT EXISTS (
      SELECT 1 FROM customer_notifications existing
      WHERE existing.customer_id = orders.customer_id
        AND existing.order_id = orders.order_id
        AND existing.title = 'Đơn hàng đã giao'
  );

-- Product receipt: update sellable stock once and record a ledger movement.
INSERT INTO stock_receipts(receipt_code, supplier_id, supplier_code, supplier_name, received_at, status, total_cost, note, created_by)
SELECT 'PNH-DEMO-001', supplier.id, supplier.code, supplier.name, now(), 'POSTED', 6600000,
       'Phiếu nhập sản phẩm mẫu để kiểm thử.', manager.customer_id
FROM suppliers supplier
CROSS JOIN customers manager
WHERE supplier.code = 'NCC-COTTON-TL'
  AND manager.email = 'manager.warehouse@shop.com'
  AND NOT EXISTS (SELECT 1 FROM stock_receipts existing WHERE existing.receipt_code = 'PNH-DEMO-001');

INSERT INTO stock_receipt_items(receipt_id, product_id, product_name, quantity, unit_cost, line_total)
SELECT receipt.id, product.product_id, product.name, demo.quantity, demo.unit_cost, demo.line_total
FROM stock_receipts receipt
JOIN (VALUES
    ('Polo Pique Everyday', 10, 300000::numeric, 3000000::numeric),
    ('Áo thun Essential Airy', 20, 180000::numeric, 3600000::numeric)
) AS demo(product_name, quantity, unit_cost, line_total) ON TRUE
JOIN products product ON product.name = demo.product_name
WHERE receipt.receipt_code = 'PNH-DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM stock_receipt_items existing
      WHERE existing.receipt_id = receipt.id AND existing.product_id = product.product_id
  );

WITH receipt_items AS (
    SELECT receipt.id AS receipt_id, item.product_id, item.quantity
    FROM stock_receipts receipt
    JOIN stock_receipt_items item ON item.receipt_id = receipt.id
    WHERE receipt.receipt_code = 'PNH-DEMO-001'
      AND NOT EXISTS (
          SELECT 1 FROM inventory_movements movement
          WHERE movement.movement_type = 'PRODUCT_RECEIPT'
            AND movement.reference_type = 'STOCK_RECEIPT'
            AND movement.reference_id = receipt.id
            AND movement.item_type = 'PRODUCT'
            AND movement.item_id = item.product_id
            AND movement.location = 'SELLABLE'
      )
), updated_products AS (
    UPDATE products product
    SET quantity_remaining = product.quantity_remaining + receipt_items.quantity,
        updated_at = now()
    FROM receipt_items
    WHERE product.product_id = receipt_items.product_id
    RETURNING product.product_id, receipt_items.receipt_id, receipt_items.quantity, product.quantity_remaining
)
INSERT INTO inventory_movements(
    item_type, item_id, location, scope_id, quantity_delta, quantity_after,
    movement_type, reference_type, reference_id, actor_id, actor_name, actor_role, created_at
)
SELECT 'PRODUCT', updated.product_id, 'SELLABLE', NULL, updated.quantity,
       updated.quantity_remaining, 'PRODUCT_RECEIPT', 'STOCK_RECEIPT', updated.receipt_id,
       manager.customer_id, manager.full_name, manager.role, receipt.received_at
FROM updated_products updated
JOIN stock_receipts receipt ON receipt.id = updated.receipt_id
CROSS JOIN customers manager
WHERE manager.email = 'manager.warehouse@shop.com'
ON CONFLICT DO NOTHING;

-- Raw-material receipt and opening supply for warehouse production tasks.
INSERT INTO raw_materials(code, name, unit, available_quantity, active)
SELECT material.code, material.name, material.unit, 0, TRUE
FROM (VALUES
    ('VAI-COTTON', 'Vải cotton pique', 'm'),
    ('VAI-DENIM', 'Vải denim', 'm'),
    ('NUT-CO', 'Nút áo 4 lỗ', 'cái')
) AS material(code, name, unit)
WHERE NOT EXISTS (SELECT 1 FROM raw_materials existing WHERE upper(existing.code) = upper(material.code));

INSERT INTO raw_material_receipts(receipt_code, supplier_id, supplier_code, supplier_name, received_at, status, total_cost, note, created_by)
SELECT 'NVL-DEMO-001', supplier.id, supplier.code, supplier.name, now(), 'POSTED', 9500000,
       'Phiếu nhập nguyên liệu mẫu để kiểm thử.', manager.customer_id
FROM suppliers supplier
CROSS JOIN customers manager
WHERE supplier.code = 'NCC-COTTON-TL'
  AND manager.email = 'manager.warehouse@shop.com'
  AND NOT EXISTS (SELECT 1 FROM raw_material_receipts existing WHERE existing.receipt_code = 'NVL-DEMO-001');

INSERT INTO raw_material_receipt_items(receipt_id, material_id, material_code, material_name, unit, quantity, unit_cost, line_total)
SELECT receipt.id, material.id, material.code, material.name, material.unit,
       demo.quantity, demo.unit_cost, demo.line_total
FROM raw_material_receipts receipt
JOIN (VALUES
    ('VAI-COTTON', 100::numeric, 50000::numeric, 5000000::numeric),
    ('VAI-DENIM', 80::numeric, 50000::numeric, 4000000::numeric),
    ('NUT-CO', 500::numeric, 1000::numeric, 500000::numeric)
) AS demo(material_code, quantity, unit_cost, line_total) ON TRUE
JOIN raw_materials material ON upper(material.code) = upper(demo.material_code)
WHERE receipt.receipt_code = 'NVL-DEMO-001'
ON CONFLICT (receipt_id, material_id) DO NOTHING;

WITH receipt_items AS (
    SELECT receipt.id AS receipt_id, item.material_id, item.quantity
    FROM raw_material_receipts receipt
    JOIN raw_material_receipt_items item ON item.receipt_id = receipt.id
    WHERE receipt.receipt_code = 'NVL-DEMO-001'
      AND NOT EXISTS (
          SELECT 1 FROM inventory_movements movement
          WHERE movement.movement_type = 'RAW_MATERIAL_RECEIPT'
            AND movement.reference_type = 'RAW_MATERIAL_RECEIPT'
            AND movement.reference_id = receipt.id
            AND movement.item_type = 'MATERIAL'
            AND movement.item_id = item.material_id
            AND movement.location = 'RAW_MATERIAL_AVAILABLE'
      )
), updated_materials AS (
    UPDATE raw_materials material
    SET available_quantity = material.available_quantity + receipt_items.quantity,
        updated_at = now()
    FROM receipt_items
    WHERE material.id = receipt_items.material_id
    RETURNING material.id, receipt_items.receipt_id, receipt_items.quantity, material.available_quantity
)
INSERT INTO inventory_movements(
    item_type, item_id, location, scope_id, quantity_delta, quantity_after,
    movement_type, reference_type, reference_id, actor_id, actor_name, actor_role, created_at
)
SELECT 'MATERIAL', updated.id, 'RAW_MATERIAL_AVAILABLE', NULL, updated.quantity,
       updated.available_quantity, 'RAW_MATERIAL_RECEIPT', 'RAW_MATERIAL_RECEIPT', updated.receipt_id,
       manager.customer_id, manager.full_name, manager.role, receipt.received_at
FROM updated_materials updated
JOIN raw_material_receipts receipt ON receipt.id = updated.receipt_id
CROSS JOIN customers manager
WHERE manager.email = 'manager.warehouse@shop.com'
ON CONFLICT DO NOTHING;

-- A recipe, a planned production task and requests waiting for approval.
INSERT INTO product_recipes(product_id, version, active, created_by)
SELECT product.product_id, 1, TRUE, manager.customer_id
FROM products product
CROSS JOIN customers manager
WHERE product.name = 'Polo Pique Everyday'
  AND manager.email = 'manager.warehouse@shop.com'
  AND NOT EXISTS (
      SELECT 1 FROM product_recipes existing
      WHERE existing.product_id = product.product_id AND existing.version = 1
  );

INSERT INTO product_recipe_items(recipe_id, material_id, material_code, material_name, unit, quantity_per_product)
SELECT recipe.id, material.id, material.code, material.name, material.unit, demo.quantity_per_product
FROM product_recipes recipe
JOIN products product ON product.product_id = recipe.product_id AND product.name = 'Polo Pique Everyday'
JOIN (VALUES ('VAI-COTTON', 1.200::numeric), ('NUT-CO', 2.000::numeric)) AS demo(material_code, quantity_per_product) ON TRUE
JOIN raw_materials material ON upper(material.code) = upper(demo.material_code)
WHERE recipe.version = 1
ON CONFLICT (recipe_id, material_id) DO NOTHING;

INSERT INTO production_plans(plan_code, product_id, recipe_id, target_quantity, completed_quantity, assigned_employee_id, due_date, status, note, created_by)
SELECT 'PP-DEMO-001', product.product_id, recipe.id, 20, 0, employee.employee_id,
       current_date + 7, 'PLANNED', 'Kế hoạch may áo polo mẫu để kiểm thử.', manager.customer_id
FROM products product
JOIN product_recipes recipe ON recipe.product_id = product.product_id AND recipe.version = 1
JOIN customers employee_account ON employee_account.email = 'nvkho01@shop.com'
JOIN employee_profiles employee ON employee.employee_id = employee_account.customer_id
CROSS JOIN customers manager
WHERE product.name = 'Polo Pique Everyday'
  AND manager.email = 'manager.warehouse@shop.com'
  AND NOT EXISTS (SELECT 1 FROM production_plans existing WHERE existing.plan_code = 'PP-DEMO-001');

INSERT INTO production_plan_materials(plan_id, material_id, material_code, material_name, unit, quantity_per_product, required_quantity)
SELECT plan.id, recipe_item.material_id, recipe_item.material_code, recipe_item.material_name,
       recipe_item.unit, recipe_item.quantity_per_product,
       recipe_item.quantity_per_product * plan.target_quantity
FROM production_plans plan
JOIN product_recipe_items recipe_item ON recipe_item.recipe_id = plan.recipe_id
WHERE plan.plan_code = 'PP-DEMO-001'
ON CONFLICT (plan_id, material_id) DO NOTHING;

INSERT INTO material_issue_requests(request_code, plan_id, employee_id, status, employee_note)
SELECT 'MI-DEMO-001', plan.id, plan.assigned_employee_id, 'PENDING',
       'Đề nghị cấp nguyên liệu cho kế hoạch may áo polo mẫu.'
FROM production_plans plan
WHERE plan.plan_code = 'PP-DEMO-001'
  AND NOT EXISTS (SELECT 1 FROM material_issue_requests existing WHERE existing.request_code = 'MI-DEMO-001');

INSERT INTO material_issue_request_items(request_id, plan_material_id, quantity)
SELECT request.id, plan_material.id, plan_material.required_quantity
FROM material_issue_requests request
JOIN production_plans plan ON plan.id = request.plan_id
JOIN production_plan_materials plan_material ON plan_material.plan_id = plan.id
WHERE request.request_code = 'MI-DEMO-001'
ON CONFLICT (request_id, plan_material_id) DO NOTHING;

-- Finished stock enables the employee request to be reviewed in the Manager portal.
UPDATE warehouse_finished_stock stock
SET quantity = 12, updated_at = now()
FROM products product
WHERE product.product_id = stock.product_id
  AND product.name = 'Polo Pique Everyday'
  AND stock.quantity = 0
  AND NOT EXISTS (
      SELECT 1 FROM inventory_movements movement
      WHERE movement.item_type = 'PRODUCT'
        AND movement.item_id = stock.product_id
        AND movement.location = 'FINISHED_WAREHOUSE'
  );

INSERT INTO inventory_movements(
    item_type, item_id, location, scope_id, quantity_delta, quantity_after,
    movement_type, reference_type, reference_id, actor_id, actor_name, actor_role
)
SELECT 'PRODUCT', stock.product_id, 'FINISHED_WAREHOUSE', NULL, stock.quantity,
       stock.quantity, 'OPENING', 'SEED_FINISHED_STOCK', stock.product_id,
       NULL, 'System (demo finished-stock opening)', 'SYSTEM'
FROM warehouse_finished_stock stock
JOIN products product ON product.product_id = stock.product_id
WHERE product.name = 'Polo Pique Everyday'
  AND stock.quantity > 0
  AND NOT EXISTS (
      SELECT 1 FROM inventory_movements movement
      WHERE movement.item_type = 'PRODUCT'
        AND movement.item_id = stock.product_id
        AND movement.location = 'FINISHED_WAREHOUSE'
  )
ON CONFLICT DO NOTHING;

INSERT INTO finished_goods_issue_requests(request_code, employee_id, status, employee_note)
SELECT 'FG-DEMO-001', employee.employee_id, 'PENDING',
       'Đề nghị chuyển 5 áo polo thành phẩm sang tồn bán để kiểm thử.'
FROM customers employee_account
JOIN employee_profiles employee ON employee.employee_id = employee_account.customer_id
WHERE employee_account.email = 'nvkho02@shop.com'
  AND NOT EXISTS (
      SELECT 1 FROM finished_goods_issue_requests existing WHERE existing.request_code = 'FG-DEMO-001'
  );

INSERT INTO finished_goods_issue_request_items(request_id, product_id, product_name, quantity)
SELECT request.id, product.product_id, product.name, 5
FROM finished_goods_issue_requests request
CROSS JOIN products product
WHERE request.request_code = 'FG-DEMO-001'
  AND product.name = 'Polo Pique Everyday'
ON CONFLICT (request_id, product_id) DO NOTHING;

-- HR demo attendance, leave requests and a published previous-month payslip.
INSERT INTO employee_attendance(employee_id, attendance_date, attendance_status, day_fraction, paid_equivalent_days, note, recorded_by)
SELECT employee.employee_id, current_date - 1, demo.attendance_status, 1,
       CASE WHEN demo.attendance_status = 'UNPAID_LEAVE' THEN 0 ELSE 1 END,
       'Bản ghi chấm công mẫu.', hr.customer_id
FROM (VALUES
    ('employee.directory@shop.com', 'WORKED'),
    ('nvbh01@shop.com', 'WORKED'),
    ('nvbh02@shop.com', 'PAID_LEAVE'),
    ('nvbh03@shop.com', 'WORKED'),
    ('nvkho01@shop.com', 'WORKED'),
    ('nvkho02@shop.com', 'SICK_LEAVE'),
    ('nvkho03@shop.com', 'WORKED')
) AS demo(email, attendance_status)
JOIN customers account ON account.email = demo.email
JOIN employee_profiles employee ON employee.employee_id = account.customer_id
CROSS JOIN customers hr
WHERE hr.email = 'qlnhansu@shop.com'
ON CONFLICT (employee_id, attendance_date) DO NOTHING;

INSERT INTO employee_leave_requests(employee_id, request_type, start_date, end_date, employee_note, status)
SELECT employee.employee_id, 'ANNUAL', current_date + 3, current_date + 4,
       'Đơn xin nghỉ phép mẫu đang chờ HR duyệt.', 'PENDING'
FROM customers account
JOIN employee_profiles employee ON employee.employee_id = account.customer_id
WHERE account.email = 'nvbh02@shop.com'
  AND NOT EXISTS (
      SELECT 1 FROM employee_leave_requests existing
      WHERE existing.employee_id = employee.employee_id
        AND existing.employee_note = 'Đơn xin nghỉ phép mẫu đang chờ HR duyệt.'
  );

INSERT INTO employee_leave_requests(employee_id, request_type, start_date, end_date, employee_note, status, reviewed_by, reviewed_at, reviewer_note)
SELECT employee.employee_id, 'SICK', current_date - 14, current_date - 14,
       'Đơn nghỉ ốm mẫu đã được HR duyệt.', 'APPROVED', hr.customer_id, now(), 'Dữ liệu mẫu.'
FROM customers account
JOIN employee_profiles employee ON employee.employee_id = account.customer_id
CROSS JOIN customers hr
WHERE account.email = 'nvkho02@shop.com'
  AND hr.email = 'qlnhansu@shop.com'
  AND NOT EXISTS (
      SELECT 1 FROM employee_leave_requests existing
      WHERE existing.employee_id = employee.employee_id
        AND existing.employee_note = 'Đơn nghỉ ốm mẫu đã được HR duyệt.'
  );

WITH previous_period AS (
    SELECT (date_trunc('month', current_date) - interval '1 month')::date AS period_start
)
INSERT INTO employee_payroll_periods(
    period_year, period_month, standard_paid_workdays, status,
    created_by, reviewed_by, published_by, reviewed_at, published_at
)
SELECT extract(year FROM period_start)::integer, extract(month FROM period_start)::integer,
       22, 'PUBLISHED', hr.customer_id, hr.customer_id, hr.customer_id, now(), now()
FROM previous_period
CROSS JOIN customers hr
WHERE hr.email = 'qlnhansu@shop.com'
  AND NOT EXISTS (
      SELECT 1 FROM employee_payroll_periods existing
      WHERE existing.period_year = extract(year FROM period_start)::integer
        AND existing.period_month = extract(month FROM period_start)::integer
  );

WITH previous_period AS (
    SELECT (date_trunc('month', current_date) - interval '1 month')::date AS period_start
)
INSERT INTO employee_payslips(
    payroll_period_id, employee_id, revision, status, contracted_monthly_salary,
    insurance_salary_base, paid_equivalent_days, gross_earnings, separate_benefits,
    employee_deductions, employer_contributions, take_home_pay, source_snapshot, published_at
)
SELECT period.id, employee.employee_id, 1, 'PUBLISHED', employee.monthly_base_salary,
       employee.insurance_salary_base, 22, employee.monthly_base_salary, 0,
       0, 0, employee.monthly_base_salary,
       jsonb_build_object('demo', TRUE, 'note', 'Seed demo; payroll rates are not inferred.'), now()
FROM employee_payroll_periods period
CROSS JOIN previous_period
JOIN employee_profiles employee ON TRUE
JOIN customers account ON account.customer_id = employee.employee_id AND account.role = 'EMPLOYEE'
WHERE period.period_year = extract(year FROM previous_period.period_start)::integer
  AND period.period_month = extract(month FROM previous_period.period_start)::integer
  AND account.email IN (
      'employee.directory@shop.com', 'nvbh01@shop.com', 'nvbh02@shop.com', 'nvbh03@shop.com',
      'nvkho01@shop.com', 'nvkho02@shop.com', 'nvkho03@shop.com'
  )
  AND NOT EXISTS (
      SELECT 1 FROM employee_payslips existing
      WHERE existing.employee_id = employee.employee_id
        AND existing.payroll_period_id = period.id
        AND existing.revision = 1
  );

INSERT INTO employee_payroll_lines(payslip_id, line_type, code, description, quantity, rate, amount, display_order)
SELECT payslip.id, 'EARNING', 'BASE_SALARY', 'Lương cơ bản tháng (demo)', 22,
       payslip.gross_earnings / 22, payslip.gross_earnings, 1
FROM employee_payslips payslip
JOIN employee_payroll_periods period ON period.id = payslip.payroll_period_id
WHERE payslip.status = 'PUBLISHED'
  AND payslip.revision = 1
  AND period.period_year = extract(year FROM date_trunc('month', current_date) - interval '1 month')::integer
  AND period.period_month = extract(month FROM date_trunc('month', current_date) - interval '1 month')::integer
  AND NOT EXISTS (
      SELECT 1 FROM employee_payroll_lines existing
      WHERE existing.payslip_id = payslip.id AND existing.code = 'BASE_SALARY'
  );

COMMIT;
