# Báo cáo thu – hoàn tiền và giới hạn voucher theo khách

## Triển khai

Sao lưu và kiểm tra trên môi trường thử trước khi triển khai. Với database hiện có:

1. Áp dụng `database/migrations/010_refunds_abandoned_payos.sql` của phần sổ hoàn tiền/COD trước, nếu chưa chạy.
2. Áp dụng `database/migrations/011_cashflow_voucher_customer_limit.sql`.
3. Build và khởi động lại backend, sau đó build frontend cùng phiên bản.

Database mới dùng schema chuẩn `database/schema.sql`. Không cần chạy lại toàn bộ schema lên database đang có dữ liệu. Backend không tự chạy các file migration này. Đợt này không thêm bảng: chỉ thêm `orders.paid_at`, `store_vouchers.per_customer_limit`, ràng buộc và chỉ mục.

Không điền ngày thanh toán cho dữ liệu cũ, không sửa lượt voucher lịch sử. Không tự chạy migration hoặc thao tác thanh toán thật để kiểm thử.

## Báo cáo thu – hoàn tiền

Manager mở `/manager/reports?tab=cashflow`. Ngày bắt đầu, ngày kết thúc và nhóm ngày/tháng được giữ trong URL. Chỉ tab đang mở cập nhật nền mỗi 5 giây; khi lỗi giữ số liệu gần nhất và cho thử lại.

API chỉ dành cho MANAGER: `GET /api/manager/reports/cashflow?from=...&to=...&groupBy=day`.

- `from` bao gồm đầu kỳ, `to` không bao gồm cuối kỳ; phải gửi cả hai hoặc bỏ cả hai.
- Mặc định 30 ngày lịch gần nhất gồm hôm nay, múi giờ Việt Nam; tối đa 366 ngày. Giao diện đổi ngày kết thúc thành đầu ngày kế tiếp.
- `groupBy` nhận `day` hoặc `month`. Khoảng không phát sinh được bổ sung bằng 0.
- PayOS chỉ tính khi đã `PAID`, dùng tổng tiền đơn và mốc `paid_at` được lưu lần đầu backend xác nhận thu tiền. Webhook/đối chiếu lặp không đổi mốc này.
- COD dùng số tiền và thời điểm Manager xác nhận đã thu; chưa xác nhận thì không tính. Đơn 0 đồng không tính một lượt thu.
- Hoàn tiền chỉ tính khoản `COMPLETED` theo `processed_at`. Thu ròng bằng thu trong kỳ trừ hoàn trong kỳ, có thể âm.
- Đơn đã thu rồi hủy vẫn có khoản thu; khoản hoàn được tính ở kỳ hoàn thực tế được ghi nhận.

Đây là thời điểm **hệ thống xác nhận**, không phải khẳng định ngày giao dịch ngân hàng. PayOS cũ đã PAID nhưng thiếu mốc nằm riêng trong số liệu thiếu mốc toàn thời gian, không lấy `updated_at` hoặc lần đối chiếu hiện tại thay thế.

Top 10 sản phẩm xếp theo số lượng thuộc đơn đã thu tiền trong kỳ và chưa hủy. Giá trị dòng sản phẩm là trước giảm giá cấp đơn và hoàn tiền; chưa trừ hàng đổi trả vì chưa có dữ liệu trả theo món. Đây không phải doanh thu ròng sản phẩm.

API trả `collected`, `refunded`, `net`, `collectedOrders`, `series`, `topProducts`, `unknownMilestone`, phạm vi thời gian và `updatedAt`. Tổng hợp tiền thu/hoàn riêng, không nhân tiền theo số dòng sản phẩm.

API doanh thu cũ, trường `totalRevenue`, dashboard “Giá trị đơn chưa hủy” và chỉ số phân nhóm CRM không thay đổi.

## Giới hạn voucher cá nhân

- Voucher chung tạo mới mặc định một lượt mỗi khách; Manager có thể chọn số nguyên dương hoặc để trống để không giới hạn.
- API tạo mới thiếu `perCustomerLimit` mặc định 1; gửi `null` là không giới hạn. Voucher cũ giữ giá trị null, không tự áp giới hạn mới.
- Giảm giới hạn chỉ áp dụng lượt đặt mới, không sửa đơn hoặc lịch sử trước đó. Giao diện cảnh báo khi giảm giới hạn mã đã sử dụng.
- Lượt cá nhân là số bản ghi sử dụng của khách chưa được giải phóng (`released_at IS NULL`), gồm cả đơn chờ thanh toán.
- Xem trước và tạo đơn đều kiểm tra giới hạn. Tạo đơn khóa voucher tới hết transaction để hai đơn không cùng vượt lượt cuối.
- Lỗi tạo đơn rollback lượt; hủy đơn giải phóng đúng một lần theo cơ chế hiện có. Đổi trả/hoàn tiền không tự giải phóng lượt.
- Mã có giới hạn yêu cầu đăng nhập khi xem trước. Mã khảo sát luôn riêng đúng chủ và một lượt, không bị nới bởi cấu hình mã chung.

Ví vẫn hiện mã chung đang hiệu lực/còn tổng lượt cửa hàng khi khách đã hết lượt cá nhân, nhưng ghi “Bạn đã dùng hết lượt” và khóa nút chọn. Điều này khác với hết tổng lượt cửa hàng. Backend kiểm tra lại khi đặt hàng dù ví vừa được tải.

DTO ví bổ sung `perCustomerLimit`, `customerUses`, `customerRemaining`, `selectable`, `unavailableReason`. Lượt sử dụng được tính theo nhóm cho cả trang ví, không trả lịch sử người khác. DTO xem trước có giới hạn, lượt đang tính và lượt còn lại; DTO quản lý có cấu hình giới hạn.

## Kiểm thử

Đợt triển khai này: backend 189 test đạt, 10 test PostgreSQL tùy chọn bỏ qua; frontend 279 test đạt; build frontend và kiểm tra whitespace đạt. PostgreSQL chưa được đối chiếu vì không có cấu hình môi trường thử riêng; migration chưa chạy vào database vận hành.

Test hồi quy bao gồm ranh giới ngày Việt Nam, thu/hoàn khác kỳ, ròng âm, dữ liệu thiếu mốc, COD chưa thu, nhiều dòng sản phẩm, phân quyền báo cáo; giới hạn 1/nhiều/không giới hạn, tranh chấp lượt cuối, hủy giải phóng lượt, lỗi tạo đơn rollback, giảm giới hạn và ví hết lượt cá nhân.
