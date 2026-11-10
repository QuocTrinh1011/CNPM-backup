# Kiểm tra liên thông CRM

## Phạm vi đợt này

Kiểm tra và hoàn thiện các bước chăm sóc đã có, không thêm Excel, chiến dịch hoặc nghiệp vụ mới. Không thêm bảng, cột hay migration. Không sửa `application.yml`, không tự áp dụng các migration cũ vào database đang dùng.

## Điểm đã sửa

- Chi tiết công việc mở từ chuông/Việc của tôi có thể ghi nhận kết quả rồi hẹn chăm sóc lại ngay. Khi tạo lần tiếp theo, vẫn giữ chi tiết công việc cha, có liên kết mở cha/con và giữ bộ lọc danh sách trên URL.
- Liên kết sau khi tạo việc từ đổi trả/phản hồi, hoặc khi đã có việc đang mở, có `taskId` để mở đúng chi tiết thay vì chỉ tới trang danh sách nguồn.
- Tạo/cập nhật/hoàn thành/hẹn tiếp công việc và thêm ghi chú được ghi vào bảng `audit_logs` sẵn có, cùng transaction với dữ liệu nghiệp vụ. Bộ lọc nhật ký hỗ trợ CARE_TASK và CARE_NOTE.
- Nhật ký chỉ ghi ID, người phụ trách, trạng thái, hạn xử lý, kết quả và liên kết nguồn/cha; không sao chép tiêu đề/nội dung chăm sóc, ghi chú kết quả, nội dung ghi chú khách hàng, email, mật khẩu hoặc token. Không cấp bù nhật ký cho thao tác lịch sử.

## Ma trận kiểm tra tự động

| Luồng | Kiểm tra | Test |
|---|---|---|
| Khách yêu cầu đổi trả → Manager tạo việc | Chủ đơn, nguồn/khách đúng, thông báo giao đúng người | CareWorkflowIntegrationTest |
| Nhắc hạn → chi tiết công việc | ID thông báo khớp công việc, số chưa đọc giảm khi hoàn thành | CareWorkflowIntegrationTest, CareReminderIntegrationTest |
| Hoàn thành → hẹn tiếp | Cha/con, nguồn được giữ, lần tiếp theo là việc riêng | CareWorkflowIntegrationTest, ManagerCareInbox.test.jsx |
| Công việc → hồ sơ 360°/báo cáo | Đơn đổi trả vẫn được nhận diện; công việc đang mở không tăng số hoàn thành; hai lần chăm sóc có hai kết quả | CareWorkflowIntegrationTest |
| Phản hồi → chăm sóc | Hoàn thành việc không tự đánh dấu phản hồi đã xử lý hoặc đổi ẩn/hiện | CareWorkflowIntegrationTest |
| Nhật ký chăm sóc | Đúng người thực hiện, lọc CARE_TASK/CARE_NOTE, không lộ nội dung tự do, rollback cùng nghiệp vụ | CareWorkflowIntegrationTest, AuditLogs.test.jsx |
| Nguồn → đúng chi tiết | Liên kết mang taskId của việc vừa tạo/đang mở | SourceCareCreator.test.jsx |
| Hai Manager thao tác đồng thời | Chỉ một việc nguồn đang mở và một công việc kế tiếp | CareSourceConcurrencyTest |
| Polling và lỗi | Không chồng request; giữ form khi lỗi; bỏ response muộn; dừng khi ẩn tab/rời trang | ManagerCareInbox.test.jsx, CustomerCare.test.jsx |

Các test liên thông dùng H2 riêng và dữ liệu rollback; không tác động đơn/khách thật hoặc thanh toán thật. Các test PostgreSQL opt-in hiện có là kiểm tra riêng, không được coi là đã chạy chỉ vì `mvn test` thành công.

Kết quả đợt này: `mvn test -q`, 243 test frontend (`npm test -- --maxWorkers=2`), `npm run build` và whitespace đều qua. Đã chạy riêng `CareReminderPostgresTest` với PostgreSQL/bảng tạm rollback; test này kiểm tra SQL nhắc việc và danh sách, không thay thế smoke test toàn luồng trên database triển khai.

## Kiểm tra thực tế sau khi khởi động backend

Điều kiện: các migration chăm sóc, nhật ký và nhắc việc đã được người vận hành áp dụng theo tài liệu từng tính năng. Đợt sửa này không có migration mới.

1. Với dữ liệu thử, tạo yêu cầu đổi trả từ User; Manager mở đơn và tạo việc giao cho một Manager đang hoạt động.
2. Đăng nhập đúng người được giao, kiểm tra Việc của tôi và chuông; job nhắc có thể cần tối đa 60 giây. Mở đúng công việc từ thông báo.
3. Hoàn thành với “Cần theo dõi tiếp”, hẹn lần tiếp theo; mở cha/con, refresh, back/forward và kiểm tra bộ lọc vẫn giữ.
4. Đối chiếu hồ sơ 360°, báo cáo kết quả và nhật ký. Xác nhận trạng thái đơn/đổi trả/thanh toán không tự thay đổi do chăm sóc.
5. Thử lại với phản hồi chưa xử lý. Mất mạng khi lưu phải giữ bản nháp và không báo thành công giả.
6. Kiểm tra bàn phím và bố cục 1440px/768px/390px, sáng/tối. Việc chưa hoàn thành không có nút hẹn tiếp; việc đã có con không thể tạo thêm con.

Tại thời điểm rà soát, frontend đang lắng nghe các cổng 5173–5175 nhưng không có backend lắng nghe 8080. Vì vậy chưa xác nhận thao tác trình duyệt nối API thật hoặc QA trực quan responsive; không khởi động backend bằng cấu hình có thể tự cập nhật schema để vượt qua giới hạn này.
