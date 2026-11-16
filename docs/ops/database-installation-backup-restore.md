# Cài đặt, sao lưu và phục hồi CSDL

## Thiết kế và phạm vi

CSDL PostgreSQL hiện tại được mô tả đầy đủ trong [`database/schema.sql`](../../database/schema.sql), gồm 33 bảng cho các nhóm:

- Tài khoản và phiên đăng nhập: `customers`, `admins`, `refresh_tokens`, `password_reset_tokens`.
- Danh mục, sản phẩm và nhà cung cấp: `categories`, `products`, `suppliers`.
- Giỏ hàng, địa chỉ, đơn hàng và đổi trả: `cart_items`, `wishlists`, `customer_addresses`, `orders`, `order_items`, `order_return_events`.
- Thanh toán: `payments`, `payment_attempts`, `payment_webhook_events`.
- Voucher và khuyến mãi: `store_vouchers`, `voucher_usages`, `promotion_campaigns`, `promotion_product_rules`, `promotion_invoice_rules`, `promotion_voucher_rules`.
- Khảo sát, đánh giá và thông báo: `feedback`, `survey_definitions`, `survey_questions`, `survey_responses`, `survey_answers`, `survey_recipients`, `survey_notified_customers`, `customer_notifications`.
- Nhập kho và chi phí: `stock_receipts`, `stock_receipt_items`.
- Theo dõi kiểm toán: `audit_logs`.

Danh sách này phản ánh schema hiện tại; các bảng hoàn tiền, chăm sóc khách hàng và phiếu hỗ trợ đã được loại khỏi phạm vi. Migration dành cho database đã có dữ liệu được ghi trong [`database/migrations/README.md`](../../database/migrations/README.md).

## Cài đặt database mới

Yêu cầu PostgreSQL và bộ công cụ dòng lệnh tương ứng (`psql`, `createdb`). Chạy từ thư mục gốc repo; ví dụ dùng database riêng `cnpm` như cấu hình mặc định của backend:

```powershell
createdb --host localhost --port 5432 --username postgres cnpm
psql --host localhost --port 5432 --username postgres --dbname cnpm --set ON_ERROR_STOP=1 --file database/schema.sql
```

`psql` sẽ yêu cầu mật khẩu nếu PostgreSQL yêu cầu xác thực. Không ghi mật khẩu trực tiếp vào câu lệnh, file trong repo hoặc log. Chỉ nạp dữ liệu mẫu trên môi trường local/demo:

```powershell
psql --host localhost --port 5432 --username postgres --dbname cnpm --set ON_ERROR_STOP=1 --file database/seed/seed_data.sql
```

Không chạy lại `schema.sql` hoặc seed trên database production. Với database đang hoạt động, sao lưu trước và chọn các migration phù hợp với phiên bản hiện tại; không chạy mù toàn bộ lịch sử migration.

## Phương án sao lưu

1. Tạo bản dump nhất quán mỗi ngày bằng `pg_dump` định dạng custom; tạo thêm bản trước mỗi lần chạy migration hoặc thay đổi vận hành lớn.
2. Lưu bản dump ngoài repo, trên vùng lưu trữ được giới hạn quyền truy cập và mã hóa khi lưu/truyền. Không commit dump hoặc thông tin xác thực vào Git.
3. Đề xuất giữ 7 bản ngày gần nhất, 4 bản tuần và 12 bản tháng. Đây là chính sách lưu trữ đề xuất; cần cấu hình trong nơi chạy backup và điều chỉnh theo dung lượng/chính sách của đơn vị.
4. Sau khi tạo, kiểm tra file tồn tại và đọc được bằng `pg_restore --list`. Theo dõi log backup và cảnh báo nếu lịch chạy hoặc kiểm tra thất bại.

Ví dụ PowerShell (chạy từ thư mục repo; `pg_dump` sẽ hỏi mật khẩu khi cần):

