# Sổ hoàn tiền và tự hủy PayOS

## Triển khai an toàn

1. Sao lưu database, kiểm thử trên bản sao và đối soát các đơn đang mở.
2. Chạy `database/migrations/010_refunds_abandoned_payos.sql` trước khi khởi động backend mới. File chỉ thêm một bảng `order_refunds` và các cột/chỉ mục liên quan; không tạo khoản hoàn hoặc xác nhận COD cho dữ liệu cũ.
3. Khởi động backend với `DB_PASSWORD`, `JWT_SECRET` hợp lệ. Hibernate `validate` yêu cầu schema đã cập nhật.
4. Tự hủy **mặc định tắt trong code**. Với cấu hình demo/nghiệm thu, bật tự hủy sau khi đã kiểm tra schema và dữ liệu. Spring Boot không tự đọc file `.env`; đặt biến trong môi trường của tiến trình backend, rồi khởi động lại. Cấu hình này bật kiểm tra định kỳ các đơn PayOS bỏ dở; chỉ giải phóng tồn kho và lượt voucher sau khi xác minh và hủy đơn thành công. Đơn chưa xác minh được vẫn giữ tồn kho/voucher và cần được đối chiếu. Tham khảo [mẫu biến môi trường demo/nghiệm thu](../ops/env-demo.md):

```powershell
$env:PAYOS_AUTO_CANCEL_ENABLED='true'
$env:PAYOS_AUTO_CANCEL_GRACE_HOURS='24'
$env:DEV_PASSWORD_RESET_ENABLED='false'
$env:APP_PAYOS_AUTO_CANCEL_MS='300000'
```

Không cần sửa `application.yml`. `APP_PAYOS_AUTO_CANCEL_MS` tương ứng thuộc tính `app.payos.auto-cancel-ms` và mặc định là 300000 ms; scheduler kiểm tra định kỳ để xét hủy sau thời gian chờ 24 giờ tính từ hạn mới nhất của đơn/link/lần thử thanh toán. `PAYOS_AUTO_CANCEL_GRACE_HOURS` phải là số nguyên từ 1 đến 720 giờ; giá trị ngoài khoảng này khiến backend không khởi động. Muốn tắt, đặt cờ thành `false` rồi khởi động lại. Các giá trị trên là cấu hình demo/nghiệm thu, không phải mặc định code. Không bật ở database thật chỉ để thử nghiệm. Không áp dụng script vá kho hoặc suy đoán tiền đã thu/hoàn cho đơn cũ.

## Hoàn tiền thủ công

- Manager mở **Hoàn tiền** hoặc chi tiết đơn. Hệ thống không tự chuyển tiền; người xử lý phải kiểm chứng chuyển tiền bên ngoài.
- Hủy đơn PayOS đã trả tiền tạo một khoản chờ hoàn toàn bộ. Tiền về sau hủy qua webhook/đồng bộ/đối chiếu cũng tạo đúng một khoản tự động.
- Với đổi trả đã chấp thuận/hoàn tất, có thể tạo nhiều khoản hoàn một phần. Tổng đang chờ và đã hoàn không vượt số tiền được xác nhận đã thu. Không nhập số thập phân VND.
- Xác nhận đã hoàn bắt buộc mã chuyển hoàn và ghi chú; từ chối bắt buộc lý do. Khoản đã xử lý không sửa/xóa. Gửi lại cùng nội dung không tạo thêm thao tác; nội dung khác bị từ chối.
- Khoản tự động bị từ chối không tự phát sinh lại khi gửi lại thao tác hủy. Manager có thể chủ động tạo khoản mới trong số tiền còn được hoàn.
- Trạng thái `PARTIAL` vẫn hiển thị tổng đang chờ nếu còn khoản chưa xử lý. Khách chỉ thấy tổng hợp của đơn mình, không thấy ghi chú nội bộ/mã ngân hàng/người thực hiện.
- Giữ nguyên `PAID`, tồn kho, lượt voucher và các chỉ số CRM/doanh thu khi xử lý khoản hoàn.

