# Voucher cơ bản

## Cài đặt trên database đang có

Chạy **`database/migrations/005_voucher_management.sql`** trước khi khởi động backend mới:

```sh
psql -h localhost -U postgres -d htttdn -v ON_ERROR_STOP=1 -f database/migrations/005_voucher_management.sql
```

Database mới dùng `database/schema.sql`. Không cần thay đổi `application.yml`.
Migration thêm mô tả, mức trần giảm giá, unique index không phân biệt hoa/thường và bảng lịch sử `voucher_usages`.
Nếu dữ liệu cũ có mã trùng không phân biệt hoa/thường, migration rollback; kiểm tra và xử lý thủ công, không tự gộp lịch sử.

## Quản trị

Mở `http://localhost:5174/admin/vouchers`: tạo, sửa, bật/tắt, tìm mã, lọc và phân trang.
Không đổi tên hoặc xóa mã đã tạo. Ngày trong form theo múi giờ trình duyệt, API dùng ISO-8601 có múi giờ.

- `GET /api/admin/vouchers?search=SHOP&state=ACTIVE&page=0&size=10`
- `POST /api/admin/vouchers`
- `PATCH /api/admin/vouchers/{id}`: cập nhật một phần; gửi null để bỏ giới hạn/ngày/mức trần.
- `GET /api/vouchers/validate?code=SHOP10&amount=100000`: xem trước, không giữ lượt.

API admin yêu cầu Bearer JWT admin. Các trạng thái lọc: ACTIVE, DISABLED, EXPIRED, SCHEDULED, EXHAUSTED.

Ví dụ dữ liệu tạo:

```json
{
  "code": "SHOP10",
  "description": "Giảm 10% tối đa 50.000đ",
  "discountType": "PERCENTAGE",
  "discountValue": 10,
  "minOrderAmount": 300000,
  "maxDiscountAmount": 50000,
  "usageLimit": 100,
  "startsAt": null,
  "expiresAt": null,
  "active": true
}
```

Loại còn lại là FIXED_AMOUNT; số tiền VND nhập số nguyên. Một đơn chỉ dùng một mã.
Lượt được giữ trong transaction tạo đơn, rollback nếu tạo đơn thất bại. Checkout kiểm tra lại điều kiện và tính từ giá backend.
Đơn COD/PayOS vẫn PENDING (Chờ xác nhận). Đơn còn 0đ không gọi PayOS, trạng thái thanh toán PAID nhưng vẫn chờ admin xác nhận.

Hủy đơn qua admin hoặc customer hoàn lượt đúng một lần nếu đơn có bản ghi sử dụng.
Không hoàn lượt chỉ vì thanh toán lỗi/hết hạn khi đơn vẫn còn hoạt động.
Đơn cũ chưa có voucher_usages không được tự backfill/hoàn lượt; used_count cũ được giữ.
Tổng tiền giảm lấy từ đơn chưa hủy, không tính lại theo cấu hình voucher mới.

## Kiểm thử

- Backend: `mvn test -q`; VoucherIntegrationTest kiểm tra transaction, hai giao dịch tranh lượt cuối, hai đơn hủy đồng thời, rollback lỗi PayOS, quyền và API.
- Frontend: `npm test`, `npm run build`; kiểm tra form admin, retry, sửa/tắt, route, phân trang, bỏ mã và loại bỏ phản hồi xem trước cũ.
- PayOS trong test được giả lập, không thanh toán tiền thật.
