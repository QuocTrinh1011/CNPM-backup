# Bộ sơ đồ sequence mới

Bộ sơ đồ này mô tả ba vai trò của hệ thống CRM. Tên thư mục được giữ theo lịch sử, không dùng để suy ra quyền hiện tại. Mỗi thư mục chứa
cả mã nguồn PlantUML (`.puml`) và ảnh xuất bản (`.png`) tương ứng, để dễ
đọc, chỉnh sửa và đối chiếu.

## Cấu trúc

| Thư mục | Số sơ đồ | Phạm vi |
| --- | ---: | --- |
| `admin/` | 11 | Sơ đồ vận hành cũ, actor hiện tại là Manager: khách hàng, sản phẩm, phản hồi, khảo sát, đơn hàng và báo cáo |
| `customer/` | 8 | Đăng ký, đăng nhập, hồ sơ, sản phẩm, giỏ hàng, thanh toán, khảo sát và đơn hàng |
| `manager/` | 15 | Nghiệp vụ Manager; riêng M-15 là tra cứu audit dành cho Admin, giữ tên tệp lịch sử |

## Quy ước file

- File `.puml` là nguồn PlantUML có thể tiếp tục chỉnh sửa.
- File `.png` là bản xem nhanh đã xuất từ cùng một sơ đồ.
- Tên file giữa hai định dạng được giữ giống nhau.

## Kiểm tra nhanh

Tất cả file `.puml` trong bộ này đều có cặp khai báo `@startuml` và
`@enduml`. Đây là các tài liệu thiết kế, không thay đổi mã nguồn ứng dụng.

## Đối chiếu ngày 26/10/2026

- Feedback không có duyệt/từ chối hoặc email/SMS; thống kê khảo sát không có CSAT; revenue không có lợi nhuận.
- PayOS tạo đơn PENDING, webhook chỉ cập nhật paymentStatus PAID; thất bại không giải phóng tồn kho ngay. Feedback yêu cầu COMPLETED và duy nhất theo cặp đơn/sản phẩm.
- Xác nhận nhận hàng yêu cầu DELIVERED và returnStatus NONE/null; COMPLETED là nhánh idempotent. Đổi trả: REQUESTED → APPROVED → COMPLETED hoặc REQUESTED → REJECTED.
- M-15 dùng Admin và `/api/admin/audit-logs`; Manager xem timeline Customer riêng trong hồ sơ 360°.
