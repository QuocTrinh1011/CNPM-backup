# Đánh giá theo đơn và thưởng khảo sát

Chạy `database/migrations/006_review_survey_rewards.sql` trên PostgreSQL trước khi khởi động backend mới. Script chạy trong transaction, chạy lại được; giữ nguyên feedback cũ với `order_id` rỗng. Không chạy lại migration feedback cũ sau migration này vì ràng buộc customer/product đã được thay bằng order/product.

- Customer chỉ gửi đánh giá khi đơn `COMPLETED`, qua `POST /api/products/{id}/feedback` với `{orderId,rating,comment}`. `GET /api/orders/{id}/reviews` trả quyền đánh giá và trạng thái đã đánh giá từng sản phẩm cho chủ đơn.
- Admin tạo khảo sát với trường `reward` hoặc đổi cấu hình bằng `PATCH /api/admin/surveys/{id}/reward`. Các trường: `enabled`, `discountType`, `discountValue`, `minOrderAmount`, `maxDiscountAmount`, `validDays`.
- `store_vouchers` đồng thời lưu bản ghi cấp thưởng: `reward_survey_id` + `owner_customer_id` duy nhất. Giá trị và thời hạn là bản chụp lúc cấp, không sửa theo cấu hình khảo sát về sau. Mã thưởng không nằm trong trang quản lý mã chung.
- Bài trả lời và voucher được lưu cùng transaction, khóa khảo sát khi cấp. Không cấp bù bài đã gửi trước khi bật thưởng. Gỡ/xóa khảo sát không thu hồi mã đã cấp.
- `GET /api/customers/me/vouchers` chỉ trả ví của customer đăng nhập. Cả validate và checkout kiểm tra chủ mã. Mã riêng một lượt, hủy đơn hoàn lượt theo cơ chế voucher hiện tại, không gia hạn mã.
- Giao diện: `/tai-khoan/voucher`, chọn mã tại checkout và bấm Áp dụng; đánh giá tại chi tiết đơn hoàn thành. Không thanh toán thật trong kiểm thử.

Kiểm thử: `mvn test -q`, `npm test`, `npm run build`. Test tích hợp tự động dùng H2 chế độ PostgreSQL, không dùng dữ liệu production.
