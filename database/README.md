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

`schema.sql` là schema khởi tạo hiện tại và khai báo đủ 40 bảng của các nhóm tài khoản, bán hàng/thanh toán, voucher/CTKM, khảo sát/đánh giá, nhập kho, audit và nhân sự. Database mới dùng `schema.sql`; chỉ nạp `seed/seed_data.sql` cho local/demo, tuyệt đối không chạy trên production. Seed HR tạo `qlnhansu@shop.com` và sáu tài khoản nhân viên; mật khẩu mẫu `password` chỉ dành cho môi trường local/demo. Migration 025 thêm bảng hồ sơ nhân viên, nghỉ phép, chấm công, kỳ lương, phiếu lương và cấu hình lương theo hiệu lực, đồng thời cho phép Employee dùng refresh session trong Manager Portal. Migration không cài mức thuế/bảo hiểm mặc định. Với database hiện có, sao lưu trước rồi xem [thứ tự migration](migrations/README.md) và chỉ chạy các script phù hợp với phiên bản đang triển khai. `maintenance/cleanup_legacy.sql` không thuộc quy trình cài đặt mặc định. Xem [quy trình cài đặt, sao lưu và phục hồi](../docs/ops/database-installation-backup-restore.md). Tài liệu tính năng nằm trong [`docs/database/`](../docs/database/).
