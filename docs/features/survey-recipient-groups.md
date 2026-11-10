# Khảo sát cho nhóm khách hàng đang lọc

## Cách dùng

1. Manager mở Khách hàng, tìm kiếm/lọc nhóm mong muốn.
2. Bấm **Tạo khảo sát cho nhóm này**. Form khảo sát mới mở kèm điều kiện nhóm,
   số khách khớp, số đủ điều kiện, số bị loại do khóa và danh sách xem trước.
3. Điền câu hỏi, cấu hình thưởng nếu cần và lưu bản nháp.
4. Kiểm tra số người nhận thực tế trong thông báo lưu, rồi phát hành riêng.

Lấy toàn bộ khách khớp điều kiện, không chỉ trang danh sách đang xem.
Chỉ lấy CUSTOMER chưa khóa/xóa. Không gửi thông báo khi tạo nháp.
Nhóm được tính lại và chốt khi lưu; preview không đặt chỗ người nhận.
Nếu nhóm rỗng lúc lưu, trả lỗi và giữ form để chỉnh lại hoặc tải preview.
Không thêm/bớt từng người trong chế độ nhóm; có thể chuyển sang hai chế độ cũ.

Sau khi lưu, người nhận cố định trong `survey_recipients`. Khách mới khớp nhóm
không được thêm khi phát hành. Khi phát hành chỉ thông báo cho người còn hoạt động,
giữ cơ chế chống thông báo trùng và kiểm tra quyền trả lời hiện có.

## API

- POST `/api/manager/surveys/recipients/preview`: body
  `{recipientFilter:{...},page:0,size:10}`; size 1–100, page không âm.
  Trả `totalMatched`, `eligibleCount`, `lockedCount`, `recipients` phân trang.
- POST `/api/manager/surveys`: bổ sung `recipientFilter` tùy chọn; khi có phải dùng
  `audience:SELECTED`, không gửi danh sách customerIds khác rỗng. Phản hồi bổ sung
  `recipientCount` là số người nhận đã chốt. Các payload ALL/SELECTED cũ giữ tương thích.
- Filter dùng chung với danh sách khách: q, stage, dormant, số đơn/giá trị min–max,
  ngày mua gần nhất từ–đến, điểm min–max và surveyed. Không dùng sort/page/size
  trong filter để giới hạn nhóm. Điểm sản phẩm không phải điểm hài lòng khảo sát.
  Bổ sung surveyId để surveyed áp dụng cho đúng khảo sát và trong đối tượng nhận
  khảo sát đó; nếu không có ID thì giữ nghĩa đã/chưa từng trả lời.

Preview trả ID/tên/email cần cho Manager, không trả mật khẩu, token hoặc đáp án.
Không trả danh sách ID người nhận qua API khảo sát User.

## Điều hướng và lỗi

- URL khảo sát giữ source_* của danh sách khách, kể cả trang/sắp xếp để quay lại.
  Chỉ các điều kiện lọc thuộc allowlist được chuyển thành recipientFilter.
- Tự mở form là cờ History state dùng một lần, không nằm trong URL. Refresh/back/
  forward không tự mở lại. Nút nhóm vẫn có để mở lại từ URL trực tiếp.
- Request preview có abort/cleanup; chuyển trang không nhận kết quả cũ. Đổi trang
  preview xóa dữ liệu cũ và khóa lưu tới khi tải thành công. Không polling preview.
- Polling Manager tạm dừng khi form mở, không ghi đè nội dung nhập. Lỗi lưu giữ form.

## Kiểm thử

- Integration: nhóm nhiều trang, khóa/xóa/tài khoản nội bộ, so khớp danh sách khách,
  kết hợp điểm/khảo sát/ngày Việt Nam, tính lại trước lưu, cố định sau lưu,
  phát hành không trùng thông báo, ngoài nhóm không xem/nộp bài, quyền MANAGER.
- Frontend: điều hướng từ bộ lọc, loading/rỗng/lỗi preview, phân trang, giữ form,
  không gửi customerIds hay phát hành tự động, số thực tế và back/forward.
- CustomerActivityPostgresTest bổ sung kiểm tra preview/ID bằng bảng tạm và rollback.
- Chạy mvn test -q, npm test, npm run build và git diff --check.

Không tạo bảng/cột/migration mới, không sửa application.yml. Chưa smoke test trực
quan đầy đủ desktop/mobile; tái sử dụng CSS Manager sáng/tối và bố cục responsive.
