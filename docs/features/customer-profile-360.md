# Hồ sơ khách hàng 360° (Manager)

Mở **Manager → Khách hàng → Xem hồ sơ**, hoặc `/manager/users/{id}`.
Trang chỉ tổng hợp dữ liệu; không thêm ghi chú, không sửa địa chỉ của customer.

## API chỉ đọc

Tất cả endpoint dưới `/api/manager/users/{id}/profile` chỉ chấp nhận phiên MANAGER hiện còn hiệu lực:

- `GET /`: thông tin customer và chỉ số tổng hợp.
- `GET /addresses`, `/orders`, `/feedback`, `/surveys`, `/vouchers`, `/voucher-usages`.
- Các danh sách nhận `page` (từ 0), `size` (1–100, mặc định 10), trả `{content,totalElements,totalPages,number,size}`.
- Customer khóa vẫn xem được. ID không tồn tại, customer xóa mềm hoặc tài khoản nội bộ trả 404.
- Không trả entity, mật khẩu, token hoặc câu trả lời khảo sát.

## Quy tắc số liệu

- Tổng đơn bao gồm mọi trạng thái của customer.
- Giá trị đơn hoàn thành: tổng `total_amount` của đơn `COMPLETED`, sau giảm giá, chưa trừ hoàn tiền; không phải số tiền đã thu.
- Đơn hoàn thành có yêu cầu đổi trả vẫn được tính và thể hiện trạng thái đổi trả riêng.
- Ngày đặt gần nhất: `created_at` lớn nhất trong các đơn `COMPLETED`, không phải ngày khách bấm nhận hàng.
- Feedback ẩn vẫn xuất hiện với nhãn; feedback xóa mềm không xuất hiện.
- Khảo sát xóa mềm vẫn giữ lịch sử tham gia; chỉ hiện tên, thời gian, trạng thái xóa và việc được cấp thưởng.
- Voucher được cấp chỉ gồm mã có chủ sở hữu là customer. Lịch sử sử dụng lấy mã và tiền giảm từ đơn, kể cả đơn hủy.
- Lịch sử không có bản ghi `voucher_usages` ghi `UNKNOWN` (chưa có dữ liệu hoàn lượt); không suy đoán từ trạng thái đơn.

## Điều hướng và cập nhật

- `q`/`page` giữ trạng thái danh sách khách. `tab`/`historyPage` giữ tab và trang lịch sử.
- Tìm tên, email, điện thoại tại backend trước phân trang.
- Polling 5 giây cho tổng quan và tab đang mở; tab ẩn dừng polling, request cũ bị bỏ qua.
- Lỗi tải nền giữ dữ liệu gần nhất và có cảnh báo/thử lại.
- Chi tiết đơn dùng chung component với trang quản lý đơn, hỗ trợ Escape và vòng focus bàn phím.

Không cần migration hoặc đổi `application.yml`. Cần khởi động lại backend để nạp các API mới.
