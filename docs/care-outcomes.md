# Kết quả chăm sóc và hẹn chăm sóc lại

## Không tạo bảng mới

Chỉ mở rộng `customer_care_tasks` bằng `outcome`, `result_note` và `parent_task_id`. Liên kết tới công việc trước là khóa ngoại tự tham chiếu trong cùng bảng. Unique index trên parent_task_id bảo đảm mỗi việc chỉ có một việc kế tiếp. Không có bảng kết quả hoặc lịch hẹn riêng.

Chạy `database/migrations/014_care_outcomes.sql` sau các migration chăm sóc và nguồn đã có, rồi khởi động lại backend. Migration chỉ thêm cột/index, chạy lặp an toàn, không UPDATE dữ liệu cũ. Schema cài mới cũng đã được bổ sung. Không thay đổi application.yml.

## Hoàn thành công việc

Manager chọn trạng thái Hoàn thành rồi chọn một kết quả:

- CONTACTED: Đã liên hệ.
- UNREACHABLE: Chưa liên hệ được.
- RESOLVED: Đã giải quyết.
- NEEDS_FOLLOW_UP: Cần theo dõi tiếp.

Kết quả bắt buộc trên cả frontend và backend cho lần hoàn thành mới. Ghi chú kết quả tùy chọn, tối đa 4.000 ký tự, được trim. Kết quả chỉ được lưu khi hoàn thành. Giữ version chống ghi đè và không cho sửa công việc/kết quả đã hoàn thành.

Đã liên hệ hoặc đã hoàn thành công việc không đồng nghĩa vấn đề của khách đã được giải quyết. Không tự đổi đơn, phản hồi hoặc đổi trả sang trạng thái hoàn tất. Không gửi thông báo, phát voucher hoặc xử lý thanh toán.

Công việc hoàn thành trước migration giữ NULL, hiển thị “Chưa ghi nhận kết quả”; không tự gán kết quả cho lịch sử. Dashboard hiện tại vẫn thống kê trạng thái công việc, chưa có báo cáo hiệu quả theo kết quả.

## Hẹn chăm sóc lại

- Sau hoàn thành có nút Hẹn chăm sóc lại trên thẻ. Có nút ngay trong thông báo hoàn thành, kể cả khi bộ lọc hiện tại không hiển thị công việc vừa lưu.
- Quản lý chủ động chọn tiêu đề, nội dung, người phụ trách và ngày hẹn trong tương lai, sau đó lưu. Chọn kết quả “Cần theo dõi tiếp” không tự tạo công việc.
- Tạo việc TODO trong cùng bảng, giữ customer/source của việc trước và đặt parent_task_id. Không tin customer/source do trình duyệt tự gửi.
- Người phụ trách mới phải là MANAGER đang hoạt động. Khách bị khóa vẫn được chăm sóc; khách xóa mềm bị từ chối.
- Được liên hệ sau giải quyết ngay cả khi nguồn đổi trả/phản hồi đã đóng hoặc xóa mềm, miễn bản ghi nguồn còn tồn tại. Không thay đổi nguồn gốc. Nếu nguồn có công việc khác đang mở, trả 409 thay vì tạo thêm.
- Mỗi việc hoàn thành chỉ có một việc kế tiếp; nếu cần tiếp tục, hoàn thành việc kế tiếp rồi nối tiếp chuỗi. Công việc cũ cũng có thể được hẹn lại mà không suy đoán kết quả cũ.
- Khóa nguồn rồi khóa công việc trong transaction, dùng thứ tự khóa nhất quán với việc tạo từ nguồn. Unique index bảo vệ ở PostgreSQL. Gửi lặp/đồng thời trả 409 kèm ID việc đã tạo; không ghi đè việc hiện có. Nếu mất phản hồi mạng, đóng form/tải lại để xem việc kế tiếp đã lưu, không hoàn thành lại việc trước.

## API

- `PATCH /api/manager/care/tasks/{id}` bổ sung `outcome`, `resultNote`; bắt buộc outcome hợp lệ khi status=COMPLETED, từ chối kết quả khi chưa hoàn thành.
- `POST /api/manager/care/tasks/{id}/follow-up`: body assigneeId/title/description/dueAt, chỉ nhận việc đã hoàn thành; trả 201 với việc mới.
- DTO công việc bổ sung outcome/resultNote/parentTaskId/followUpTaskId. Chỉ Manager truy cập, không đổi API User/Admin.

## Kiểm thử

- CustomerCareIntegrationTest: bốn kết quả, thiếu/sai kết quả, ghi chú dài/trim, phiên bản, không sửa hoàn thành, dữ liệu cũ NULL, hẹn khi chưa hoàn thành, hạn quá khứ, người phụ trách khóa, khách khóa, nguồn đã đóng, giữ nguồn và quyền.
- CareSourceConcurrencyTest: hai quản lý cùng hẹn, chỉ một công việc kế tiếp, không ghi đè.
- CareOutcomePostgresTest (`CRM_POSTGRES_QA=true`): migration lặp, giữ dữ liệu cũ, tạo/hoàn thành việc kế tiếp, DTO và index thực trên PostgreSQL; rollback DDL và dữ liệu thử.
- CustomerCare.test.jsx: kết quả bắt buộc, giữ bản nháp khi lỗi, hiển thị lịch sử cũ, payload hẹn không sửa khách/nguồn, chống gửi lặp, liên kết việc trước/sau.
- Chạy `mvn test -q`, `npm test`, `npm run build`, `git diff --check`. Chưa tự thao tác trên dữ liệu thật hoặc thanh toán thật; kiểm tra trực quan với phiên Manager trên môi trường thử trước triển khai.

Giữ thay đổi local, không push/PR. Không mở rộng phạm vi nhật ký thao tác trong đợt này; ghi chú kết quả không được đưa vào audit log.
