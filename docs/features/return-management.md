# Quản lý đổi trả

Chạy `database/migrations/009_return_management.sql` trên PostgreSQL hiện có trước khi chạy bản mới (schema mới đã có bảng). Migration không chỉnh dữ liệu đơn cũ.

Sau migration, dừng backend cũ (Ctrl+C trong terminal chạy backend), rồi chạy lại `mvn spring-boot:run` trong thư mục `backend`. Tiến trình Java đang chạy không tự nạp controller mới. Giữ cổng theo cấu hình hiện tại và bảo đảm `VITE_API_BASE_URL` của frontend trỏ đúng cổng đó; không cần sửa `application.yml`.

Nếu nhận `No static resource api/manager/orders/{id}/return`, kiểm tra backend có nạp `ManagerReturnController` với mapping `PATCH /api/manager/orders/{id}/return`. Đây là lỗi thiếu endpoint của phiên bản đang chạy, không phải lỗi migration hay ghi chú trống khi chấp thuận.

Manager lọc Đổi trả hoặc các bước chờ xử lý/đã chấp thuận/đã từ chối/hoàn tất, mở Chi tiết để xử lý.

`PATCH /api/manager/orders/{id}/return` nhận `{ "status": "APPROVED|REJECTED|COMPLETED", "note": "..." }`.
REQUESTED chỉ chuyển APPROVED hoặc REJECTED; APPROVED chỉ chuyển COMPLETED. Hai trạng thái cuối không sửa lại. Từ chối và hoàn tất cần nội dung không rỗng, tối đa 1.000 ký tự. Gửi lại cùng trạng thái/nội dung không tạo lịch sử hoặc thông báo trùng. Khóa đơn trong transaction tránh xử lý đồng thời; lịch sử và thông báo được lưu cùng transaction.

Không tự hoàn tiền, cộng tồn kho, hoàn lượt voucher hay đổi trạng thái giao hàng/thanh toán. Hoàn tất chỉ ghi nhận cách giải quyết đã thực hiện bên ngoài. Khách đọc ghi chú trong chi tiết đơn và thông báo; không công khai ID nhân viên cho khách. Yêu cầu cũ vẫn giữ ngày/lý do đang có; không suy đoán lịch sử xử lý.
