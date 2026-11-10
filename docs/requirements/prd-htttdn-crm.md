# Product Requirements Document (PRD)

## Hệ thống CRM và Quản lý bán hàng

| Thuộc tính | Nội dung |
| --- | --- |
| Môn học | Hệ thống thông tin doanh nghiệp (HTTTDN) |
| Phiên bản | 1.4 |
| Trạng thái | Draft for team review; đối chiếu code và quyết định đã chốt ngày 26/10/2026 |
| Ngày tạo | 14/09/2026 |
| Ngày rà soát | 26/10/2026 |
| Repository | [duygri/do-an-htttdn-crm](https://github.com/duygri/do-an-htttdn-crm) |
| Phạm vi | Yêu cầu MVP; các ước lượng thời gian trong bản 1.0 không còn là kế hoạch hiện hành |

## 1. Tóm tắt sản phẩm

### 1.1. Mục đích

Xây dựng hệ thống CRM kết hợp quản lý bán hàng giúp doanh nghiệp quản lý tập trung khách hàng, phản hồi, khảo sát, sản phẩm và đơn hàng. Hệ thống có ba portal:

- **Customer Portal**: đăng ký, đăng nhập, quản lý hồ sơ, xem sản phẩm, gửi feedback, trả lời khảo sát và đặt hàng.
- **Admin Portal**: quản lý tài khoản nội bộ và quyền truy cập; tạo tài khoản Manager.
- **Manager Portal**: vận hành khách hàng, sản phẩm, nhà cung cấp, đơn hàng, feedback, khảo sát, báo cáo và voucher.

### 1.2. Vấn đề cần giải quyết

Dữ liệu khách hàng và bán hàng thường bị phân tán trong nhiều file hoặc công cụ. Doanh nghiệp khó theo dõi lịch sử khách hàng, đo lường mức độ hài lòng, kiểm soát đơn hàng và tổng hợp doanh thu. Sản phẩm tạo một luồng dữ liệu thống nhất từ tương tác của Customer đến hoạt động quản trị và phân tích.

## 2. Mục tiêu và tiêu chí thành công

### 2.1. Mục tiêu

1. Cho phép Customer thực hiện các luồng CRM và bán hàng cơ bản.
2. Cho phép Admin quản lý tài khoản nội bộ và Manager vận hành nghiệp vụ tương ứng.
3. Duy trì mô hình dữ liệu quan hệ thống nhất cho các miền khách hàng, sản phẩm, bán hàng, thanh toán, CRM, khảo sát và khuyến mãi.
4. Thể hiện đầy đủ quy trình phân tích, thiết kế, triển khai, kiểm thử và báo cáo của một hệ thống thông tin doanh nghiệp.

### 2.2. Tiêu chí thành công

| Tiêu chí | Kết quả cần đạt |
| --- | --- |
| Phạm vi | Đáp ứng yêu cầu và tiêu chí nghiệm thu trong tài liệu này; trạng thái Issue không được dùng làm bằng chứng hoàn thành |
| Tài liệu | Có phân tích doanh nghiệp, khảo sát, yêu cầu số hóa, ERD, data dictionary, chuẩn hóa và sequence diagram |
| Chức năng | Luồng Customer, Admin và Manager chính chạy được với dữ liệu mẫu |
| Dữ liệu | ERD, data dictionary và schema hiện hành thống nhất về tên bảng, quan hệ, khóa và ràng buộc |
| Chất lượng | Có kiểm thử luồng thành công, dữ liệu không hợp lệ, phân quyền và lỗi phổ biến |
| Quy trình | Mọi thay đổi code đi qua branch và Pull Request có review |
| Trình bày | Có báo cáo, ảnh minh chứng, demo và hướng dẫn chạy |

## 3. Phạm vi sản phẩm

### 3.1. Trong phạm vi MVP

- Phân tích doanh nghiệp, khảo sát hệ thống hiện tại và yêu cầu số hóa.
- ERD, data dictionary và mô hình quan hệ chuẩn hóa 3NF.
- Sequence diagram cho các luồng Customer, Admin và Manager.
- Đăng ký, đăng nhập và xác thực người dùng.
- Quản lý hồ sơ, địa chỉ giao hàng, danh sách yêu thích và sở thích khách hàng.
- Feedback và rating sản phẩm.
- Tạo, chọn đối tượng, phát hành, trả lời và thống kê khảo sát; thông báo trong web và voucher thưởng.
- Danh mục sản phẩm, tồn kho, nhà cung cấp và liên kết sản phẩm với nhà cung cấp.
- Giỏ hàng, voucher, đặt hàng, lịch sử đơn hàng, hủy/đổi trả và trạng thái giao hàng.
- Thanh toán COD và tùy chọn thanh toán trực tuyến qua payOS, Return URL/cancelUrl và webhook.
- Báo cáo khách hàng, khảo sát và doanh thu.
- Hồ sơ khách hàng 360° và lịch sử hoạt động; phân nhóm vòng đời Customer.
- Chăm sóc khách hàng bằng task, ghi chú, nhắc việc, kết quả chăm sóc và dashboard.
- Phiếu hỗ trợ do Customer gửi và Manager xử lý; Manager xử lý yêu cầu đổi trả.
- Ghi nhận thủ công hoàn tiền và thu COD; hỗ trợ đối soát thanh toán; không gửi lệnh hoàn tới payOS.
- Báo cáo giữ chân khách hàng và dòng tiền; audit log cho Admin và thông báo nội bộ cho Manager.
- Kiểm thử, tài liệu kỹ thuật và demo.

### 3.2. Ngoài phạm vi MVP

- Merchant go-live, hoàn tiền production và đối soát production. Trong MVP, hoàn tiền và thu COD được ghi nhận thủ công; hệ thống không gửi lệnh hoàn tới payOS. Tích hợp payOS được mô tả trong MVP; kiểm thử giao dịch thật là hoạt động riêng, có kiểm soát và không phải bước smoke test mặc định.
- Tích hợp đơn vị vận chuyển thực tế.
- Social login, xác thực đa yếu tố và nghiệm thu khôi phục mật khẩu qua email ở production. Code hỗ trợ tùy chọn gửi liên kết đặt lại qua Resend khi được cấu hình, dùng token 43 ký tự và không trả mã trong response email. Fallback mã sáu chữ số chỉ bật bằng `DEV_PASSWORD_RESET_ENABLED` ở development. Demo/nghiệm thu giữ `RESEND_ENABLED=false` và `DEV_PASSWORD_RESET_ENABLED=false`; chưa xác minh gửi/nhận email hoặc vận hành production.
- Ứng dụng native cho Android hoặc iOS.
- Dự báo doanh thu bằng machine learning.
- Triển khai production, autoscaling và vận hành 24/7.

### 3.3. Quyết định đã chốt

- **Đặt lại mật khẩu:** Code hỗ trợ tùy chọn gửi liên kết đặt lại qua Resend khi được cấu hình, dùng token 43 ký tự và không trả mã trong response email. Fallback mã sáu chữ số chỉ bật bằng `DEV_PASSWORD_RESET_ENABLED` ở development. Demo/nghiệm thu giữ `RESEND_ENABLED=false` và `DEV_PASSWORD_RESET_ENABLED=false`; chưa xác minh gửi/nhận email hoặc vận hành production.
- **Audit log:** Chỉ Admin tra cứu audit log qua `/api/admin/audit-logs`; không có endpoint hoặc điều hướng audit cho Manager. Lịch sử hoạt động Customer được xem riêng trong hồ sơ 360°.
- **Tự hủy PayOS:** mặc định code tắt. Môi trường demo/nghiệm thu đặt `PAYOS_AUTO_CANCEL_ENABLED=true` và `PAYOS_AUTO_CANCEL_GRACE_HOURS=24`; Spring Boot không tự đọc `.env`, nên phải đặt biến vào môi trường tiến trình backend. Cấu hình này bật kiểm tra định kỳ; chỉ giải phóng tồn kho và voucher khi đã xác minh chưa thanh toán và hủy đơn thành công. Đơn chưa xác minh được vẫn giữ tồn kho/voucher và cần đối soát.

## 4. Người dùng hệ thống và stakeholder

| Vai trò | Mục đích | Quyền chính |
| --- | --- | --- |
| Customer | Mua hàng và tương tác với doanh nghiệp | Đăng ký, đăng nhập, sửa hồ sơ, xem sản phẩm, feedback, khảo sát, đặt hàng, xem đơn hàng của chính mình |
| Admin | Quản trị tài khoản nội bộ | Đăng nhập Admin Portal, tạo/quản lý tài khoản nội bộ và cấp quyền Manager; không thay Manager xử lý nghiệp vụ bán hàng |
| Manager | Vận hành CRM và bán hàng | Quản lý khách hàng, sản phẩm, nhà cung cấp, đơn hàng, feedback, khảo sát, voucher và báo cáo |
| Project team | Phát triển và kiểm tra | Phân tích yêu cầu, triển khai, review thay đổi và ghi nhận bằng chứng kiểm thử |

Customer chỉ được truy cập dữ liệu của chính mình. Backend phải kiểm tra quyền, không chỉ ẩn chức năng trên frontend. Project team là stakeholder phát triển, không phải role đăng nhập của ứng dụng.

## 5. Luồng nghiệp vụ chính

### 5.1. Customer

1. Đăng ký tài khoản và đăng nhập.
2. Xem hoặc cập nhật hồ sơ, sở thích và địa chỉ giao hàng.
3. Xem, tìm kiếm và lọc sản phẩm.
4. Quản lý danh sách yêu thích, giỏ hàng và voucher; đặt hàng bằng COD hoặc PayOS.
5. Xem lịch sử/trạng thái đơn; hủy đơn đủ điều kiện, xác nhận nhận hàng hoặc gửi yêu cầu đổi trả.
6. Sau khi xác nhận nhận hàng, gửi feedback/rating cho sản phẩm trong đơn.
7. Xem khảo sát mà mình đủ điều kiện nhận và gửi câu trả lời.

### 5.2. Admin Portal

1. Đăng nhập Admin Portal.
2. Tạo và quản lý tài khoản nội bộ; cấp vai trò Manager.
3. Xem thông tin tổng quan và danh mục được phép đọc.

### 5.3. Manager CRM và Sales

1. Tạo, sửa, xóa sản phẩm và cập nhật tồn kho.
2. Quản lý khách hàng, nhà cung cấp và liên kết nhà cung cấp với sản phẩm.
3. Xử lý đơn hàng và cập nhật trạng thái giao hàng.
4. Tiếp nhận feedback; tạo, chọn đối tượng, phát hành khảo sát và xem báo cáo.
5. Quản lý voucher, báo cáo doanh thu và báo cáo khách hàng.

## 6. Yêu cầu chức năng

| Mã | Nhóm | Yêu cầu | Tiêu chí nghiệm thu | Issue tham chiếu (lịch sử) |
| --- | --- | --- | --- | --- |
| FR-01 | Account | Customer đăng ký tài khoản | Email không trùng, trường bắt buộc được kiểm tra, mật khẩu không lưu plaintext | #23 |
| FR-02 | Authentication | Customer đăng nhập, refresh phiên và đăng xuất | Access token ngắn hạn trả trong response body; refresh token lưu dạng hash và gửi bằng HttpOnly/SameSite cookie, bật Secure trên HTTPS/production; rotation, reuse detection và logout được phân biệt | #24 |
| FR-03 | Profile | Customer xem và cập nhật hồ sơ/sở thích | Chỉ tài khoản hiện tại được cập nhật; dữ liệu được validate | #25 |
| FR-04 | Feedback | Customer gửi feedback và rating sau khi hoàn tất đơn hàng | Rating trong khoảng 1–5; backend xác nhận đơn thuộc Customer và ở trạng thái `COMPLETED`; mỗi sản phẩm trong mỗi đơn chỉ được đánh giá một lần | #26 |
| FR-05 | Survey | Customer xem và trả lời khảo sát | Chỉ khảo sát đã phát hành được trả lời; câu trả lời bắt buộc được kiểm tra | #27 |
| FR-06 | Catalog | Customer xem, tìm kiếm và lọc sản phẩm | Hiển thị đúng tên, giá, tồn kho và bộ lọc | #28 |
| FR-07 | Order/Payment | Customer quản lý giỏ hàng, tạo đơn và thanh toán bằng COD hoặc payOS | Tổng tiền do backend tính; đơn và tồn kho được xử lý nhất quán; kết quả Return URL/cancelUrl chỉ để hiển thị; chỉ webhook hợp lệ xác nhận PayOS đã thanh toán | #21, #29 |
| FR-08 | Tracking | Customer xem lịch sử và trạng thái đơn | Không xem được đơn của Customer khác | #30 |
| FR-09 | Customer Management | Manager quản lý tài khoản Customer | Có tìm kiếm, phân trang, sửa và khóa tài khoản; kiểm tra quyền ở backend | #31 |
| FR-10 | Feedback Management | Manager xem và xử lý feedback | Có danh sách, chi tiết, cập nhật trạng thái/phản hồi và ghi nhận xử lý | #32 |
| FR-11 | Survey Builder | Manager tạo câu hỏi, khảo sát, chọn đối tượng và phát hành | Khảo sát có thể lưu, publish; đối tượng ALL/SELECTED được kiểm tra khi xem và trả lời | #33 |
| FR-12 | Survey Analytics | Manager xem thống kê câu trả lời | Số liệu lấy từ response thực tế; có bảng/biểu đồ và xem câu trả lời văn bản | #34 |
| FR-13 | Customer Reporting | Manager xem báo cáo khách hàng | Tổng hợp dữ liệu thực tế theo chỉ số được định nghĩa | #35 |
| FR-14 | Product/Inventory | Manager quản lý sản phẩm, giá, tồn kho và nhà cung cấp | Thay đổi hợp lệ được lưu; tồn kho không âm; liên kết nhà cung cấp được giữ cho dữ liệu lịch sử | #36 |
| FR-15 | Sales Orders | Manager xem và cập nhật đơn hàng | Trạng thái chuyển theo luồng hợp lệ; khách chỉ xem đơn của chính mình | #37 |
| FR-16 | Revenue Analytics | Manager xem báo cáo doanh thu | Có kỳ báo cáo, tổng doanh thu, sản phẩm bán chạy và bằng chứng dữ liệu | #38 |
| FR-17 | Internal Accounts | Admin tạo và quản lý tài khoản nội bộ | Chỉ Admin được quản lý tài khoản nội bộ; tài khoản Manager đăng nhập đúng portal/role | #50, #51 (tài liệu use case) |
| FR-18 | Survey Rewards | Manager cấu hình voucher thưởng cho khảo sát | Cấu hình phần thưởng hợp lệ; mỗi khách đủ điều kiện nhận tối đa một phần thưởng cho khảo sát | — |
| FR-19 | Voucher | Manager quản lý voucher; Customer xem ví và áp dụng voucher | Kiểm tra thời hạn, điều kiện, lượt dùng và mức giảm ở backend; không tin mức giảm từ frontend | — |
| FR-20 | Customer Self-service | Customer quản lý địa chỉ, danh sách yêu thích, hủy đơn đủ điều kiện và yêu cầu đổi trả | Tài nguyên thuộc đúng Customer; trạng thái/điều kiện được backend kiểm tra | — |
| FR-21 | Customer 360 | Manager xem hồ sơ khách hàng 360° và lịch sử hoạt động | Xem hồ sơ tổng hợp, địa chỉ, đơn hàng, feedback, khảo sát, voucher, lượt dùng voucher và lịch sử hoạt động; các danh sách chi tiết có phân trang | — |
| FR-22 | Customer Lifecycle | Manager phân nhóm vòng đời Customer | `NO_PURCHASE` khi chưa có đơn hoàn tất; `LOYAL` khi có ít nhất 5 đơn hoàn tất hoặc giá trị hoàn tất từ 5.000.000 VND; `FIRST_PURCHASE` với một đơn còn lại, các trường hợp còn lại là `RETURNING`; dormant từ 30 ngày sau lần mua gần nhất. Danh sách hỗ trợ lọc và phân trang | — |
| FR-23 | Customer Care | Manager quản lý task, ghi chú, nhắc việc, kết quả và dashboard chăm sóc | Tạo/cập nhật task, follow-up và ghi chú; khi hoàn tất task phải có outcome hợp lệ. Dashboard trả task TODO, IN_PROGRESS, COMPLETED, quá hạn theo nhân viên và khách dormant chưa có task mở; Manager xem nhắc việc đến hạn | — |
| FR-24 | Support | Customer gửi/theo dõi phiếu hỗ trợ; Manager tiếp nhận và xử lý | Customer tạo, xem và trả lời phiếu của mình; Manager tìm, xem, tạo, cập nhật và trả lời phiếu | — |
| FR-25 | Returns | Manager xử lý yêu cầu đổi trả | Chỉ xử lý đơn DELIVERED/COMPLETED; REQUESTED chuyển sang APPROVED hoặc REJECTED; APPROVED mới chuyển sang COMPLETED. Từ chối và hoàn tất phải có ghi chú; lịch sử đổi trả được lưu | — |
| FR-26 | Refund and Reconciliation | Manager ghi nhận hoàn tiền, thu COD và đối soát thanh toán | Chỉ ghi nhận hoàn cho đơn hủy hoặc đổi trả đã duyệt/hoàn tất; số tiền là VND nguyên dương và không vượt số tiền đã thu. Manager hoàn tất/từ chối với ghi chú; thu COD chỉ cho đơn DELIVERED/COMPLETED. Đối soát PayOS đọc trạng thái giao dịch; không gửi lệnh hoàn tới payOS | — |
| FR-27 | Retention and Cashflow | Manager xem báo cáo giữ chân khách hàng và dòng tiền | Báo cáo giữ chân trả tổng khách, khách mua/lặp lại, repeat rate, giá trị và trung bình giá trị đơn hoàn tất, khách dormant, phân bố vòng đời, ngưỡng và phiếu hỗ trợ đã giải quyết. Dòng tiền nhận khoảng tối đa 366 ngày, nhóm ngày/tháng và trả số thu, hoàn, ròng, số đơn đã thu cùng 10 sản phẩm bán chạy | — |
| FR-28 | Audit | Admin tra cứu audit log | Chỉ Admin tra cứu audit log qua `/api/admin/audit-logs`; không có endpoint hoặc điều hướng audit cho Manager. Lịch sử hoạt động Customer được xem riêng trong hồ sơ 360°. Có bộ lọc và phân trang | — |
| FR-29 | Manager Notifications | Manager xem thông báo nội bộ | Hộp thư gồm nhắc chăm sóc đến hạn/quá hạn và phiếu hỗ trợ được giao; xem số chưa đọc và danh sách phân trang; đánh dấu một hoặc tất cả thông báo đã đọc | — |

**Nguồn đối chiếu code cho FR-21–FR-29**

| FR | Controller, route và service |
| --- | --- |
| FR-21 | `CustomerProfileController`: `GET /api/manager/users/{id}/profile` và các route `/activities`, `/addresses`, `/orders`, `/feedback`, `/surveys`, `/vouchers`, `/voucher-usages`; `CustomerProfileService`, `CustomerActivityService` |
| FR-22 | `AdminUserController`: `GET /api/manager/users`; `CustomerLifecycleQuery`, `CustomerLifecycle` |
| FR-23 | `CustomerCareController`: `/api/manager/care/dashboard`, `/care/tasks`, `/users/{id}/care/notes`; `CustomerCareService`, `CareDashboardService`, `CareReminderScheduler`, `CareReminderService` |
| FR-24 | `SupportTicketController`: `/api/support-tickets` và `/api/manager/support-tickets`; `SupportTicketService` |
| FR-25 | `ManagerReturnController`: `PATCH /api/manager/orders/{id}/return`; `ReturnManagementService`; Customer yêu cầu tại `OrderController`/`OrderService.requestReturn` |
| FR-26 | `ManagerRefundController`: `/api/manager/orders/{id}/refunds`, `/refunds/{id}/complete`, `/refunds/{id}/reject`, `/orders/{id}/cod-collection`, `/orders/{id}/payment/reconcile`; `RefundService`, `PaymentReconciliationService` |
| FR-27 | `RetentionReportController`: `GET /api/manager/reports/retention`; `CashflowReportController`: `GET /api/manager/reports/cashflow`; `RetentionReportService`, `CashflowReportService` |
| FR-28 | `AuditLogController`: `GET /api/admin/audit-logs`; `AuditLogQuery.list` kiểm tra quyền ADMIN; `CustomerActivityService.list` cung cấp timeline hồ sơ 360° riêng |
| FR-29 | `ManagerCareInboxController`: `/api/manager/notifications`, `/notifications/summary`, `/notifications/{id}/read`, `/notifications/read-all`; `ManagerCareInbox` |

Các số Issue trong bảng là liên kết truy vết từ kế hoạch cũ, không biểu thị trạng thái hoàn thành. Trạng thái tracker hiện tại được ghi tại mục 11.

## 7. Yêu cầu phân tích và thiết kế

| Giai đoạn | Deliverable | Issue |
| --- | --- | --- |
| Phân tích doanh nghiệp | Doanh nghiệp, cơ cấu, quy trình bán hàng và chăm sóc khách hàng | #1 |
| Khảo sát | Tối thiểu 15 câu hỏi và dữ liệu phản hồi | #2 |
| Yêu cầu số hóa | Phân tích bottleneck và yêu cầu kinh doanh | #3 |
| Mô hình dữ liệu | ERD khớp schema hiện hành: customers, admins, catalog/suppliers, orders/payments, CRM, surveys và vouchers | #4 (baseline cũ) |
| Data dictionary | Kiểu dữ liệu, PK, FK, nullable và ý nghĩa các bảng/cột hiện hành | #5 (baseline cũ) |
| Chuẩn hóa | Mô hình quan hệ và ràng buộc toàn vẹn được đối chiếu với schema | #6 |
| Use case/sequence nội bộ | Luồng Admin quản lý tài khoản và Manager vận hành CRM/Sales | #7–#14, #50–#51 |
| Customer sequence | Luồng Customer CRM/Sales, địa chỉ, voucher và đơn hàng | #15–#22 |

Các mã Issue trong bảng chỉ dùng truy vết tài liệu cũ. Đặc tả dữ liệu hiện hành lấy `database/schema.sql` làm nguồn đối chiếu; không giả định ERD chỉ có bảy bảng.

## 8. Dữ liệu và quy tắc nghiệp vụ

### 8.1. Miền dữ liệu và bảng hiện hành

Schema PostgreSQL hiện có 31 bảng vật lý, được chia theo chín miền nghiệp vụ sau. Tên trong cột “Bảng” là tên thật trong `database/schema.sql`.

| Miền | Bảng | Nội dung |
| --- | --- | --- |
| Khách hàng và xác thực | `customers`, `admins`, `refresh_tokens`, `password_reset_tokens` | Hồ sơ, tài khoản nội bộ, phiên và mã đặt lại |
| Danh mục và nhà cung cấp | `categories`, `products`, `suppliers` | Danh mục, sản phẩm, tồn kho và nhà cung cấp |
| Giỏ hàng và đơn hàng | `cart_items`, `wishlists`, `customer_addresses`, `orders`, `order_items`, `order_return_events` | Giỏ, yêu thích, địa chỉ, đơn hàng và lịch sử đổi trả |
| Thanh toán | `payments`, `payment_attempts`, `payment_webhook_events`, `order_refunds` | Giao dịch, lần thanh toán, webhook và sổ ghi nhận hoàn tiền |
| CRM | `feedback`, `customer_notifications` | Đánh giá, phản hồi và thông báo Customer |
| Khảo sát | `survey_definitions`, `survey_questions`, `survey_responses`, `survey_answers`, `survey_recipients`, `survey_notified_customers` | Khảo sát, câu hỏi, câu trả lời và đối tượng nhận |
| Khuyến mãi | `store_vouchers`, `voucher_usages` | Voucher và lịch sử sử dụng |
| Chăm sóc và hỗ trợ | `customer_care_notes`, `customer_care_tasks`, `support_tickets` | Ghi chú, task chăm sóc và phiếu hỗ trợ |
| Kiểm toán | `audit_logs` | Nhật ký hành động và thay đổi dữ liệu |

### 8.2. Quy tắc chính

- Email tài khoản phải duy nhất.
- Mật khẩu phải được hash bằng BCrypt hoặc cơ chế tương đương.
- Access token nên có thời hạn ngắn và chỉ nằm trong memory của frontend. Refresh token phải lưu dưới dạng hash cùng chủ sở hữu, `expires_at`, token family, trạng thái và `revoke_reason`; token được gửi bằng cookie `HttpOnly`, `SameSite`. Bật thuộc tính `Secure` ở production/HTTPS; môi trường local HTTP có thể tắt để phát triển.
- Mỗi lần refresh hợp lệ phải revoke token cũ với lý do `ROTATED` và phát token mới trong cùng family. Token hết hạn hoặc bị revoke bởi logout/admin chỉ trả lỗi, không tự động revoke cả family.
- Nếu token đã ở trạng thái `ROTATED`/`USED` nhưng bị gửi lại, đó là reuse detection: revoke toàn bộ token family, ghi security event và trả `401 REFRESH_TOKEN_REUSE_DETECTED`.
- Logout bình thường chỉ revoke refresh token hiện tại với lý do `LOGOUT` và xóa cookie. Logout tất cả thiết bị, nếu có, là thao tác riêng để revoke toàn bộ family.
- Đổi mật khẩu, khóa tài khoản và security reset phải có khả năng revoke refresh token đang hoạt động.
- Customer chỉ truy cập dữ liệu thuộc tài khoản của mình.
- Rating nằm trong khoảng 1–5.
- Customer chỉ được feedback/rating sản phẩm có trong đơn của chính mình ở trạng thái `COMPLETED` (khách đã xác nhận nhận hàng). Mỗi cặp `(order_id, product_id)` chỉ được đánh giá một lần; đơn chưa hoàn tất hoặc đã hủy không đủ điều kiện.
- Không tạo đơn với sản phẩm không tồn tại hoặc số lượng không hợp lệ.
- Tổng tiền lấy từ `order_items`, không tin giá trị do frontend gửi lên.
- Đơn hàng lưu phương thức, trạng thái thanh toán, số tiền, thời hạn và mã voucher; thông tin payment link/lần thử thanh toán nằm trong `payments` và `payment_attempts`.
- Đơn mới được tạo với trạng thái đơn `PENDING`. `PENDING_PAYMENT` là giá trị cũ còn trong tập trạng thái được chấp nhận nhưng `OrderService.create` không còn tạo. Với PayOS, webhook hợp lệ chỉ cập nhật `paymentStatus=PAID`; Manager chuyển đơn `PENDING` sang `CONFIRMED` qua chức năng quản lý đơn hàng. COD xử lý theo luồng riêng.
- Xử lý webhook phải idempotent: xác thực nội dung/chữ ký, đối chiếu order và số tiền, ghi khóa sự kiện duy nhất trong `payment_webhook_events`; callback lặp lại không được ghi nhận thanh toán lần hai.
- Webhook hợp lệ lần đầu hoặc đã xử lý phải trả HTTP 2xx; chữ ký, `orderCode` hoặc số tiền không hợp lệ phải bị từ chối và không cập nhật đơn.
- Link PayOS có hạn 15 phút. `OrderService.cleanupExpired` đánh dấu payment quá hạn; `AbandonedOrderScheduler` chạy theo `app.payos.auto-cancel-ms` (mặc định 300000 ms). Khi `PAYOS_AUTO_CANCEL_ENABLED=true`, `AbandonedOrderWorker` xét hủy sau thời gian chờ `PAYOS_AUTO_CANCEL_GRACE_HOURS` (mặc định 24 giờ) kể từ hạn mới nhất của đơn, payment và các lần thử. Chỉ khi đối soát xác nhận chưa thanh toán và hủy thành công, giao dịch mới giải phóng tồn kho và voucher đúng một lần; nếu chưa xác minh được, đơn vẫn giữ tồn kho/voucher và cần đối soát. Cờ mặc định là `false`; demo/nghiệm thu đặt cờ `true` và grace `24` giờ. Spring Boot không tự đọc `.env`; biến phải nằm trong môi trường tiến trình backend.
- Khóa ngoại không được tạo bản ghi mồ côi.
- Customer xác nhận nhận hàng khi đơn `DELIVERED` và `returnStatus` là `NONE` hoặc null; đơn chuyển `COMPLETED`. Gọi lại khi đã `COMPLETED` trả kết quả hiện có (idempotent).
- Đổi trả đi theo `REQUESTED` → `APPROVED` → `COMPLETED` hoặc `REQUESTED` → `REJECTED`.
- Trạng thái đơn hàng chỉ chuyển theo luồng đã thống nhất.
- Survey chỉ nhận response khi đã phát hành và còn hiệu lực.

Khảo sát chỉ nhận response khi đã phát hành, còn hiệu lực và Customer thuộc đối tượng khảo sát. Mọi thay đổi schema phải cập nhật đồng thời ERD, data dictionary, migration và `database/schema.sql`.

## 9. Yêu cầu phi chức năng

| Nhóm | Yêu cầu |
| --- | --- |
| Security | Tách quyền Customer/Admin/Manager, BCrypt, không trả password hash, kiểm tra quyền ở backend; refresh cookie HttpOnly/SameSite và Secure trên HTTPS |
| Validation | Validate ở frontend và backend |
| Integrity | PK, FK, unique, not-null, check constraint và transaction phù hợp |
| Performance | Phân trang danh sách và filter báo cáo; tránh tải dữ liệu thừa |
| Usability | Có loading, empty, success và error state |
| Reliability | Error response nhất quán; log đủ để debug nhưng không ghi secret |
| Maintainability | Java 21/Spring Boot, React, PostgreSQL; code chia theo module |
| Testability | Test happy path, validation, quyền, lỗi và dữ liệu biên |
| Documentation | README, API examples, ERD, data dictionary, hướng dẫn chạy, test evidence và demo |

## 10. Kiến trúc dự kiến

```text
React Customer Portal    React Admin Portal    React Manager Portal
          |                       |                       |
          +-----------------------+-----------------------+
                                  REST/JSON
                                     |
                           Java 21 Spring Boot API
                      Controller -> Service -> Repository
                                     |
                                 PostgreSQL
```

- Frontend chịu trách nhiệm giao diện, điều hướng, validate cơ bản và hiển thị trạng thái.
- Backend chịu trách nhiệm authentication, authorization, business rules, transaction và API.
- Database chịu trách nhiệm lưu trữ quan hệ, khóa, constraint, seed data và backup documentation.
- Documentation chứa requirements, ERD, sequence diagram, test evidence, report và demo.

API dùng JSON và status code phù hợp `200`, `201`, `400`, `401`, `403`, `404`, `409`, `500`. Lỗi nên có mã lỗi và thông báo có thể hiển thị trên frontend.

### 10.1. Tích hợp thanh toán payOS

Ứng dụng hỗ trợ COD và tích hợp PayOS cho thanh toán chuyển khoản/VietQR. payOS hiện không có môi trường Sandbox/Staging riêng; giao dịch kiểm thử PayOS có thể chuyển tiền thật. Vì vậy COD là luồng smoke test mặc định. Chỉ kiểm thử PayOS khi chủ tài khoản/người phụ trách đã xác nhận tài khoản, số tiền giới hạn và thời điểm thực hiện. Go-live, refund và đối soát production vẫn ngoài phạm vi MVP. Backend tạo payment link, Return URL/cancelUrl chỉ hiển thị kết quả; trạng thái thanh toán được xác nhận qua webhook.

| Thành phần | Quy định |
| --- | --- |
| API base URL | `https://api-merchant.payos.vn` |
| Tạo payment link | `POST /v2/payment-requests` với `orderCode` số nguyên duy nhất, `amount`, `description`, `items`, `returnUrl`, `cancelUrl`, `expiredAt` |
| Biến môi trường backend | Bắt buộc: `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`; `PAYOS_RETURN_URL` và `PAYOS_CANCEL_URL` có giá trị mặc định local trong `application.yml` |
| Tạo giao dịch | `OrderService.create` tạo đơn ở trạng thái `PENDING`; giao dịch PayOS có số tiền dương đặt `paymentStatus=PENDING` và tạo link 15 phút. COD dùng `paymentStatus=COD`; đơn tổng tiền 0 được đánh dấu đã thanh toán. `PENDING_PAYMENT` là trạng thái cũ, không còn được tạo mới |
| Số tiền | Gửi trực tiếp theo số tiền VND của đơn hàng |
| Chữ ký tạo link | Dùng HMAC-SHA256 với checksum key, chuỗi dữ liệu sắp xếp theo alphabet; secret chỉ nằm ở backend |
| Return/cancel URL | Nhận query params để hiển thị kết quả cho Customer; không dùng làm nguồn duy nhất để chốt đơn |
| Webhook | Backend nhận tại `/api/payments/payos/webhook`; triển khai qua HTTPS public và đăng ký URL đầy đủ ở cấu hình webhook của merchant PayOS. `PAYOS_WEBHOOK_URL` không phải biến môi trường được backend hiện tại đọc |
| Webhook acknowledgment | Webhook hợp lệ hoặc đã xử lý trả HTTP 2xx; chữ ký/dữ liệu sai trả lỗi và không cập nhật order |
| Thành công | Webhook hợp lệ cập nhật `paymentStatus=PAID`. Manager chuyển trạng thái đơn `PENDING` → `CONFIRMED` qua `AdminOrderService`; webhook không chuyển trạng thái đơn |
| Thất bại/hủy/hết hạn | Webhook không thành công cập nhật payment thành `EXPIRED` hoặc `CANCELLED`; job hết hạn đánh dấu `EXPIRED`. Đơn chỉ bị tự hủy sau thời gian chờ theo mục 8.2 |
| Idempotency | Lưu khóa sự kiện duy nhất trong `payment_webhook_events`; callback lặp lại không ghi nhận payment lần hai |
| Hết hạn | Link PayOS hết hạn sau 15 phút. `AbandonedOrderScheduler` kiểm tra theo `app.payos.auto-cancel-ms` (mặc định 300000 ms). Khi `PAYOS_AUTO_CANCEL_ENABLED=true`, Worker xét hủy sau `PAYOS_AUTO_CANCEL_GRACE_HOURS` (mặc định 24 giờ) kể từ hạn mới nhất. Tồn kho và voucher chỉ được giải phóng đúng một lần sau khi đối soát xác nhận chưa thanh toán và hủy thành công; nếu chưa xác minh được, chúng vẫn được giữ để đối soát. Demo/nghiệm thu đặt cờ `true` và grace `24` giờ. |
| Local demo/nghiệm thu | COD là luồng smoke test mặc định. PayOS không có sandbox; chỉ thử giao dịch thật sau khi người phụ trách xác nhận. Cấu hình tự hủy theo mục 8.2 qua biến môi trường của tiến trình backend; Spring Boot không tự đọc `.env` |

Không commit `PAYOS_CLIENT_ID`, `PAYOS_API_KEY` hoặc `PAYOS_CHECKSUM_KEY` vào repository. Dùng biến môi trường hoặc file local bị `.gitignore` loại trừ. Tài liệu tham khảo: [payOS API](https://payos.vn/docs/api/), [payOS webhook](https://payos.vn/docs/du-lieu-tra-ve/webhook/), [payOS signature](https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/), [payOS test environment](https://payos.vn/docs/moi-truong-test/).

## 11. Phụ thuộc và quản lý thay đổi

Các luồng Customer phụ thuộc vào API/backend và schema; portal Admin/Manager phụ thuộc vào phân quyền nội bộ; thanh toán phụ thuộc cấu hình PayOS/webhook; khảo sát có chọn đối tượng phụ thuộc bảng recipient và thông báo. Mọi thay đổi yêu cầu hoặc schema cần cập nhật PRD, ERD, data dictionary, migration và bằng chứng kiểm thử liên quan.

Ngày 29/09/2026, toàn bộ 24 Issue đang mở trên GitHub đã được đóng vì không còn dùng để theo dõi công việc. Issue đóng không đồng nghĩa deliverable đã hoàn thành. Các số Issue còn trong tài liệu chỉ là tham chiếu lịch sử; không dùng tiến độ hoặc thời gian của kế hoạch 1.0 làm trạng thái hiện tại.

## 12. Kiểm thử và nghiệm thu

### 12.1. Nhóm kiểm thử

- **Unit test**: validation, tính tổng tiền, chuyển trạng thái, rating và survey rules.
- **Integration test**: API, database, authentication, authorization và transaction.
- **UI test**: form, loading, empty state, lỗi và thông báo thành công.
- **End-to-end smoke test**: nếu chưa có runner E2E riêng thì chạy như checklist thủ công và lưu bằng chứng trong `tests/`; các lệnh hiện có trong README là frontend `npm test`/`npm run build` và backend `mvn verify`, không phải lệnh E2E.
- **Security test**: Customer không truy cập dữ liệu Customer khác; Customer/Admin không được gọi API chỉ dành cho Manager; role và portal phải được kiểm tra ở backend.
- **Data test**: khóa ngoại, dữ liệu trùng, NULL, rating ngoài khoảng và tồn kho âm.

Luồng smoke Customer tối thiểu: đăng ký/đăng nhập → xem sản phẩm → tạo đơn COD → Manager cập nhật đơn theo luồng hợp lệ đến `DELIVERED` → Customer xác nhận nhận hàng để đơn thành `COMPLETED` → gửi feedback. Sau đó Manager phát hành survey cho ALL hoặc SELECTED; Customer thuộc đối tượng survey gửi response. Kiểm thử PayOS là bước tích hợp riêng, không chạy mặc định vì có thể phát sinh giao dịch thật.

### 12.2. Acceptance checklist

- [ ] Tiêu chí nghiệm thu của yêu cầu được đáp ứng.
- [ ] Deliverable nằm trong repository hoặc có liên kết rõ ràng.
- [ ] Có ảnh, log hoặc test evidence phù hợp.
- [ ] Không commit secret, password thật hoặc file generated lớn.
- [ ] Thay đổi code được review theo quy trình Pull Request đang áp dụng.
- [ ] Tính năng được kiểm tra trên dữ liệu mẫu.
- [ ] Tài liệu, schema và ứng dụng phản ánh cùng một hành vi.

## 13. Rủi ro và phương án xử lý

| Rủi ro | Ảnh hưởng | Xử lý |
| --- | --- | --- |
| Schema thay đổi sau khi code | Conflict và sửa nhiều module | Chốt ERD/data dictionary trước; thay đổi schema phải cập nhật tài liệu |
| Hai người tạo project skeleton | Xung đột cấu trúc | Một PR tạo skeleton chung; các thành viên kéo `main` trước khi code |
| Thiếu dữ liệu khảo sát/mẫu | Thiếu bằng chứng báo cáo | Dùng dữ liệu mẫu và ghi rõ đây là dữ liệu mẫu |
| Phạm vi quá rộng | Không hoàn thành MVP | Ưu tiên auth, luồng Customer, phân quyền Admin/Manager, đơn hàng và báo cáo cốt lõi |
| Push trực tiếp lên `main` | Mất kiểm soát review | Duy trì branch protection và bắt buộc PR approval |
| API không thống nhất | Tích hợp chậm | Ghi API contract trong tài liệu thay đổi/PR trước khi code |

## 14. Định nghĩa hoàn thành sản phẩm

Sản phẩm được nghiệm thu khi:

1. Tài liệu phân tích, ERD, data dictionary và schema hiện hành nhất quán.
2. Các luồng Customer, Admin và Manager đáp ứng tiêu chí nghiệm thu; phân quyền được kiểm tra ở backend.
3. Luồng đơn hàng COD từ tạo đơn đến giao hàng, xác nhận nhận hàng và feedback có thể được kiểm tra end-to-end.
4. Luồng khảo sát, đối tượng nhận, response, thông báo và voucher thưởng được kiểm tra với dữ liệu mẫu.
5. Kiểm thử tự động hiện có chạy theo README; checklist thủ công có bằng chứng; PayOS thật chỉ được xác nhận riêng theo quy trình kiểm soát giao dịch.
6. Các lỗi nghiêm trọng về authentication, authorization, dữ liệu, tồn kho và đặt hàng đã được xử lý.
7. README hướng dẫn cài đặt, chạy, kiểm thử và demo; báo cáo/demo phản ánh đúng phạm vi thực tế.

Trạng thái đóng của GitHub Issue không được dùng thay cho tiêu chí nghiệm thu hoặc bằng chứng kiểm thử.
