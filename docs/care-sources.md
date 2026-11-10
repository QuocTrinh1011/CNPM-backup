# Tạo chăm sóc từ đơn đổi trả và phản hồi

## Cách sử dụng

- Manager → Đơn hàng → Chi tiết đơn có đổi trả REQUESTED hoặc APPROVED → **Tạo công việc chăm sóc**.
- Manager → Phản hồi có trạng thái NEW hoặc IN_PROGRESS → **Tạo công việc chăm sóc**.
- Backend kiểm tra lại nguồn, tự xác định customer và gợi ý tiêu đề. Manager chọn người phụ trách đang hoạt động, hạn xử lý và nội dung, sau đó lưu.
- Nếu đã có việc TODO/IN_PROGRESS cùng nguồn, hiển thị liên kết đến các công việc của nguồn đó thay vì tạo trùng. Danh sách giữ cả lịch sử đã hoàn thành; có thể lọc trạng thái như trước.
- Sau lưu có liên kết theo dõi; danh sách công việc hiển thị loại nguồn và ID. Liên kết là cố định, không thay đổi qua API sửa công việc.
- Khách bị khóa vẫn được chăm sóc. Khách đã xóa hoặc nguồn không hợp lệ bị từ chối. Phản hồi ẩn nhưng chưa xử lý vẫn được chăm sóc.

## Quy tắc

Mỗi nguồn chỉ có một công việc đang mở. Tạo trong transaction, khóa bản ghi đơn/phản hồi khi kiểm tra; PostgreSQL có thêm partial unique index. Hai quản lý gửi đồng thời chỉ tạo một việc, yêu cầu còn lại trả 409. Hoàn thành việc giải phóng giới hạn này; chỉ tạo việc mới nếu nguồn vẫn đang cần xử lý.

Đơn chỉ nhận nguồn RETURN_ORDER khi returnStatus là REQUESTED/APPROVED và chưa hủy. Phản hồi FEEDBACK phải chưa xóa và có trạng thái NEW/IN_PROGRESS. Nếu nguồn đã được xử lý trong lúc nhập, lưu trả lỗi và giữ bản nháp. Khách gửi kèm không khớp customer của nguồn bị từ chối; không tin thông tin khách từ frontend.

Tạo/hoàn thành việc không cập nhật trạng thái đơn, đổi trả, phản hồi, thanh toán, tồn kho hoặc voucher; không tự gửi tin. Công việc đã tạo vẫn được giữ khi nguồn sau đó được xử lý hoặc xóa mềm. Công việc thủ công hiện có giữ nguyên, không tự suy đoán nguồn từ tiêu đề.

## Cập nhật database

Chạy `database/migrations/013_care_sources.sql` sau `database/migrations/012_customer_care.sql`, trước khi khởi động backend mới. Migration thêm hai cột nullable và index, chạy lặp an toàn. Không cập nhật dữ liệu cũ. Schema khởi tạo đã được bổ sung.

## API Manager

- `GET /api/manager/care/sources/{RETURN_ORDER|FEEDBACK}/{id}`: thông tin nguồn, customer tối thiểu, tiêu đề và openTaskId nếu có.
- `POST /api/manager/care/tasks`: thêm `sourceType`, `sourceId` tùy chọn. Không gửi cả hai giữ luồng thủ công; gửi thiếu một trường bị từ chối.
- `GET /api/manager/care/tasks?sourceType=...&sourceId=...`: lọc tại database trước phân trang, kết hợp các bộ lọc hiện có. Thông tin nguồn được trả trong DTO công việc.
- `PATCH /api/manager/care/tasks/{id}`: không cho sửa customer hoặc nguồn, giữ version và quy tắc chuyển trạng thái cũ.

Chỉ MANAGER được gọi; ADMIN/CUSTOMER bị từ chối. Không đưa dữ liệu người nhận, mật khẩu hoặc token vào URL/DTO nguồn.

## Kiểm thử

- CustomerCareIntegrationTest: nguồn hợp lệ/đã đóng/đã xóa, customer sai/khóa, quyền, lọc nguồn, giữ liên kết, chống lặp và tạo lại sau hoàn thành.
- CareSourceConcurrencyTest: hai transaction đồng thời, một công việc đang mở.
- SourceCareCreator.test.jsx: form, người phụ trách/hạn, payload nguồn, link theo dõi, nguồn có công việc, giữ bản nháp khi conflict, chống gửi lặp, lỗi và hủy.
- CareSourcePostgresTest (`CRM_POSTGRES_QA=true`): migration chạy lặp, partial unique index, hoàn thành cho phép tạo tiếp; rollback DDL và dữ liệu thử, không cài migration vĩnh viễn.
- Chạy `mvn test -q`, `npm test`, `npm run build`, `git diff --check`. Kiểm tra trực quan desktop/mobile và sáng/tối sau khi đăng nhập Manager ở môi trường thử.

Giữ cấu hình và chỉnh sửa local, không push/PR. Nhật ký thao tác bản đầu không ghi các công việc chăm sóc; chưa mở rộng phạm vi audit trong đợt này.
