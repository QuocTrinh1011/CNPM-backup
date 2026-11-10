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

Database mới dùng `schema.sql`; nạp `seed/seed_data.sql` khi cần dữ liệu demo. Với database hiện có, sao lưu trước rồi xem [thứ tự migration](migrations/README.md) và chỉ chạy các script phù hợp với phiên bản đang triển khai. `maintenance/cleanup_legacy.sql` không thuộc quy trình cài đặt mặc định.
