# Nhật ký cập nhật quyết định

Ngày cập nhật: 26/10/2026
Phạm vi: đối chiếu tài liệu với code hiện tại; không xác nhận triển khai production hoặc dữ liệu lịch sử.

| Nội dung | Quyết định cũ (lịch sử, đã thay thế) | Mô tả hiện tại | Nguồn đối chiếu |
| --- | --- | --- | --- |
| Audit log | Admin toàn bộ; Manager lọc actor MANAGER | Chỉ Admin tra cứu qua `/api/admin/audit-logs`; không có endpoint hoặc điều hướng audit Manager. Timeline Customer riêng trong hồ sơ 360° | `AuditLogController`; `AuditLogQuery.list`; `CustomerActivityService.list` |
| Khôi phục mật khẩu | Chỉ có mã development; email chưa có bằng chứng code | Code có email Resend tùy chọn với token 43 ký tự và liên kết reset, không trả mã trong response email. Fallback mã sáu chữ số chỉ ở development khi bật cờ | `AuthController`; `AuthService`; cấu hình Resend |
| Demo/nghiệm thu | Không bật reset | Giữ `RESEND_ENABLED=false` và `DEV_PASSWORD_RESET_ENABLED=false`; khả năng email đã triển khai không đồng nghĩa đã gửi/nhận email hoặc xác minh production | Quyết định demo được giữ; cấu hình code |
| Tự hủy PayOS | Mặc định code tắt | Demo/nghiệm thu bật `PAYOS_AUTO_CANCEL_ENABLED=true`, grace 24 giờ; lịch mặc định 300000 ms. Chỉ tự hủy sau hạn và grace mới giải phóng tồn kho/voucher đúng một lần | `AbandonedOrderScheduler`; `AbandonedOrderWorker`; `StockService.release`; `VoucherService.release` |
| Xác nhận nhận hàng | Chỉ nêu DELIVERED | DELIVERED và returnStatus NONE/null; chuyển COMPLETED. Gọi lại khi COMPLETED trả kết quả hiện có | `OrderService.confirmReceipt` |
| Đổi trả | Mô tả thiếu các nhánh chuyển trạng thái | REQUESTED → APPROVED → COMPLETED hoặc REQUESTED → REJECTED | `ReturnManagementService.process` |

PRD cập nhật lên v1.4. Tài liệu Use Case v2 phân biệt khả năng email tùy chọn, fallback development và cấu hình demo tắt; không tự mở rộng phạm vi nghiệm thu production.

## Hành vi audit đã đối chiếu

- `AuditLogController` chỉ ánh xạ `/api/admin/audit-logs`; `AuditLogQuery.list` yêu cầu ADMIN trước khi truy vấn có bộ lọc/phân trang.
- Thao tác tài khoản nội bộ thuộc `/api/admin/accounts`. Audit có thể ghi actor ADMIN, MANAGER hoặc CUSTOMER; vai trò tạo bản ghi không phải quyền tra cứu audit.
- `OrderService.cancel/confirmReceipt` ghi sự kiện Customer qua `AuditTrail.recordAs`. `CustomerActivityService.list` tổng hợp timeline hồ sơ 360° riêng, không cấp quyền audit cho Manager.

## Bằng chứng cấu hình

- Demo/nghiệm thu giữ cả `RESEND_ENABLED=false` và `DEV_PASSWORD_RESET_ENABLED=false`. Email Resend cần được cấu hình để sử dụng; chưa xác minh gửi/nhận thực tế.
- `AbandonedOrderScheduler` mặc định tắt, grace 24 giờ, chu kỳ `app.payos.auto-cancel-ms` mặc định 300000 ms.
- Spring Boot không tự đọc `.env`; đặt biến trong môi trường tiến trình backend. Không commit secret.

## Sơ đồ sequence đã sửa

- Cả 11 sơ đồ vận hành trong thư mục lịch sử `admin/` dùng actor Manager; giữ nguyên đường dẫn.
- Feedback dùng NEW/IN_PROGRESS/RESOLVED, không có approve/reject hoặc email/SMS; thống kê khảo sát không có CSAT; revenue không có lợi nhuận.
- `customer/III-07-shopping-cart-order-payos.puml` tạo đơn PENDING; webhook chỉ cập nhật paymentStatus PAID, không tự CONFIRMED hoặc giải phóng tồn kho khi thất bại. Feedback yêu cầu COMPLETED và duy nhất theo cặp order/product.
- `manager/M-15-audit-log-query.puml` là audit dành cho Admin; thư mục và tên tệp là lịch sử, không biểu thị quyền Manager.

## Kiểm tra dữ liệu lịch sử audit

Truy vấn đề xuất, chưa chạy:

```sql
SELECT actor_role, entity_type, COUNT(*) FROM audit_logs WHERE entity_type='ACCOUNT' AND actor_role<>'ADMIN' GROUP BY actor_role, entity_type;
```

Chưa kiểm phân bố actor hoặc schema/migration trên cơ sở dữ liệu triển khai. Tài liệu chỉ mô tả code trong repository; không kết luận dữ liệu lịch sử đã tồn tại.
