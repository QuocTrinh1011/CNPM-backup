# Báo cáo giữ chân khách hàng

Mở `/manager/reports?tab=retention` bằng tài khoản MANAGER. API mới: `GET /api/manager/reports/retention`. Khởi động lại backend sau cập nhật; không cần migration hoặc đổi cấu hình.

## Quy tắc

- Chỉ CUSTOMER chưa xóa, bao gồm tài khoản bị khóa. Chỉ đơn COMPLETED; giá trị sau giảm giá, chưa trừ hoàn tiền, kể cả đơn có đổi trả.
- Khách đã mua: từ một đơn. Khách mua lại: từ hai đơn, không đồng nhất với nhóm quay lại hoặc thân thiết.
- Tỷ lệ mua lại toàn thời gian = khách mua lại / khách đã mua × 100. Giá trị trung bình = tổng giá trị đơn hoàn thành / khách đã mua. Mẫu số 0 trả 0; làm tròn hai chữ số HALF_UP. Đây không phải báo cáo cohort hay tiền thực thu.
- Bốn nhóm dùng chung CTE và ngưỡng với danh sách khách: chưa mua, mua lần đầu, quay lại, thân thiết. Thân thiết ưu tiên khi đạt 5 đơn hoặc 5 triệu đồng.
- Lâu chưa mua lại: từ 30 ngày lịch Asia/Ho_Chi_Minh kể từ ngày đặt gần nhất trong các đơn hoàn thành. Nhãn bổ sung, không cộng vào phân bố.
- Tổng hợp đơn thành một dòng mỗi customer trước tính chỉ số, không nối order_items.
- Tab đang mở dùng hook polling Manager 5 giây; dừng khi ẩn trang hoặc unmount, không chồng request, giữ số liệu gần nhất khi lỗi mạng.
- Dashboard chỉ đổi nhãn `totalRevenue` thành “Giá trị đơn chưa hủy”; phép tính cũ không thay đổi.

## Ma trận kiểm thử

| Phạm vi | Test hồi quy |
| --- | --- |
| 0/1/2/4/5 đơn, ngưỡng tiền, nhóm không trùng, mua lại khác thân thiết | RetentionReportIntegrationTest |
| Mốc 29/30/31 ngày và qua nửa đêm Việt Nam | RetentionReportIntegrationTest |
| Locked/deleted/internal, đơn sai trạng thái, đổi trả, nhiều dòng hàng | RetentionReportIntegrationTest |
| Phân quyền Manager, DTO không lộ dữ liệu cá nhân | RetentionReportIntegrationTest |
| Đối chiếu bộ lọc danh sách và quy tắc hồ sơ | RetentionReportIntegrationTest, CustomerLifecycleIntegrationTest |
| PostgreSQL thật, so sánh tổng và thay đổi số đếm, dữ liệu rollback | CustomerLifecyclePostgresTest (CRM_POSTGRES_QA=true) |
| Liên kết bộ lọc, định nghĩa, URL, tab đang mở, popstate | RetentionReport.test.jsx |
| Polling, lỗi/thử lại, request chậm, cleanup, trang ẩn, rỗng | RetentionReport.test.jsx, ManagerPolling.test.jsx |

Chạy `mvn test -q` trong backend; `npm test`, `npm run build` trong frontend. Test PostgreSQL bật riêng bằng biến môi trường, dùng transaction rollback; không thao tác đơn thật hoặc thanh toán.
