# Cấu trúc database

```text
database/
├── schema.sql                 Schema PostgreSQL khởi tạo hiện tại
├── seed/
│   └── seed_data.sql          Dữ liệu minh họa
├── migrations/
│   ├── README.md              Thứ tự chạy, mô tả và phụ thuộc
│   └── NNN_*.sql              Migration đánh số theo thứ tự
├── maintenance/
│   └── cleanup_legacy.sql     Dọn cấu trúc/dữ liệu cũ khi cần
└── backup/
    └── README.md              Ghi chú về backup và restore
```

`schema.sql` là schema khởi tạo hiện tại cho các nhóm tài khoản, bán hàng/thanh toán, voucher/CTKM, khảo sát/đánh giá, nhập kho, audit, nhân sự và sản xuất. Database mới dùng `schema.sql`; chỉ nạp `seed/seed_data.sql` cho local/demo, tuyệt đối không chạy trên production. Seed chứa tài khoản và mật khẩu mẫu; nếu lỡ nạp vào môi trường thật, đổi ngay mật khẩu của tất cả tài khoản mẫu. Script seed dùng lệnh meta-command của `psql`, đọc `SPRING_PROFILES_ACTIVE` và dừng nếu danh sách profile có `prod`; không chạy file này trong công cụ chỉ nhận SQL như pgAdmin. Seed HR tạo `qlnhansu@shop.com` và sáu tài khoản nhân viên; mật khẩu mẫu `password` chỉ dành cho local/demo.

Migration 025 thêm hồ sơ, nghỉ phép, chấm công và lương nhân sự. Migration 026 thêm work area, danh mục và phiếu nhập nguyên vật liệu, công thức phiên bản, kế hoạch/cấp phát sản xuất, tồn thành phẩm, yêu cầu chuyển thành phẩm sang tồn bán được và sổ biến động bất biến. Với database hiện có, sao lưu và thử trên bản sao trước, xác nhận database đã ở sau migration 025 rồi mới áp dụng migration 026; dùng [script postcondition](migrations/tests/026_warehouse_inventory_and_production_postconditions.sql) để kiểm tra cấu trúc và số dư đầu kỳ. Migration ghi tồn bán được hiện có làm số dư đầu kỳ một lần; không khôi phục được lịch sử kho trước ngày cắt chuyển.

Với database hiện có, sao lưu trước rồi xem [thứ tự migration](migrations/README.md) và chỉ chạy các script phù hợp với phiên bản đang triển khai. Database mới dùng `schema.sql` thay cho việc chạy lại toàn bộ migration. `maintenance/cleanup_legacy.sql` không thuộc quy trình cài đặt mặc định. Xem [quy trình cài đặt, sao lưu và phục hồi](../docs/ops/database-installation-backup-restore.md). Tài liệu tính năng nằm trong [`docs/database/`](../docs/database/).
