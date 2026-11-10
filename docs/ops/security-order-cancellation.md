# Bảo mật cấu hình và hủy đơn

## Khởi động

- Đặt `DB_PASSWORD` và `JWT_SECRET` trong môi trường shell/IDE; JWT secret ngẫu nhiên ít nhất 32 byte UTF-8, không dùng giá trị mẫu. Không commit bí mật. Backend không tự đọc `.env`.
- Áp dụng schema/migration phù hợp trước khi khởi động; Hibernate mặc định `validate`, không tự nâng cấp schema. Test H2 dùng schema tạo riêng, không dùng mật khẩu thật.
- Mật khẩu từng công khai phải được đổi tại PostgreSQL và mọi nơi dùng chung. Thay JWT secret, khởi động lại backend; access token cũ bị từ chối. Refresh token được lưu riêng, muốn đăng xuất toàn bộ phiên phải thu hồi chúng bằng quy trình quản trị đã đối soát.
- Không có migration mới cho bản sửa này. Không tự chạy script vào database đang sử dụng.

## Hủy đơn

Customer và Manager hoàn kho trong cùng transaction khóa đơn, gộp theo sản phẩm và khóa ID tăng dần. `stockReleased` cùng cơ chế hoàn lượt voucher ngăn xử lý trùng. Không tự vá đơn cũ đã hủy.

Manager không hủy đơn đã chuyển `SHIPPED`/`DELIVERING` hoặc đã giao/hoàn thành. Vấn đề sau giao dùng luồng đổi trả.

Đơn đã thanh toán được hủy khi còn đủ điều kiện, giữ `PAID` trên đơn, thanh toán và lịch sử lần thử. Hệ thống tạo khoản chờ trong sổ hoàn tiền; việc chuyển tiền vẫn thực hiện bên ngoài. Nếu PayOS vừa xác nhận đã trả trong lúc Customer yêu cầu hủy, lần gọi đó chỉ cập nhật thanh toán; khách có thể gửi lại yêu cầu hủy sau khi xem trạng thái mới. Đơn có cảnh báo thanh toán phải được đối chiếu trước khi hủy. Xem [sổ hoàn tiền và tự hủy](refunds-auto-cancellation.md).

## Đối soát đơn cũ

Sao lưu ngoài máy chủ trước khi xử lý. Liệt kê đơn `CANCELLED` nhưng `stock_released=false` chỉ làm **ứng viên**, không phải bằng chứng cần cộng kho. Xác minh từng ID: đơn thật hay dữ liệu mẫu, đã trừ kho, đã hoàn thủ công, số lượng và sản phẩm còn tồn tại. Chỉ sửa danh sách đã duyệt trong thời gian bảo trì, có đối chiếu trước/sau và rollback nếu lệch; không chạy cộng kho hàng loạt.

Đơn đã thu tiền nhưng bị ghi `CANCELLED` cần đối chiếu PayOS/sao kê và việc hoàn thủ công trước khi sửa. Không suy đoán từ trạng thái đơn hoặc ngày cập nhật. Bản sửa không hồi tố chứng cứ thanh toán đã mất.
