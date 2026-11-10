# Báo cáo kết quả chăm sóc

Manager mở `/manager/care-dashboard?tab=outcomes`. Tab mặc định `overview` vẫn dùng quy tắc hạn xử lý cũ. Chuyển tab xóa khoảng ngày nhưng giữ người phụ trách.

## Nguồn và cách tính

- Chỉ tính công việc `COMPLETED` của customer chưa xóa, bao gồm customer bị khóa.
- Mỗi công việc tính một lần, kể cả công việc chăm sóc kế tiếp; không phải số khách duy nhất.
- Kết quả hợp lệ: `CONTACTED`, `UNREACHABLE`, `RESOLVED`, `NEEDS_FOLLOW_UP`. Trống hoặc khác bốn giá trị này là chưa ghi nhận.
- Tổng hoàn thành = đã ghi nhận + chưa ghi nhận. Tổng bốn nhóm = đã ghi nhận.
- Tỷ lệ đã giải quyết = RESOLVED / đã ghi nhận × 100, làm tròn HALF_UP hai chữ số; mẫu số 0 trả 0.
- Phân bố kết quả dùng cùng mẫu số đã ghi nhận. Không diễn giải thành tỷ lệ giải quyết phiếu hỗ trợ hoặc tăng doanh thu.
- Giữ lịch sử người phụ trách bị khóa, xóa mềm hoặc đổi quyền; hiển thị “Không còn hoạt động”.

## API và bộ lọc

`GET /api/manager/care/outcomes?from=2026-10-01&to=2026-10-15&assigneeId=123`

Chỉ MANAGER truy cập. Ngày có dạng `YYYY-MM-DD`, lọc `completed_at` theo ngày Việt Nam: đầu ngày bắt đầu được tính, đầu ngày sau ngày kết thúc không được tính. Không truyền ngày nghĩa là toàn thời gian, gồm công việc thiếu ngày hoàn thành. Có bất kỳ giới hạn ngày nào thì công việc thiếu ngày hoàn thành bị loại. Khoảng ngày ngược trả lỗi 400.

Danh sách công việc hỗ trợ thêm `outcome`, `completedFrom`, `completedTo`; lọc trước phân trang. `outcome` nhận bốn kết quả hợp lệ hoặc `RECORDED`, `UNRECORDED`. Các bộ lọc này chỉ lấy công việc hoàn thành. `from`/`to` cũ vẫn là hạn xử lý, có thể kết hợp độc lập với ngày hoàn thành. Liên kết từ số đếm báo cáo dùng các tham số mới, không dùng hạn xử lý.

Chỉ tab đang mở tải và polling 5 giây. Giữ dữ liệu khi lỗi cập nhật nền; đổi điều kiện không cho dữ liệu cũ ghi đè. Không ghi hoặc sửa dữ liệu lịch sử.

## Kiểm tra

- `CareOutcomeReportIntegrationTest`: số liệu, phân quyền, ngày Việt Nam, thiếu ngày, kết quả không hợp lệ, nhân viên không hoạt động và đối chiếu danh sách.
- `CareOutcomeReportPostgresTest`: bật bằng `CRM_POSTGRES_QA=true`, dùng PostgreSQL đang cấu hình; dữ liệu thử rollback. Không tạo schema hoặc chạy migration; bỏ qua nếu schema chưa có các trường chăm sóc từ tính năng trước.
- `CareOutcomes.test.jsx`, `CustomerCare.test.jsx`, `CareDashboard.test.jsx`: drilldown, URL/back-forward, lọc ngày riêng biệt, polling, request chậm, lỗi và dữ liệu rỗng.

Tính năng này không thêm bảng, cột, migration hay thay đổi `application.yml`. Sau cập nhật code cần khởi động lại backend để nạp API mới.
