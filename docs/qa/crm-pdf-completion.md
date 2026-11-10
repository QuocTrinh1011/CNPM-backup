# CRM: bổ sung từ tài liệu yêu cầu

## Đã có và giữ nguyên

- Hồ sơ khách 360°, lịch sử đơn/địa chỉ/đánh giá/khảo sát/voucher.
- Phân nhóm vòng đời, chỉ số đơn COMPLETED và bộ lọc trước phân trang.
- Phiếu hỗ trợ User/Manager, người phụ trách, trao đổi công khai/nội bộ.
- Công việc chăm sóc, kết quả, việc tiếp theo, nhắc hạn và nhật ký.
- Báo cáo mua lại, giá trị đơn hoàn thành, khách lâu chưa mua.

## Bổ sung lần này

- `GET /api/manager/users`: `minRating`, `maxRating` (1–5), `surveyed` tùy chọn.
  Điểm trung bình của feedback chưa xóa, bao gồm feedback ẩn; khách chưa có
  đánh giá không khớp khoảng điểm. Không phải CSAT, không suy diễn đáp án khảo sát.
  `surveyed=true`: từng nộp ít nhất một khảo sát; false: chưa từng nộp.
  Lịch sử khảo sát đã xóa vẫn được tính. Kết hợp các bộ lọc bằng AND, trước phân trang.
- Hồ sơ 360° có tab Lịch sử hoạt động, endpoint `/profile/activities` phân trang.
  Tổng hợp thời điểm tạo đơn, gửi feedback, nộp khảo sát, tạo phiếu hỗ trợ,
  tạo/hoàn thành công việc và các thao tác order/feedback/support có audit.
  Không trả nội dung audit JSON, đáp án hoặc trao đổi riêng.
  Không suy đoán các chuyển trạng thái cũ từ trạng thái hiện tại/updated_at.
  Liên kết đơn mở component chi tiết hiện có.
  Bổ sung hai sự kiện customer có audit: hủy đơn thành công và xác nhận nhận hàng;
  lưu cùng transaction đơn hàng, gửi lặp/đồng thời không ghi trùng. Không ghi bù lịch sử.
- Báo cáo retention thêm `resolvedSupportTickets`: số phiếu RESOLVED toàn thời gian,
  chỉ customer chưa xóa, bao gồm khóa; mỗi phiếu tính một lần, không phải số khách.
  Bấm số đếm mở danh sách phiếu RESOLVED.

## Giới hạn

Không tạo bảng/cột/migration mới trong đợt này. Cần các migration trước đó
(audit, chăm sóc, support tickets) đã được triển khai trước khi chạy backend mới.
Không tự chạy migration vào dữ liệu thật. Không tự phát voucher hay tạo chiến dịch.
Đối tượng khảo sát vẫn dùng tính năng chọn customer hiện có.

## Kiểm tra hồi quy

- CustomerProfileIntegrationTest: timeline đúng khách, phân trang, không tự sinh
  lịch sử, quyền MANAGER, lỗi ID/phân trang, điểm trung bình/feedback xóa/ẩn,
  khảo sát cũ và lọc trước phân trang.
- RetentionReportIntegrationTest: phiếu đã giải quyết tính theo phiếu, loại
  customer xóa/tài khoản nội bộ, vẫn tính khách khóa; không tính phiếu mở.
- CustomerActivityPostgresTest: truy vấn timeline, điểm, khảo sát và số phiếu
  trên PostgreSQL với bảng temporary và transaction rollback, không sửa bảng public.
  Chạy opt-in bằng CRM_POSTGRES_QA=true; không chạy migration vào DB thật.
- Frontend: URL bộ lọc và xóa bộ lọc, timeline mở trực tiếp/liên kết đơn,
  số phiếu mở đúng bộ lọc RESOLVED; giữ test polling/chuyển trang hiện có.
- Chưa smoke test giao diện với backend đang chạy hoặc kiểm tra hình ảnh
  từng kích thước màn hình; giao diện tái sử dụng CSS responsive/sáng tối hiện có.
