# Sao lưu và phục hồi database

Quy trình cài đặt, sao lưu, phục hồi, lưu trữ backup và biên bản diễn tập PostgreSQL thật nằm trong [tài liệu CSDL](../../docs/ops/database-installation-backup-restore.md).

Diễn tập trên PostgreSQL 18.1 đã restore thành công bản sao `htttdn` vào database tạm, khớp tên bảng và số dòng trên 39 bảng public. Database thử và dump đã được dọn; nguồn không bị thay đổi. Biên bản cũng ghi nhận các bảng runtime thừa so với `schema.sql`; chưa áp dụng thao tác xóa/migration nào lên database thật.

Các file dump vận hành tiếp theo phải được lưu ngoài repo, giới hạn quyền truy cập và không commit lên Git.
