# Biến môi trường cho demo/nghiệm thu

Spring Boot không tự đọc file `.env`. Các giá trị dưới đây phải được đặt trong môi trường của tiến trình backend trước khi khởi động. Có thể dùng cấu hình Run/Debug của IDE hoặc đặt trực tiếp trong PowerShell. Repository đã đưa `.env` và `.env.*` vào `.gitignore`; file này là tài liệu hướng dẫn, không phải file cấu hình được backend tự nạp.

| Biến môi trường | Giá trị demo/nghiệm thu | Mặc định code | Mục đích |
| --- | --- | --- | --- |
| `PAYOS_AUTO_CANCEL_ENABLED` | `true` | `false` | Bật tự hủy đơn PayOS chưa thanh toán. |
| `PAYOS_AUTO_CANCEL_GRACE_HOURS` | `24` | `24` | Chờ 24 giờ sau khi link PayOS hết hạn trước khi tự hủy. Số nguyên từ 1 đến 720 giờ; giá trị ngoài khoảng này khiến backend không khởi động. |
| `DEV_PASSWORD_RESET_ENABLED` | `false` | `false` | Tắt nhánh mã đặt lại sáu chữ số dành cho profile development. |
| `RESEND_ENABLED` | `false` | `false` | Tắt khôi phục mật khẩu qua email và email đơn hàng trong bộ demo này. |
| `APP_PAYOS_AUTO_CANCEL_MS` | `300000` | `300000` | Chạy chu kỳ kiểm tra tự hủy mỗi 5 phút cho thuộc tính `app.payos.auto-cancel-ms`. |

Ví dụ đặt biến cho backend trong PowerShell:

```powershell
$env:PAYOS_AUTO_CANCEL_ENABLED='true'
$env:PAYOS_AUTO_CANCEL_GRACE_HOURS='24'
$env:DEV_PASSWORD_RESET_ENABLED='false'
$env:RESEND_ENABLED='false'
$env:APP_PAYOS_AUTO_CANCEL_MS='300000'
```

Các biến này chỉ có hiệu lực trong tiến trình được khởi động từ terminal đó. Khởi động lại backend sau khi thay đổi. Không đưa thông tin xác thực PayOS vào file mẫu hoặc repository. PayOS không có sandbox; COD là luồng smoke test mặc định. Chỉ thử PayOS thật sau khi người phụ trách xác nhận tài khoản, số tiền giới hạn và thời điểm thực hiện.

Cờ tự hủy mặc định `false` trong code. Bật cờ ở demo/nghiệm thu với thời gian chờ 24 giờ để kiểm tra định kỳ các đơn PayOS bỏ dở; chỉ giải phóng tồn kho và lượt voucher sau khi xác minh và hủy đơn thành công. Đơn chưa xác minh được vẫn giữ tồn kho/voucher và cần được đối chiếu. Xem thêm [hướng dẫn hoàn tiền và tự hủy](refunds-auto-cancellation.md).

## Khôi phục mật khẩu và email tùy chọn

`AuthService.passwordRecoveryEnabled()` bật khi email Resend khả dụng hoặc khi nhánh mã development được bật đúng profile. Vì vậy chỉ đặt `DEV_PASSWORD_RESET_ENABLED=false` không đủ để tắt khôi phục nếu Resend đã được cấu hình; bộ demo này đặt cả `RESEND_ENABLED=false`.

Code đã có nhánh email dùng liên kết với token ngẫu nhiên 43 ký tự, hạn mặc định 15 phút và dùng một lần; API không trả reset code trong nhánh này. Nhánh development dùng mã sáu chữ số. Để thử riêng email, xem [hướng dẫn Resend](resend-email.md), gồm khóa API, nguồn gửi, `PUBLIC_ORIGIN` HTTPS và giới hạn người nhận thử. Đợt rà soát tài liệu này không gửi email thật.
