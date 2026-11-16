-- Dữ liệu mẫu cho website thời trang nam ANH LỚN SHOP.
-- Mật khẩu tài khoản mẫu là: password
-- CHỈ dùng cho local/demo; tuyệt đối không chạy seed này trên production.
-- Nếu lỡ nạp vào production, phải đổi mật khẩu của tất cả tài khoản mẫu ngay.

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

INSERT INTO customers(email, full_name, phone, preferences, password_hash)
SELECT 'khachhang@example.com', 'Nguyễn Minh Khang', '0900000000', 'Phong cách tối giản, ưu tiên màu trung tính', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email = 'khachhang@example.com');

INSERT INTO admins(role, password_hash)
SELECT 'ADMIN', '$2a$10$8FUcPt6obMuhIBNsf/0pDO2Iwx.umyP60RDcpXxcO7hBiJerhhJJy'
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE role = 'ADMIN');

-- Admin login uses the same identity table as the application auth service.
UPDATE customers
SET email = 'admin@shop.com',
    password_hash = '$2a$10$8FUcPt6obMuhIBNsf/0pDO2Iwx.umyP60RDcpXxcO7hBiJerhhJJy',
    role = 'ADMIN',
    locked = FALSE
WHERE email = 'admin@example.com'
  AND role = 'ADMIN';

INSERT INTO customers(email, full_name, phone, preferences, password_hash, role)
SELECT 'admin@shop.com', 'Quản trị viên', NULL, NULL, '$2a$10$8FUcPt6obMuhIBNsf/0pDO2Iwx.umyP60RDcpXxcO7hBiJerhhJJy', 'ADMIN'
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email = 'admin@shop.com');

-- HR and employee test accounts: password is "password" (local/demo only).
-- This BCrypt hash was checked with Spring BCryptPasswordEncoder.
WITH demo_accounts(email, full_name, role) AS (
    VALUES
        ('qlnhansu@shop.com', 'Quản lý nhân sự', 'MANAGER_HR'),
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
    ('qlnhansu@shop.com', 'Quản lý nhân sự', 'MANAGER_HR'),
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

INSERT INTO employee_profiles(employee_id, employee_code, job_title, permission_profile, work_area, hire_date)
SELECT account.customer_id,
       demo.employee_code,
       demo.job_title,
       'STAFF',
       demo.work_area,
       current_date
FROM customers AS account
JOIN (VALUES
    ('qlnhansu@shop.com', 'HR-001', 'Quản lý nhân sự', 'GENERAL'),
    ('nvbh01@shop.com', 'SALES-001', 'Nhân viên bán hàng', 'SALES'),
    ('nvbh02@shop.com', 'SALES-002', 'Nhân viên bán hàng', 'SALES'),
    ('nvbh03@shop.com', 'SALES-003', 'Nhân viên bán hàng', 'SALES'),
    ('nvkho01@shop.com', 'WAREHOUSE-001', 'Nhân viên kho', 'WAREHOUSE'),
    ('nvkho02@shop.com', 'WAREHOUSE-002', 'Nhân viên kho', 'WAREHOUSE'),
    ('nvkho03@shop.com', 'WAREHOUSE-003', 'Nhân viên kho', 'WAREHOUSE')
) AS demo(email, employee_code, job_title, work_area)
  ON lower(account.email) = demo.email
ON CONFLICT (employee_id) DO UPDATE
SET work_area = EXCLUDED.work_area;

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

-- Fresh-install demo products are inserted after schema.sql's migration snapshot.
-- Add opening balances only when neither an upgrade nor an earlier seed recorded one.
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
