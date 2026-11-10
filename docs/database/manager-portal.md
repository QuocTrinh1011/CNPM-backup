# Tách ba portal

1. Sao lưu PostgreSQL, chạy `database/migrations/002_manager_portal.sql` trên database hiện tại trước khi khởi động backend mới. Database mới dùng `database/schema.sql`, đã có cấu trúc portal.
2. Giữ nguyên application.yml. Nếu đã cấu hình CORS_ORIGINS, bổ sung `http://localhost:5175` cùng các origin đang dùng.
3. Trong frontend chạy ba terminal: `npm run dev:user` (5173), `npm run dev:admin` (5174), `npm run dev:manager` (5175). Backend dùng chung cấu hình hiện tại.
4. Đăng nhập admin hiện có tại `/admin/login`, mở Tài khoản nội bộ, tạo MANAGER với mật khẩu riêng, sau đó đăng nhập `/manager/login`. Không có mật khẩu quản lý mặc định.

API vận hành chuyển từ `/api/admin/*` sang `/api/manager/*`. Admin chỉ còn `/auth`, `/accounts`, `/overview`, GET `/products`, GET `/suppliers`. Client tích hợp cũ cần đổi namespace và tài khoản phù hợp; không dùng token ADMIN thay MANAGER.

Xóa tài khoản nội bộ là xóa mềm, giữ email. Khách hàng không được chuyển thành nhân viên. Nhà cung cấp ngừng hoạt động vẫn giữ liên kết sản phẩm lịch sử. Khảo sát chọn riêng không công khai danh sách người nhận; thông báo gửi trong web, không email.
