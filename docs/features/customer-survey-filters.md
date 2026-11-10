# Lọc khách theo khảo sát cụ thể

## Hành vi

- Manager → Khách hàng → Bộ lọc nâng cao: tìm/chọn khảo sát, chọn đã trả lời,
  chưa trả lời hoặc tất cả người nhận. Danh sách khảo sát có tìm kiếm, phân trang,
  nhãn bản nháp/đã gỡ và đã xóa; vẫn tra cứu được lịch sử.
- Khi có surveyId, chỉ tính customer thuộc đối tượng khảo sát (ALL: toàn bộ
  customer chưa xóa; SELECTED: trong survey_recipients). Không suy diễn đối tượng
  từ số thông báo đã gửi, không lấy khách ngoài nhóm làm “chưa trả lời”.
- surveyed=true/false kiểm tra response của đúng khảo sát được chọn. Trả lời khảo
  sát khác không ảnh hưởng. surveyed trống trả toàn bộ người nhận thuộc bộ lọc khác.
- Không có surveyId thì surveyed giữ nguyên nghĩa cũ: đã/chưa từng nộp khảo sát.
- Khách khóa vẫn tra cứu được; khi tạo khảo sát cho nhóm, preview/save tiếp tục
  loại khách khóa và chốt ID người nhận theo luồng hiện có.

## API và tương thích

- GET /api/manager/users thêm surveyId tùy chọn; nhóm, q, điểm và các điều kiện
  mua hàng kết hợp AND tại database trước phân trang.
- RecipientFilter trong preview/create khảo sát thêm surveyId tùy chọn, cùng
  validation và cùng truy vấn với danh sách khách. Không thay các payload cũ.
- GET /api/manager/surveys/filter-options?q=&page=0&size=10&selectedId=...
  trả options phân trang (id/title/status/deleted) và metadata selected riêng,
  giúp khôi phục lựa chọn dù không nằm trên trang tìm kiếm hiện tại.
- SurveyId không hợp lệ/không tồn tại trả 400, không tự bỏ lọc hay trả nhóm rỗng.
  Không trả đáp án khảo sát, mật khẩu, token hoặc danh sách người nhận qua lookup.
- Chỉ MANAGER được gọi. Giữ API User, Admin và quy tắc phát hành/thưởng hiện có.

## Giao diện và kiểm tra

- surveyId/surveyed giữ trong URL, refresh/back/forward và quay lại từ 360°;
  đổi lọc về trang đầu, xóa bộ lọc xóa cả surveyId.
- Nút tạo khảo sát cho nhóm chuyển tiếp source_surveyId; bản xem trước ghi rõ ID
  khảo sát nguồn, tính đúng người nhận và không trộn với khảo sát mới đang tạo.
- Lookup có abort/cleanup, loading/lỗi/thử lại; lỗi không tự xóa lựa chọn.
- Test: hai khảo sát khác nhau, nhóm chọn riêng/ALL, người ngoài nhóm, lịch sử
  đã xóa, group preview/create, ID sai, quyền, tìm kiếm/phân trang/selected metadata,
  URL, lỗi, stale response; PostgreSQL dùng bảng tạm và transaction rollback.
- Không bảng/cột/migration mới; không sửa application.yml; không push/PR.
- Chưa kiểm tra trực quan đầy đủ từng kích thước màn hình; dùng CSS Manager
  sáng/tối và bố cục responsive sẵn có.