### Xác nhận thu COD

Không suy đoán đã thu từ trạng thái giao hàng. Chỉ Manager xác nhận toàn bộ giá trị đơn COD đã giao/hoàn thành, kèm ghi chú. Hệ thống lưu số tiền, thời điểm, người xác nhận rồi cập nhật thanh toán `PAID`. Gửi lại không ghi nhận thu thêm. Chưa hỗ trợ thu một phần/công nợ; chưa có thao tác sửa/xóa chứng cứ thu.

## Tự hủy và đối chiếu PayOS

- QR vẫn có hạn 15 phút. Mốc bắt đầu xét tự hủy là **24 giờ sau hạn mới nhất** của đơn/link/lần thử thanh toán, không phải sau ngày đặt đơn. Tạo lại QR hợp lệ kéo dài mốc tương ứng.
- Chỉ xét đơn PayOS `PENDING`/`PENDING_PAYMENT` chưa thanh toán. Không tự hủy COD hoặc đơn đã xác nhận.
- Scheduler chạy mỗi 5 phút, đọc ID từng lô và xử lý transaction riêng từng đơn. Một đơn lỗi không ngăn đơn sau; nhiều tiến trình dựa vào khóa đơn và trạng thái hiện tại để chống lặp.
- Kiểm tra tất cả link đã biết, kể cả link cũ; link còn hiệu lực phải hủy rồi kiểm tra lại. Timeout kết nối 5 giây, đọc 10 giây. Không có chứng cứ rõ ràng thì không giải phóng kho/voucher.
- Đã trả đủ: cập nhật thanh toán, không tự hủy. Thiếu thông tin, tiền một phần/thừa, nhiều link đã trả, dữ liệu lệch hoặc lỗi mạng: giữ đơn và cảnh báo **Thanh toán cần kiểm tra**.
- Manager lọc cảnh báo trong Đơn hàng và bấm **Đối chiếu lại PayOS** tại chi tiết. Không có nút bỏ cảnh báo/cưỡng ép hủy. Chỉ đối chiếu thành công mới gỡ cảnh báo; tiền một phần/thừa cần đối soát thực tế bên ngoài, không tự coi là hoàn tất.
- Webhook có thể đến muộn sau khi link vừa được hủy. Giữ chứng cứ đã thu và tạo khoản hoàn; không trừ lại kho đã giải phóng.

## API Manager

- `GET /api/manager/refunds?status=PENDING&q=&page=0&size=20` và `GET /api/manager/orders/{id}/refunds`.
- `POST /api/manager/orders/{id}/refunds`: `reasonType` (`CANCEL`/`RETURN`), `amount`, `note`, `requestKey` duy nhất cho mỗi ý định tạo. Giữ lại khóa này khi gửi lại do mất mạng; không dùng tiền tố `AUTO_`.
- `POST /api/manager/refunds/{id}/complete`: `bankReference`, `note`; `/reject`: `note`.
- `PATCH /api/manager/orders/{id}/cod-collection`: `note`.
- `POST /api/manager/orders/{id}/payment/reconcile`: không cần body, không tự hủy đơn.
- Danh sách/tổng hợp đơn nhận thêm `refundStatus=NONE|PENDING|PARTIAL|FULL`, `paymentReview=true|false`. Lọc trước phân trang.

Chỉ MANAGER đang hoạt động được truy cập; không truyền ID nhân viên từ trình duyệt để xác định người thao tác. Nhật ký lưu thao tác hoàn tiền/COD, không đưa mã chuyển hoàn và ghi chú tự do vào audit.

## Giới hạn

Không nhập kho đổi trả, không thay báo cáo, không chuyển tiền thật, không xử lý hồi tố dữ liệu cũ. Migration được cung cấp để người triển khai chạy; không tự áp dụng vào database đang sử dụng. Khi khôi phục bản backend cũ, không xóa bảng/cột tài chính đã có dữ liệu.