```powershell
$backupDir = "D:\crm-backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $backupDir "cnpm-$stamp.dump"
pg_dump --host localhost --port 5432 --username postgres --dbname cnpm --format custom --file $backupFile
if ($LASTEXITCODE -ne 0) { throw "pg_dump thất bại" }
pg_restore --list $backupFile | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Không đọc được file backup" }
```

Nếu cần khôi phục cả role PostgreSQL, xuất globals riêng bằng `pg_dumpall --globals-only`; lưu file này như secret vì có thông tin role nhạy cảm. Nếu không khôi phục globals, hãy tạo trước role ứng dụng và quyền tương ứng theo cấu hình triển khai.

## Quy trình phục hồi

1. Thông báo thời gian bảo trì và dừng backend/ghi dữ liệu vào database đích.
2. Giữ nguyên file backup gốc; tạo thêm backup của database đích hiện tại nếu database còn truy cập được.
3. Khôi phục trước vào database tách biệt để kiểm tra. Ví dụ:

```powershell
createdb --host localhost --port 5432 --username postgres cnpm_restore_check
pg_restore --host localhost --port 5432 --username postgres --dbname cnpm_restore_check --no-owner --no-privileges --exit-on-error "D:\crm-backups\cnpm-YYYYMMDD-HHMMSS.dump"
```

4. Xác nhận `pg_restore` kết thúc thành công, các bảng chính có mặt, dữ liệu có thể đọc, và backend kết nối được bằng cấu hình ứng dụng. Ví dụ kiểm tra nhanh:

```powershell
psql --host localhost --port 5432 --username postgres --dbname cnpm_restore_check --command "SELECT count(*) FROM customers; SELECT count(*) FROM orders; SELECT count(*) FROM products;"
```

5. Sau khi kiểm tra chấp nhận được, thực hiện restore vào database đích trong cửa sổ bảo trì. Với dump custom và database đích đã tồn tại, có thể dùng `pg_restore --clean --if-exists --exit-on-error`; lệnh này thay thế các object được lưu trong dump. Xác nhận lại quyền của role ứng dụng trước khi mở backend.
6. Chạy smoke test đăng nhập, đọc danh mục/sản phẩm, xem đơn hàng và kiểm tra thanh toán; chỉ mở lại ghi dữ liệu sau khi các bước đạt yêu cầu. Ghi nhận thời điểm backup, thời điểm restore, file nguồn, người thực hiện và kết quả.

Không khôi phục trực tiếp lên production trước khi đã kiểm tra file dump và diễn tập trên database tách biệt. Nếu restore thất bại, giữ database đích ở trạng thái bảo trì và phục hồi lại từ bản backup trước thao tác.

## Biên bản diễn tập phục hồi

| Ngày | PostgreSQL | Nguồn | Database thử nghiệm | Kết quả |
| --- | --- | --- | --- | --- |
| 2026-11-15 | 18.1, localhost | `htttdn` | `htttdn_restore_check_20261115_165330` (đã dọn sau test) | `pg_dump` custom-format và `pg_restore` thành công; `pg_restore --list` hợp lệ; tên bảng public và số dòng khớp trên 39/39 bảng. Database nguồn không bị ghi/sửa. Dump tạm đã xóa sau diễn tập để không giữ thêm bản dữ liệu cá nhân. |

### Sai khác schema cần xử lý riêng

Database thật có sáu bảng public không có trong schema khởi tạo hiện tại: `crm_voucher_campaigns`, `crm_voucher_issues`, `customer_care_notes`, `customer_care_tasks`, `order_refunds`, `support_tickets`. Bốn bảng cuối được gỡ bởi migration `020_retire_refund_care_support_reports.sql`; hai bảng `crm_voucher_campaigns` và `crm_voucher_issues` không được tìm thấy trong schema hoặc mã hiện tại. Diễn tập này chỉ kiểm tra backup/restore và không chạy migration hay xóa dữ liệu. Trước khi đồng bộ database thật với schema hiện tại, cần rà soát hai bảng voucher cũ và xác nhận thời điểm áp dụng migration 020 sau khi backup.
