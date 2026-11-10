# Dashboard hiệu quả chăm sóc

Mở `/manager/care-dashboard` hoặc mục **Hiệu quả chăm sóc** trong Manager.

## Cách tính

- Công việc của customer chưa xóa, gồm cả customer bị khóa. Giữ công việc của người phụ trách đã khóa/xóa/đổi vai trò và ghi nhãn không còn hoạt động.
- Khoảng ngày lọc **hạn xử lý**, theo ngày Việt Nam, gồm cả ngày cuối. Không phải ngày tạo hay ngày hoàn thành. Mặc định toàn thời gian.
- Tổng, chưa thực hiện, đang xử lý, hoàn thành là trạng thái hiện tại. Quá hạn là công việc chưa hoàn thành có hạn trước thời điểm xem, là tập con của tổng.
- Mỗi số đếm mở danh sách công việc với cùng ngày/người phụ trách và bộ lọc tương ứng; lọc trước phân trang.
- Khách cần chăm sóc: customer chưa xóa có đơn COMPLETED, ngày đặt gần nhất trong những đơn này cách ngày hiện tại ít nhất 30 ngày lịch Việt Nam, không có công việc TODO/IN_PROGRESS. Đơn nhiều dòng không nhân đôi customer. Khách chưa mua không tính.
- Phần khách cần chăm sóc độc lập bộ lọc công việc, có phân trang và liên kết hồ sơ/tạo chăm sóc.
- Không suy luận tác động doanh thu, lịch sử quá hạn hoặc tỷ lệ chuyển đổi từ dữ liệu chưa được lưu.

## API

- `GET /api/manager/care/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD&assigneeId=...`
- `GET /api/manager/care/dormant?page=0&size=10`
- Danh sách `/api/manager/care/tasks` thêm `from`, `to` cùng nghĩa hạn xử lý.

Chỉ MANAGER; DTO không chứa mật khẩu/token. Không thêm schema. Dùng polling hiện có 5 giây, chỉ tab đang hiển thị, không chồng request; dữ liệu cũ giữ khi lỗi mạng và có thử lại. Đổi bộ lọc bỏ qua response cũ.

## Kiểm thử

Backend integration: tổng/phân loại, lọc ngày và drill-down, quyền, khách cần chăm sóc/loại công việc mở/customer xóa, phân trang. PostgreSQL opt-in: `CRM_CARE_POSTGRES_QA=true mvn test -q -Dtest=CustomerCarePostgresTest` (dữ liệu thử rollback, migration chăm sóc hiện có được chạy idempotent).

Frontend: `npm test`, `npm run build`. Browser QA với API giả lập: `QA_CARE_DASHBOARD=true`, script `frontend/scripts/portal-responsive-check.cjs`; 1440/768/390px, sáng/tối. Không tạo đơn hay thanh toán thật.

Kết quả local 06/10/2026: toàn bộ `mvn test -q` qua, kiểm thử bổ sung CustomerCareIntegrationTest (7) và PostgreSQL (1) qua; `npm test` 193/193 qua, build qua; 6 kiểm tra responsive qua. Backend đã khởi động lại cổng 8082; sản phẩm trả 200, dashboard không đăng nhập trả 401. Không sửa application.yml, không commit/push/PR.
