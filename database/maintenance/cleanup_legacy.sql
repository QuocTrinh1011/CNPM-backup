-- Dọn các cột và khóa ngoại còn sót lại từ phiên bản database cũ.
-- Không xóa dữ liệu sản phẩm, khách hàng, đơn hàng hay các bảng admin/tích hợp.

BEGIN;

-- Các khóa ngoại cũ dùng bảng users; backend user hiện dùng customers.
ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS fkstvfmrq4hk9go8cd0yq27kcqk;
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS fkihnjta1253kjyigmt2vnqbg6b;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS fksjfs85qf6vmcurlx43cnc16gy;
ALTER TABLE refresh_tokens DROP CONSTRAINT IF EXISTS fk1lih5y2npsf8u5o3vhdb9y0os;

-- Cột dư trong các bảng đang được backend sử dụng.
ALTER TABLE products DROP COLUMN IF EXISTS id;
ALTER TABLE products DROP COLUMN IF EXISTS category;
ALTER TABLE products DROP COLUMN IF EXISTS colors;
ALTER TABLE products DROP COLUMN IF EXISTS sizes;
ALTER TABLE products DROP COLUMN IF EXISTS stock;
ALTER TABLE feedback DROP COLUMN IF EXISTS id;
ALTER TABLE feedback DROP COLUMN IF EXISTS comment;
ALTER TABLE orders DROP COLUMN IF EXISTS id;
ALTER TABLE order_items DROP COLUMN IF EXISTS id;
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS user_id;

-- Xóa các bảng legacy không được backend user sử dụng.
DROP TABLE IF EXISTS vouchers;
DROP TABLE IF EXISTS surveys;
DROP TABLE IF EXISTS users;

COMMIT;
