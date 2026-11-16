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

`schema.sql` là schema khởi tạo hiện tại cho các nhóm tài khoản, bán hàng/thanh toán, voucher/CTKM, khảo sát/đánh giá, nhập kho, audit, nhân sự và sản xuất. Database mới dùng `schema.sql`; chỉ nạp `seed/seed_data.sql` cho local/demo, tuyệt đối không chạy trên production. Seed HR tạo `qlnhansu@shop.com` và sáu tài khoản nhân viên; mật khẩu mẫu `password` chỉ dành cho môi trường local/demo. Migration 025 thêm hồ sơ, nghỉ phép, chấm công và lương nhân sự; migration 026 thêm work area, danh mục và phiếu nhập nguyên vật liệu, công thức phiên bản, kế hoạch/cấp phát sản xuất, tồn thành phẩm, yêu cầu chuyển thành phẩm sang tồn bán được và sổ biến động bất biến. Với database hiện có, sao lưu và thử trên bản sao trước, xác nhận database đã ở sau migration 025 rồi mới áp dụng migration 026; dùng [script postcondition](migrations/tests/026_warehouse_inventory_and_production_postconditions.sql) để kiểm tra cấu trúc và số dư đầu kỳ. Migration ghi tồn bán được hiện có làm số dư đầu kỳ một lần; không khôi phục được lịch sử kho trước ngày cắt chuyển. Database mới dùng schema hiện tại thay cho việc chạy lại toàn bộ migration. Với mọi database hiện hữu, xem [thứ tự và phụ thuộc migration](migrations/README.md), chỉ áp dụng các script cần thiết cho phiên bản đó. `maintenance/cleanup_legacy.sql` không thuộc quy trình cài đặt mặc định. Xem [quy trình cài đặt, sao lưu và phục hồi](../docs/ops/database-installation-backup-restore.md). Tài liệu tính năng nằm trong [`docs/database/`](../docs/database/).
