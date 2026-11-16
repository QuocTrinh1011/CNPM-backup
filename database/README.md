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

`schema.sql` là schema khởi tạo hiện tại cho các nhóm tài khoản, bán hàng/thanh toán, voucher/CTKM, khảo sát/đánh giá, nhập kho, audit, nhân sự và sản xuất. Database mới dùng `schema.sql`; chỉ nạp `seed/seed_data.sql` cho local/demo, tuyệt đối không chạy trên production. Seed HR tạo `qlnhansu@shop.com` và sáu tài khoản nhân viên; mật khẩu mẫu `password` chỉ dành cho môi trường local/demo. Migration 025 thêm hồ sơ, nghỉ phép, chấm công và lương nhân sự; migration 026 thêm work area cùng kho nguyên liệu, công thức, sản xuất, chuyển thành phẩm sang bán và sổ biến động tồn. Migration 026 ghi tồn bán được hiện có làm số dư đầu kỳ; lịch sử báo cáo chỉ chính xác từ ngày cắt chuyển. Với database hiện có, sao lưu trước rồi xem [thứ tự migration](migrations/README.md) và chỉ chạy các script phù hợp với phiên bản đang triển khai. `maintenance/cleanup_legacy.sql` không thuộc quy trình cài đặt mặc định. Xem [quy trình cài đặt, sao lưu và phục hồi](../docs/ops/database-installation-backup-restore.md). Tài liệu tính năng nằm trong [`docs/database/`](../docs/database/).
