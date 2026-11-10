# Phiếu hỗ trợ khách hàng

## Cài đặt và dữ liệu

- Chỉ thêm một bảng nghiệp vụ `support_tickets`; dùng lại `customers`, `orders`, `customer_notifications`, `audit_logs`.
- Thêm một cột nullable `support_ticket_id` có khóa ngoại vào thông báo cũ để mở đúng phiếu. Không chứa ID phiếu trong `order_id` hay `care_task_id`.
- Người vận hành chạy `database/migrations/017_support_tickets.sql` trên database có sẵn các bảng nền `customers`, `orders` và `customer_notifications`, rồi khởi động lại backend. SQL không phụ thuộc trực tiếp vào migration nhật ký, chăm sóc hoặc nhắc việc. Đợt này không tự chạy migration hoặc sửa `application.yml`.
- Khách mở `/ho-tro`, `/ho-tro/{id}`. Manager mở `/manager/support-tickets`, chi tiết dùng `?id=...`; tìm kiếm, trạng thái, khách/người phụ trách và phân trang nằm trong query string. Hồ sơ 360° có liên kết tới phiếu của khách.

## Quy tắc bản đầu

- Khách gửi phiếu cho chính mình; Manager có thể tạo hộ CUSTOMER chưa xóa, kể cả khách đang khóa. Nhân viên/ADMIN không được chọn làm khách.
- Đơn liên quan không bắt buộc nhưng phải thuộc đúng khách của phiếu. Nội dung ban đầu hiển thị cho khách, không được coi là ghi chú nội bộ.
- NEW → IN_PROGRESS → WAITING_CUSTOMER hoặc RESOLVED. WAITING_CUSTOMER → IN_PROGRESS hoặc RESOLVED; khách trả lời khi chờ khách sẽ đưa về IN_PROGRESS. Không đổi ngược về NEW, không mở lại phiếu đã giải quyết.
- Trước khi xử lý phải phân công; người mới được giao phải là MANAGER đang hoạt động. Có thể giữ người phụ trách cũ không còn hoạt động để kết thúc lịch sử; Manager có thể giao lại cho người đang hoạt động.
- Đổi sang Chờ khách/Đã giải quyết phải có nội dung công khai gửi khách. Ghi chú nội bộ và trả lời của Manager có thể ghi riêng; ghi chú nội bộ không tạo thông báo cho khách.
- Phiếu đã giải quyết chỉ xem; nếu cần hỗ trợ thêm, tạo phiếu mới. Không có xóa cứng/xóa mềm hoặc tự đóng theo thời gian ở bản này.
- Tiêu đề 1–150, nội dung/tin nhắn 1–4.000 ký tự sau trim. Tối đa 200 tin nhắn trao đổi/ghi chú, cho phép thêm một tin chốt khi giải quyết. Hội thoại lưu dạng JSON text trong cùng phiếu; chưa hỗ trợ file, ảnh, email, chat realtime hay SLA.
- Mọi thay đổi khóa phiếu trong transaction. Cập nhật dùng `version`; xung đột trả 409 và giữ bản nháp trên web. Mã UUID cho lần tạo và mỗi tin nhắn chống trùng khi gửi lại sau mất phản hồi. Không tự sửa/hủy/thu tiền/hoàn tiền đơn liên quan hoặc đổi trạng thái việc chăm sóc.

## API

- Customer: `GET/POST /api/support-tickets`, `GET /api/support-tickets/{id}`, `POST /api/support-tickets/{id}/messages`.
- Manager: `GET/POST /api/manager/support-tickets`, `GET/PATCH /api/manager/support-tickets/{id}`, `POST /api/manager/support-tickets/{id}/messages`.
- Danh sách: `q`, `status`, `page`/`size`; Manager thêm `customerId`, `assigneeId`. Lọc tại database trước phân trang; không tải hội thoại hoặc truy vấn entity từng dòng trong danh sách.
- Tạo: `title`, `description`, `orderId` tùy chọn, `requestId` UUID; Manager thêm `customerId` và `assigneeId` tùy chọn. Customer không được gửi các trường chỉ định khách/nhân viên.
- Tin nhắn: `content`, `internal`, `requestId`; customer không có quyền `internal=true`.
- Cập nhật Manager: `status`, `assigneeId`, `version`, `reply` công khai và `requestId` nếu có reply. Customer không được PATCH trạng thái.
- DTO khách không trả danh tính/phân công nội bộ hoặc ghi chú nội bộ; chỉ Manager thấy thông tin khách và lịch sử nội bộ. Customer khác nhận 404 khi đoán ID.

## Thông báo, nhật ký và giao diện

- Dùng thông báo sẵn có cho khách khi tiếp nhận/có trả lời/cập nhật. Người được giao nhận thông báo khi phân công và khi khách trả lời. Phiếu chưa phân công xuất hiện trong hàng chờ Manager, không phát thông báo hàng loạt cho mọi nhân viên.
- Chuông Manager hiển thị chung nhắc việc và thông báo phiếu; hết áp dụng khi giải quyết/đổi người phụ trách. Thông báo cũ vẫn giữ lịch sử.
- Nhật ký ghi CREATE/UPDATE, loại SUPPORT_TICKET, chỉ metadata (ID khách/đơn/người phụ trách, trạng thái, phiên bản, số tin). Không lưu nội dung hội thoại hoặc ghi chú vào audit. Khách gửi tin không bị ghi giả thành thao tác Manager.
- Chỉ màn hình đang mở polling 5 giây; dừng khi ẩn tab, khi nhập bản nháp hoặc đang gửi. Giữ nội dung khi lỗi, không gửi chồng và bỏ kết quả sau khi rời trang. Có trạng thái tải/rỗng/lỗi/thử lại, form và thẻ responsive sáng/tối.

## Kiểm thử và giới hạn xác nhận

- SupportTicketIntegrationTest: chủ sở hữu, vai trò, tạo hộ, đơn đúng khách, ghi chú kín, trạng thái, phiên bản, idempotency, thông báo, audit và rollback.
- SupportTicketConcurrencyTest: tạo lặp đồng thời và hai tin nhắn đồng thời không mất dữ liệu.
- SupportTickets.test.jsx: route đăng nhập/quay về, bộ lọc, tạo/gửi lỗi giữ nháp, phân công, trạng thái, polling và URL trực tiếp.
- `CRM_POSTGRES_QA=true mvn test -q -Dtest=SupportTicketPostgresTest`: chạy SQL/JPA trên bảng tạm PostgreSQL và rollback, không áp dụng migration hoặc sửa bảng public. Không thay thế smoke test sau khi người vận hành cài migration.
- Chưa kiểm thử trực quan đầy đủ trên trình duyệt kết nối backend thật. Không thực hiện thanh toán hoặc xử lý đơn thật để QA.

Kết quả kiểm tra tự động đợt triển khai: 254 test frontend qua (`npm test -- --maxWorkers=2`); `mvn test -q`, build và kiểm tra whitespace qua. Đã chạy riêng hai test PostgreSQL `SupportTicketPostgresTest` và `CareReminderPostgresTest` thành công trên bảng tạm rollback; không cài migration vào database đang dùng.
