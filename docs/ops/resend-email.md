# Email Resend trên Render

Website vẫn dùng `https://anhlonshop.onrender.com`; tên miền website độc lập với tên miền gửi email.

## Biến môi trường backend

- `RESEND_API_KEY`: khóa Sending access, chỉ nhập trong Render Environment. Không commit, không gửi vào chat.
- `RESEND_ENABLED=true`.
- `RESEND_FROM=ANH LỚN SHOP <onboarding@resend.dev>`.
- `RESEND_TEST_MODE=true` (mặc định).
- `RESEND_TEST_RECIPIENT`: email đăng ký tài khoản Resend.
- `PUBLIC_ORIGIN=https://anhlonshop.onrender.com`.
- Giữ `DEV_PASSWORD_RESET_ENABLED=false` ở bản deploy.

Chế độ thử chỉ gửi nếu email thật của customer trùng email thử; không chuyển email khách khác về hộp thư thử. API quên mật khẩu trả thông báo chung cho email không tồn tại/không được gửi. Chỉ thử khôi phục bằng customer có đúng email đăng ký Resend. Chưa xác minh tên miền thì không gửi được tới mọi khách hàng.

Liên kết đặt lại dùng token ngẫu nhiên 256 bit, hạn mặc định 15 phút; DB chỉ lưu SHA-256. Token nằm trong fragment URL (không vào access log), được xóa khỏi thanh địa chỉ sau khi form đọc. Không lưu token vào session/localStorage. Refresh form cần mở lại email. Mỗi customer có thời gian chờ 60 giây giữa hai lần cấp; cấp mới làm mất hiệu lực liên kết cũ. Đổi mật khẩu khóa customer trong transaction, đánh dấu token đã dùng và thu hồi refresh token. Không log link, token, API key hoặc nội dung phản hồi provider.

Thông báo tạo đơn, trạng thái giao hàng, hủy/hoàn thành và đổi trả được gửi sau commit bằng hàng đợi giới hạn trong bộ nhớ. Rollback không gửi email. Có idempotency key theo thông báo. Lỗi/đầy hàng đợi không làm thất bại đơn hàng; thông báo trong web vẫn còn. Đây là best-effort, chưa phải outbox bền vững: restart có thể làm mất email đang chờ, chưa có chức năng tự phát lại. Không tự gửi bù các thông báo lịch sử.

## Bật thật sau này

Xác minh tên miền thuộc sở hữu trên Resend, đổi `RESEND_FROM` sang địa chỉ miền đó, đặt `RESEND_TEST_MODE=false`. Không dùng tên miền Render chia sẻ để xác minh người gửi. Trước khi bật gửi đại trà cần rà soát chống lạm dụng/rate limit toàn hệ thống và giám sát hạn mức.

## Kiểm tra

Chạy `mvn test -q`, `npm test`, `npm run build`. Test tự động dùng mail mock, không gửi email thật. Sau deploy, thử quên mật khẩu trên tài khoản demo đúng email được phép; chủ tài khoản tự mở link và nhập mật khẩu mới. Kiểm tra nhận một email đơn khi thao tác trên đơn thử; không tạo/hủy đơn thật để thử.
