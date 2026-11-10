# Chăm sóc khách hàng cơ bản

Manager mở `/manager/care` hoặc tab **Chăm sóc** trong hồ sơ 360°. Nút **Tạo chăm sóc** ở khách lâu chưa mua lại mở danh sách riêng của khách đó, sau đó bấm **Tạo công việc chăm sóc**.

- Ghi chú: nội dung tối đa 4.000 ký tự, lưu người ghi/tên lúc ghi/thời gian. Bản đầu chỉ thêm và xem, không sửa/xóa ghi chú đã lưu.
- Công việc: khách hàng, tiêu đề tối đa 255 ký tự, nội dung tối đa 4.000, quản lý phụ trách, hạn xử lý giờ Việt Nam.
- Trạng thái: Chưa thực hiện → Đang xử lý → Hoàn thành; có thể hoàn thành trực tiếp công việc chưa thực hiện. Không lùi trạng thái hoặc sửa công việc đã hoàn thành.
- Quá hạn = chưa hoàn thành và đã qua hạn, không có tác vụ nền. Hạn quá khứ được phép nhập để ghi nhận việc tồn đọng.
- Người phụ trách mới phải là MANAGER đang hoạt động. Công việc của nhân viên khóa/xóa/đổi quyền giữ tên hiện tại và đánh dấu không còn hoạt động; có thể chuyển người phụ trách hoặc hoàn thành.
- Khách khóa vẫn được chăm sóc; khách xóa mềm không nằm trong danh sách. Không đụng vào đơn hàng, thanh toán, tồn kho, voucher và phân nhóm.
- Tìm kiếm khách/tiêu đề/email, lọc trạng thái/người phụ trách/quá hạn và phân trang ở database. Bộ lọc giữ trong URL; bộ lọc trong hồ sơ dùng tiền tố `care_` để không ghi đè bộ lọc danh sách khách.
- Polling 5 giây chỉ màn hình mở/tab hiện; tạm ngưng khi nhập ghi chú hoặc sửa công việc. Giữ dữ liệu gần nhất khi mất mạng, có thử lại; form giữ dữ liệu khi lưu lỗi. Mỗi cập nhật kiểm tra phiên bản để không ghi đè chỉnh sửa mới của quản lý khác.

## Database và khởi động

Chạy `database/migrations/012_customer_care.sql` trên PostgreSQL của dự án rồi khởi động lại backend. Migration thêm hai bảng và index, chạy lặp an toàn, không cập nhật dữ liệu nghiệp vụ cũ. Schema khởi tạo cũng đã có hai bảng. Giữ `application.yml`.

API chỉ MANAGER:

- `GET/POST /api/manager/care/tasks`.
- `PATCH /api/manager/care/tasks/{id}`: gửi đầy đủ nội dung, người phụ trách, hạn, trạng thái và `version` của dữ liệu vừa đọc. Xung đột phiên bản trả 409.
- `GET /api/manager/care/staff?q=&page=&size=`: quản lý hoạt động, DTO không chứa mật khẩu/token.
- `GET/POST /api/manager/users/{id}/care/notes`.

Task list: `q`, `customerId`, `assigneeId`, `status` (TODO/IN_PROGRESS/COMPLETED), `overdue` (true/false), `page`, `size` (1–100). Sắp theo hạn tăng dần, cùng hạn theo ID giảm dần.

## Kiểm thử

`mvn test -q`, `npm test -- --maxWorkers=1`, `npm run build`.

PostgreSQL opt-in: bật `CRM_CARE_POSTGRES_QA=true`, chạy `mvn test -q -Dtest=CustomerCarePostgresTest`. Test **cài migration bổ sung trên database cấu hình**, sau đó rollback khách/nhân viên/ghi chú/công việc thử; sequence có thể tăng. Không chạy trên production. Không gửi tin, cấp voucher, xử lý đơn hay thanh toán thật.

## Kết quả local 06/10/2026

- Toàn bộ backend: 101 test đạt, 3 test PostgreSQL opt-in được bỏ qua mặc định.
- PostgreSQL 18.4: migration đã cài trên database local và chạy lặp an toàn; kiểm tra 15 công việc, ghi chú, phân trang, quá hạn và hoàn thành đạt. Dữ liệu thử rollback.
- 191 test frontend đạt; build thành công. Browser kiểm tra trang chăm sóc và tab hồ sơ ở 1440/768/390px, sáng/tối: 12 lượt đạt, form không tràn ngang/không lỗi JavaScript; không lưu dữ liệu qua browser QA.
- Backend local đã khởi động lại để nạp API mới. Không sửa `application.yml`; không push hoặc tạo PR.
