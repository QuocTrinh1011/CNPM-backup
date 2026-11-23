# Cấu trúc database

```text
database/
├── schema.sql                 Schema PostgreSQL khởi tạo hiện tại
├── seed/
│   └── seed_data.sql           Dữ liệu minh họa và catalog ICONDENIM
├── migrations/
│   ├── README.md              Thứ tự chạy, mô tả và phụ thuộc
│   └── NNN_*.sql              Migration đánh số theo thứ tự
├── maintenance/
│   └── cleanup_legacy.sql     Dọn cấu trúc/dữ liệu cũ khi cần
└── backup/
    └── README.md              Ghi chú về backup và restore
```

`schema.sql` là schema khởi tạo hiện tại cho các nhóm tài khoản, bán hàng/thanh toán, voucher/CTKM, khảo sát/đánh giá, nhập kho, audit, nhân sự và sản xuất. Database mới dùng `schema.sql`; chỉ nạp `seed/seed_data.sql` cho local/demo, tuyệt đối không chạy trên production. Seed chứa tài khoản và mật khẩu mẫu; nếu lỡ nạp vào môi trường thật, đổi ngay mật khẩu của tất cả tài khoản mẫu. Script seed dùng lệnh meta-command của `psql`, đọc `SPRING_PROFILES_ACTIVE` và dừng nếu danh sách profile có `prod`; không chạy file này trong công cụ chỉ nhận SQL như pgAdmin. Tài khoản mẫu gồm Admin, Manager bán hàng/kho/nhân sự, nhân viên bán hàng/kho và khách hàng; tất cả dùng mật khẩu `password` trong local/demo. Seed cũng tạo đơn COD, phiếu nhập sản phẩm/nguyên liệu, lịch sử chấm công/lương mẫu và các yêu cầu HR/kho đang chờ xử lý để kiểm thử.

Seed chính cũng thêm tối đa 358 sản phẩm duy nhất từ 360 card trên 12 trang danh mục công khai ICONDENIM, vào 7 loại sản phẩm. Hai tên bị lặp được gộp màu; khoảng giá biến thể lấy mức thấp nhất quan sát được. Tên, giá, màu và ảnh là snapshot tại thời điểm thu thập; size, tồn kho và mô tả là dữ liệu kiểm thử. Seed chỉ thêm loại Set đồ nếu thiếu và chỉ thêm sản phẩm chưa có cùng tên, không xóa hay sửa dữ liệu hiện có.

```powershell
psql --host localhost --port 5432 --username postgres --dbname cnpm --set ON_ERROR_STOP=1 --file database/seed/seed_data.sql
```

Migration 025 thêm hồ sơ, nghỉ phép, chấm công và lương nhân sự. Migration 026 thêm work area, danh mục và phiếu nhập nguyên vật liệu, công thức phiên bản, kế hoạch/cấp phát sản xuất, tồn thành phẩm, yêu cầu chuyển thành phẩm sang tồn bán được và sổ biến động bất biến. Với database hiện có, sao lưu và thử trên bản sao trước, xác nhận database đã ở sau migration 025 rồi mới áp dụng migration 026; dùng [script postcondition](migrations/tests/026_warehouse_inventory_and_production_postconditions.sql) để kiểm tra cấu trúc và số dư đầu kỳ. Migration ghi tồn bán được hiện có làm số dư đầu kỳ một lần; không khôi phục được lịch sử kho trước ngày cắt chuyển.

Với database hiện có, sao lưu trước rồi xem [thứ tự migration](migrations/README.md) và chỉ chạy các script phù hợp với phiên bản đang triển khai. Migration 027 bỏ bảng `admins` cũ và cột `feedback.admin_id`; tài khoản Admin trong `customers` cùng `audit_logs` được giữ nguyên. Database mới dùng `schema.sql` thay cho việc chạy lại toàn bộ migration. `maintenance/cleanup_legacy.sql` không thuộc quy trình cài đặt mặc định. Xem [quy trình cài đặt, sao lưu và phục hồi](../docs/ops/database-installation-backup-restore.md). Tài liệu tính năng nằm trong [`docs/database/`](../docs/database/).

Migration 028 tách giờ tăng ca ban đêm trên ngày thường, ngày nghỉ hằng tuần và ngày lễ; các bản ghi chấm công cũ được giữ với 0 giờ ở ba cột mới. Database mới đã có các cột này trong `schema.sql`. Xem thêm hướng dẫn payroll trong [`backend/README.md`](../backend/README.md).
