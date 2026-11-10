# Nhật ký thao tác nội bộ

## Cài đặt

Với database hiện có, chạy `database/migrations/016_audit_logs.sql` rồi khởi động lại backend. Script chỉ bổ sung bảng và index, không sửa dữ liệu nghiệp vụ. Database cài mới dùng `database/schema.sql` đã gồm bảng này. Không cần đổi `application.yml`.

- Admin: `/admin/audit-logs`, API `GET /api/admin/audit-logs` trả toàn bộ nhật ký, gồm ADMIN, MANAGER và hai thao tác đơn hàng CUSTOMER bổ sung bên dưới.
- Manager không có trang hoặc API tra cứu nhật ký. Thao tác Manager vẫn được ghi nhận để Admin tra cứu và hiển thị trong timeline hồ sơ 360°.
- CUSTOMER không được truy cập. Quyền và người thực hiện lấy từ tài khoản đã kiểm tra trong database, không nhận tên/quyền từ header tự khai báo.

## Phạm vi bản đầu

| Chức năng | Thao tác ghi nhận |
| --- | --- |
| Tài khoản nội bộ | Tạo, cập nhật (bao gồm khóa/đổi quyền/mật khẩu), xóa mềm |
| Khách hàng | Tạo, cập nhật hồ sơ, khóa/mở khóa, xóa mềm |
| Đơn hàng | Cập nhật trạng thái; xử lý chấp thuận/từ chối/hoàn tất đổi trả |
| Sản phẩm | Tạo, cập nhật, ẩn, cập nhật tồn kho |
| Voucher chung | Tạo, cập nhật và bật/tắt |
| Phản hồi | Xử lý, trả lời, ẩn/hiện, xóa mềm |
| Khảo sát | Tạo, cấu hình thưởng, phát hành/gỡ, xóa mềm |
| Công việc chăm sóc | Tạo, cập nhật/hoàn thành, tạo công việc kế tiếp (CARE_TASK) |
| Ghi chú chăm sóc | Thêm ghi chú, chỉ lưu ID khách và người ghi (CARE_NOTE) |
| Phiếu hỗ trợ | Manager tạo hộ, phân công, xử lý và trả lời/ghi chú (SUPPORT_TICKET); chỉ metadata, không lưu nội dung hội thoại |

Chỉ ghi thao tác thành công, trong cùng transaction với dữ liệu nguồn. Nếu ghi nhật ký lỗi, toàn bộ thao tác rollback. Không dựng lại lịch sử cũ. Không ghi GET, đăng nhập, webhook hoặc tác vụ nền. Các thao tác portal thông thường lấy người thực hiện từ request đã xác thực; service chăm sóc lấy từ JWT và tài khoản MANAGER đã kiểm tra trong database, nên vẫn ghi đúng khi gọi service trực tiếp. Gửi lại chuyển trạng thái đơn/đổi trả không thay đổi dữ liệu không tạo log trùng.

## Bổ sung lịch sử đơn hàng từ khách

- `CUSTOMER_CANCEL`: khách hủy đơn thành công; snapshot trạng thái trước/sau.
- `CUSTOMER_RECEIPT`: khách xác nhận nhận hàng, DELIVERED → COMPLETED.
- Lấy actor từ customer do AuthService xác thực, không lấy header tên/quyền tự khai báo.
- Dùng khóa bản ghi và transaction đơn hàng hiện có: gửi lại hoặc đồng thời chỉ ghi một lần.
- Nếu PayOS báo đã trả tiền trong lúc hủy và đơn không bị hủy, không ghi CUSTOMER_CANCEL.
- Timeline hồ sơ 360° Manager hiển thị nhãn riêng và liên kết chi tiết đúng đơn.
- Không ghi lý do hủy hay dữ liệu người nhận. Không migration mới, không ghi bù sự kiện cũ.
- Hành động customer khác chưa được bổ sung audit trong đợt này.

Bổ sung nhật ký chăm sóc dùng bảng sẵn có, không cần migration mới nếu bảng nhật ký đã được cài. Không lưu tiêu đề/nội dung công việc, ghi chú kết quả hoặc nội dung ghi chú khách hàng; chỉ lưu metadata để truy vết.

## Dữ liệu và bảo mật

- Mỗi bản ghi có ID, người thực hiện và vai trò tại thời điểm đó, chức năng, ID đối tượng, thao tác, thời gian, snapshot trước/sau được allowlist.
- Không serialize toàn bộ request/entity. Không lưu mật khẩu/hash, token, mã reset, email/điện thoại/địa chỉ khách, nội dung phản hồi, ghi chú/lý do hoặc câu trả lời khảo sát.
- Vì tối thiểu hóa dữ liệu, thay đổi nội dung hồ sơ/đánh giá/mật khẩu chỉ ghi thao tác; snapshot có thể không khác nhau. Không dùng log này để phục hồi nội dung đã sửa.
- Snapshot nhân viên không có khóa ngoại cascade; đổi tên/xóa tài khoản không làm mất tên người thực hiện cũ.
- Không có API sửa/xóa nhật ký; entity không cho cập nhật cột. Đây không phải hệ thống chống can thiệp của DBA: người có quyền database vẫn có thể sửa bảng. Chưa thêm xuất file, retention policy, chữ ký chống giả mạo hoặc hoàn tác.

## Tra cứu

Tham số tùy chọn `q`, `type`, `action`, `from`, `to`, `page`, `size`. Tìm theo tên nhân viên hoặc ID đối tượng/nhân viên; không tìm theo email khách hoặc mã đơn hiển thị. Lọc tại database trước phân trang; mặc định mới nhất, tối đa 100 bản ghi/trang. `from` bao gồm, `to` loại trừ; giao diện đổi ngày Việt Nam thành khoảng ISO tương ứng. Bộ lọc được giữ trong URL, hỗ trợ refresh/back/forward. Admin tải khi mở/lọc hoặc bấm tải lại.

## Kiểm thử

- `AuditLogIntegrationTest`: quyền, actor chống giả mạo, dữ liệu trước/sau, tối thiểu hóa thông tin, tìm/lọc/phân trang, API chỉ đọc, lỗi nghiệp vụ, chống lặp trạng thái, rollback.
- `AuditLogs.test.jsx`: tra cứu, URL/back, phân trang, retry và trạng thái rỗng trên trang Admin.
- `AuditLogPostgresTest` (bật riêng `CRM_POSTGRES_QA=true`): chạy migration hai lần và tra cứu trên PostgreSQL, rollback cả DDL và bản ghi thử; không áp dụng migration vĩnh viễn vào database đang dùng.
- Chạy `mvn test -q`, `npm test`, `npm run build`, `git diff --check`.

Trước khi triển khai nên thử trên database staging: chạy migration, thao tác một đơn/customer thử bằng Manager, kiểm tra log; Admin thấy toàn bộ, Manager không mở được trang/API nhật ký, customer bị từ chối. Không thử trên đơn hoặc giao dịch thanh toán thật.
