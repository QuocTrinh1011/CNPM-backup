# Việc của tôi và thông báo nhắc hạn

## Triển khai

1. Giữ backend cũ dừng trong lúc cập nhật. Sao lưu database theo quy trình đang dùng.
2. Chạy `database/migrations/015_care_reminders.sql` sau các migration công việc chăm sóc trước đây. Script chỉ bổ sung hai cột nullable, khóa ngoại và index trên bảng thông báo hiện có; không tạo bảng nghiệp vụ mới hoặc cập nhật lịch sử.
3. Build/khởi động lại backend rồi frontend Manager (cổng 5175). Không cần thay đổi `application.yml`.

Migration **không được tự chạy** bởi tính năng này. Nếu chưa cài migration, scheduler ghi cảnh báo và bỏ qua; API thông báo mới cần migration để hoạt động. Khi cần dừng tác vụ nhắc tạm thời có thể đặt biến môi trường `CRM_CARE_REMINDERS_ENABLED=false`; mặc định bật.

## Cách hoạt động

- `/manager/my-tasks` chỉ liệt kê việc `TODO`/`IN_PROGRESS` được giao cho tài khoản Manager đăng nhập. Bộ lọc `group=OPEN|TODAY|UPCOMING|OVERDUE|FOLLOW_UP`, tìm `q`, phân trang `page`/`size` đều lọc tại database.
- TODAY: chưa quá hạn và hạn trước đầu ngày mai Việt Nam. UPCOMING: từ đầu ngày mai đến trước đầu ngày thứ tám. OVERDUE: hạn nhỏ hơn thời điểm xem. FOLLOW_UP: việc đang mở có công việc cha. FOLLOW_UP là bộ lọc bổ sung, có thể trùng nhóm thời hạn.
- Khách bị khóa vẫn được tính; khách đã xóa hoặc không còn vai trò CUSTOMER bị loại.
- Job chạy sau 60 giây khởi động và mỗi 60 giây sau khi lượt trước kết thúc, tối đa 500 ứng viên/lượt. Backlog còn lại tiếp tục ở lượt sau. Chỉ gửi cho MANAGER đang hoạt động.
- Hạn trong hôm nay chưa qua: CARE_DUE_TODAY. Đã trễ, kể cả việc tồn từ trước triển khai: chỉ CARE_OVERDUE, không gửi bù lời nhắc đến hạn. Mỗi loại một lần cho tổ hợp người nhận–công việc–hạn xử lý, không nhắc hằng ngày.
- Khóa bản ghi công việc trong transaction trước khi kiểm tra và tạo thông báo; unique index bảo vệ chống trùng. Hoàn thành và sửa việc dùng cùng khóa. Thông báo dùng `care_task_id`, không dùng `order_id`.
- Thông báo cũ giữ lịch sử; khi đã hoàn thành, đổi người, đổi hạn hoặc lời nhắc đến hạn đã chuyển sang quá hạn, thông báo không còn áp dụng và không tính vào số chưa đọc cần xử lý. Không tự sửa trạng thái đã đọc để giả vờ người dùng đã xem.
- Thời gian tính theo `Asia/Ho_Chi_Minh`. Mỗi lần chăm sóc kế tiếp là một công việc riêng.

## API Manager

- `GET /api/manager/care/my-tasks`: danh sách cá nhân; mặc định OPEN, page 0, size 10.
- `GET /api/manager/care/my-tasks/summary`: số đếm toàn bộ năm nhóm.
- `GET /api/manager/care/tasks/{id}`: chi tiết độc lập với trang danh sách, giữ quyền vận hành chung của Manager.
- `GET /api/manager/notifications/summary`: chỉ số chưa đọc còn áp dụng, dùng khi chuông đóng.
- `GET /api/manager/notifications?page=0&size=10`: danh sách lịch sử và số chưa đọc; state ACTIVE/OUTDATED/COMPLETED.
- `PATCH /api/manager/notifications/{id}/read`, `PATCH /api/manager/notifications/read-all`: lặp an toàn, giới hạn theo người nhận trong phiên; không cho đánh dấu thông báo của tài khoản khác.

Không nhận assigneeId/customerId để thay đổi phạm vi danh sách cá nhân. Các API chăm sóc chung vẫn giữ quyền hiện có. Không gửi dữ liệu entity hoặc mật khẩu/token.

Manager polling 5 giây khi tab trình duyệt hiển thị, không gửi chồng. Chuông đóng không tải danh sách thông báo; khi mở có phân trang, lỗi/thử lại và Escape để đóng. Bấm thông báo đánh dấu đã đọc rồi mở `care?taskId=...`; chi tiết tải theo ID, kể cả khi không nằm trong trang danh sách. Form chăm sóc dùng lại validation, chống gửi lặp và cơ chế dừng polling khi chỉnh sửa.

## Kiểm thử

- Backend: CareReminderIntegrationTest, CareReminderConcurrencyTest (ranh giới ngày, backlog, đổi hạn/người, hoàn thành, quyền, phân trang và hai worker).
- Frontend: ManagerCareInbox.test.jsx (URL, mở trực tiếp, back/forward, chuông, pagination, dữ liệu cũ và giữ form khi lỗi).
- PostgreSQL: bật `CRM_POSTGRES_QA=true`, chạy `mvn test -q -Dtest=CareReminderPostgresTest`. Test dùng bảng tạm riêng theo connection, rollback; **không áp dụng migration hoặc đổi bảng public**. Đây là kiểm tra SQL trên PostgreSQL, không thay thế việc smoke test sau khi người vận hành chạy migration.

Không email, thông báo hệ điều hành, trạng thái hủy công việc hoặc tự thay đổi nghiệp vụ chăm sóc.
