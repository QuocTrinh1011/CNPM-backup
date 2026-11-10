# Thứ tự migration

Với database hiện có, sao lưu database và thử trên bản sao trước khi áp dụng. Xác định schema đang chạy, đọc các script liên quan rồi chạy theo thứ tự dưới đây khi cần toàn bộ nhóm migration. Không chạy lại `schema.sql` hoặc `seed/seed_data.sql` trên database có dữ liệu.

Các phụ thuộc bên dưới được đối chiếu từ bảng và cột mà từng script tạo hoặc tham chiếu. Mọi script giả định các bảng nền như `customers`, `orders`, `products`, `payments`, `feedback`, `store_vouchers`, `survey_definitions` và `customer_notifications` đã tồn tại.

| # | File | Nội dung | Phụ thuộc trực tiếp |
| ---: | --- | --- | --- |
| 1 | [001_admin_user_split.sql](001_admin_user_split.sql) | Bổ sung cột tương thích cho khách hàng, sản phẩm, đơn hàng và refresh token; bỏ FK cũ trỏ tới `users`. | Các bảng nền `customers`, `products`, `orders`, `refresh_tokens`. |
| 2 | [002_manager_portal.sql](002_manager_portal.sql) | Thêm nhà cung cấp, liên kết sản phẩm, người nhận khảo sát và vai trò Manager. | `001_admin_user_split.sql` tạo `refresh_tokens.audience`; cần các bảng nền `survey_definitions`, `customers`, `products`. |
| 3 | [003_survey_management.sql](003_survey_management.sql) | Thêm trạng thái xóa khảo sát và mở rộng độ dài JSON lựa chọn câu hỏi. | Các bảng nền `survey_definitions`, `survey_questions`. |
| 4 | [004_feedback_moderation.sql](004_feedback_moderation.sql) | Thêm cờ ẩn và xóa mềm cho đánh giá. | Bảng nền `feedback`. |
| 5 | [005_voucher_management.sql](005_voucher_management.sql) | Bổ sung mô tả, mức giảm tối đa, index mã và lịch sử lượt dùng voucher. | Các bảng nền `store_vouchers`, `orders`. |
| 6 | [006_review_survey_rewards.sql](006_review_survey_rewards.sql) | Gắn đánh giá với đơn hàng và thêm cấu hình thưởng khảo sát vào voucher. | Các bảng nền `feedback`, `orders`, `store_vouchers`, `customers`, `survey_definitions`; không đọc bảng `voucher_usages` của migration 005. |
| 7 | [007_payos_qr.sql](007_payos_qr.sql) | Thêm mã QR PayOS vào thanh toán. | Bảng nền `payments`. |
| 8 | [008_payos_attempts.sql](008_payos_attempts.sql) | Tạo lịch sử lần thử thanh toán và chuyển các liên kết PayOS hiện có. | `007_payos_qr.sql` thêm `payments.qr_code`; `001_admin_user_split.sql` thêm `orders.payment_method`. Cần các bảng nền `payments`, `orders`. |
| 9 | [009_return_management.sql](009_return_management.sql) | Lưu lịch sử quyết định đổi trả. | Các bảng nền `orders`, `customers`. |
| 10 | [010_refunds_abandoned_payos.sql](010_refunds_abandoned_payos.sql) | Thêm trạng thái thu COD, rà soát thanh toán và yêu cầu hoàn tiền. | `001_admin_user_split.sql` thêm các cột đơn hàng dùng trong index; cần bảng nền `orders`. |
| 11 | [011_cashflow_voucher_customer_limit.sql](011_cashflow_voucher_customer_limit.sql) | Thêm thời điểm thu tiền, giới hạn voucher theo khách và index báo cáo. | `010_refunds_abandoned_payos.sql` tạo `order_refunds` và các cột thu COD; `005_voucher_management.sql` tạo `voucher_usages`; cần `orders`, `store_vouchers`. |
| 12 | [012_customer_care.sql](012_customer_care.sql) | Tạo ghi chú và công việc chăm sóc khách hàng. | Bảng nền `customers`. |
| 13 | [013_care_sources.sql](013_care_sources.sql) | Liên kết công việc chăm sóc với nguồn nghiệp vụ. | `012_customer_care.sql` tạo `customer_care_tasks`. |
| 14 | [014_care_outcomes.sql](014_care_outcomes.sql) | Thêm kết quả, ghi chú kết quả và liên kết việc theo dõi tiếp. | `012_customer_care.sql` tạo `customer_care_tasks`; không đọc cột do migration 013 thêm. |
| 15 | [015_care_reminders.sql](015_care_reminders.sql) | Liên kết thông báo với công việc và hạn chăm sóc. | `012_customer_care.sql` tạo `customer_care_tasks`; cần bảng nền `customer_notifications`. |
| 16 | [016_audit_logs.sql](016_audit_logs.sql) | Tạo nhật ký kiểm toán và index tra cứu. | Không phụ thuộc migration khác; bảng mới lưu ảnh chụp tác nhân, không có FK. |
| 17 | [017_support_tickets.sql](017_support_tickets.sql) | Tạo phiếu hỗ trợ và liên kết thông báo. | Các bảng nền `customers`, `orders`, `customer_notifications`; script không tham chiếu trực tiếp tới audit, care hoặc reminders. Giữ cuối theo thứ tự triển khai đã thống nhất. |
| 18 | [018_sales_statistics.sql](018_sales_statistics.sql) | Gán tùy chọn nhân viên Manager cho đơn hàng để thống kê doanh thu. | Các bảng nền `customers`, `orders`. |
| 19 | [019_stock_receipts.sql](019_stock_receipts.sql) | Tạo phiếu nhập kho và dòng sản phẩm để ghi chi phí mua hàng. | `002_manager_portal.sql` tạo `suppliers`; cần bảng nền `products`, `customers`. Backend ghi audit khi nhận phiếu nên cần `016_audit_logs.sql`. |
| 20 | [020_retire_refund_care_support_reports.sql](020_retire_refund_care_support_reports.sql) | Gỡ bảng/cột chỉ thuộc hoàn tiền, chăm sóc, phiếu hỗ trợ và báo cáo. | Chạy sau migrations 010–018; xóa cột thông báo liên kết care/ticket trước các bảng; không đụng `audit_logs`, COD collection hay payment review. |
| 21 | [021_promotion_campaigns.sql](021_promotion_campaigns.sql) | Tạo campaign CTKM và ba nhóm rule sản phẩm, hóa đơn, voucher. Chỉ là mô hình dữ liệu. | Cần bảng nền `products`, `store_vouchers`; độc lập với migration 020. |

Migration 020 xóa dữ liệu nghiệp vụ trong các bảng đã gỡ. Nhật ký kiểm toán tổng quát trong `audit_logs` được giữ nguyên để tra cứu các bản ghi lịch sử, kể cả loại entity CARE/TICKET cũ.

Database cài mới dùng [`../schema.sql`](../schema.sql), sau đó có thể nạp dữ liệu minh họa bằng [`../seed/seed_data.sql`](../seed/seed_data.sql). Schema hiện tại đã bao gồm cấu trúc ứng dụng mới; không áp dụng toàn bộ migration như một bước bắt buộc cho database mới.
