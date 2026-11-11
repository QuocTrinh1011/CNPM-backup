# Bảng hướng dẫn đọc code backend

Tài liệu này chỉ hướng dẫn đọc **backend Java và database**, không đi vào frontend. Hãy chọn một nghiệp vụ rồi lần theo API từ Controller xuống Service, nơi truy cập dữ liệu, entity và migration.

## Cách lần theo một yêu cầu

```text
HTTP request → Controller → Service → Repository hoặc SQL → Entity / bảng → response
```

1. Tìm route trong Controller bằng `@RequestMapping`, `@GetMapping`, `@PostMapping`, `@PatchMapping` hoặc `@DeleteMapping`.
2. Đọc tham số đầu vào và kiểu dữ liệu trả về của method Controller.
3. Mở method Service được gọi; xem kiểm tra nghiệp vụ, quyền, lỗi và `@Transactional`.
4. Theo lời gọi Repository hoặc `NamedParameterJdbcTemplate` để biết dữ liệu được lấy/lưu ở đâu.
5. Đối chiếu Entity với migration và đọc test cùng nghiệp vụ để biết hành vi được mong đợi.

## Bản đồ chức năng

### Nền tảng và tài khoản

| Chức năng | Bắt đầu đọc | Theo tiếp | Database và test gợi ý |
| --- | --- | --- | --- |
| Khởi động ứng dụng, cấu hình database | [`CrmApplication`](../../backend/src/main/java/com/htttdn/crm/CrmApplication.java), [`application.yml`](../../backend/src/main/resources/application.yml), `backend/pom.xml` | `config/WebConfig`, `config/SecurityBeans` | `ddl-auto: validate` nghĩa là ứng dụng kiểm tra schema đã có, không tự tạo bảng. Database mới dùng `database/schema.sql`; database đang có thì xem [`database/migrations/README.md`](../../database/migrations/README.md). |
| Đăng ký, đăng nhập, đăng xuất, đổi/quên mật khẩu | `controller/AuthController` (`/api/auth`) | `service/AuthService` → `UserRepository`, `RefreshTokenRepository`, `PasswordResetTokenRepository` | Entity `User`, `RefreshToken`, `PasswordResetToken`; test `AuthServiceAccountStateTest`, `PasswordRecoveryPolicyTest`, `ResendRecoveryTest`. |
| Đăng nhập Admin/Manager | `controller/AdminAuthController` (`/api/admin/auth`), `controller/ManagerAuthController` (`/api/manager/auth`) | `service/AdminAuthService`, `service/ManagerAuthService` → `JwtTokenService` | Đọc tiếp `security/JwtTokenService`; test xác thực nằm trong `backend/src/test/java/com/htttdn/crm/service`. |
| Phân quyền, JWT, giới hạn request | `config/SecurityBeans`, `security/AdminAccessGuard` | `security/JwtTokenService`, `security/RateLimitFilter`, `security/RateLimitStore`, `security/StartupSecurityValidation` | Test `ApiPayloadValidationIntegrationTest`, `RateLimitFilterIntegrationTest`, `RateLimitGlobalIntegrationTest`, `RateLimitStoreTest`, `StartupSecurityValidationTest`. |
| Định dạng lỗi API | `exception/ApiExceptionHandler` | `exception/ApiException` và nơi ném lỗi trong Service | Khi đọc lỗi, xem mã lỗi và HTTP status ở đây rồi quay lại chỗ gọi nghiệp vụ. |
| Quản lý tài khoản nội bộ và người dùng | `controller/InternalAccountController` (`/api/admin/accounts`), `controller/AdminUserController` (`/api/manager/users`) | `service/InternalAccountService`, `service/AdminUserService` → `UserRepository` | Entity `User`; test `AdminUserServiceTest`. |

### Khách hàng, sản phẩm và bán hàng

| Chức năng | Bắt đầu đọc | Theo tiếp | Database và test gợi ý |
| --- | --- | --- | --- |
| Hồ sơ khách hàng và địa chỉ | `controller/ProfileController` (`/api/customers/me`), `controller/AddressController` (`/api/customers/me/addresses`) | `service/AuthService`, `CustomerAddressRepository` | Entity `User`, `CustomerAddress`; test `CustomerProfileIntegrationTest`. |
| Hồ sơ khách hàng 360°, lịch sử hoạt động | `controller/CustomerProfileController` (`/api/manager/users/{id}/profile`) | `service/CustomerProfileService`, `CustomerActivityService`, `CustomerLifecycleQuery`, `CustomerLifecycle` | `CustomerCareNote`, `Order`, `Feedback`, `SurveyResponse`, `VoucherUsage`; test `CustomerLifecycleIntegrationTest`, `CustomerActivityPostgresTest`, `CustomerProfileIntegrationTest`. |
| Danh mục sản phẩm công khai | `controller/ProductController` (`/api/products`) | `ProductRepository.searchCatalog()` | Entity `Product`, `Category`; test `ProductCatalogSearchTest`. |
| Quản lý sản phẩm, tồn cơ bản, nhà cung cấp | `controller/AdminProductController` (`/api/manager/products`), `controller/DirectoryController` (sản phẩm/nhà cung cấp) | `service/AdminProductService`, `DirectoryService`, `ProductRepository`, `SupplierRepository` | Entity `Product`, `Category`, `Supplier`; migration `002_manager_portal.sql`. |
| Giỏ hàng | `controller/CartController` (`/api/cart`) | `service/CartService` → `CartItemRepository`, `ProductRepository` | Entity `CartItem`; tìm test bằng `CartService` nếu cần lần kỹ từng thao tác. |
| Danh sách yêu thích | `controller/WishlistController` (`/api/wishlist`) | `WishlistItem` và repository tương ứng | Entity `WishlistItem`; xem các method thêm/xóa trong Controller và Repository. |
| Voucher và khuyến mãi | `controller/VoucherController` (kiểm tra/sử dụng), `controller/AdminVoucherController` (quản lý) | `service/VoucherService`; tiếp tục sang `OrderService.create()` để xem voucher được áp dụng lúc tạo đơn | `StoreVoucher`, `VoucherUsage`; migrations `005_voucher_management.sql`, `006_review_survey_rewards.sql`, `011_cashflow_voucher_customer_limit.sql`; test `VoucherServiceTest`, `VoucherIntegrationTest`. |

### Đơn hàng, thanh toán và đánh giá

| Chức năng | Bắt đầu đọc | Theo tiếp | Database và test gợi ý |
| --- | --- | --- | --- |
| Tạo và xem đơn hàng của khách | `controller/OrderController` (`POST/GET /api/orders`) | `service/OrderService.create()` → `OrderRepository`, `ProductRepository`, `CartItemRepository`, `VoucherService`, `StockService` | Entity `Order`, `OrderItem`; test `OrderConfirmationTest`, `CustomerOrderActivityIntegrationTest`. |
| Danh sách/chi tiết đơn Manager, đổi trạng thái, gán nhân viên | `controller/AdminOrderController` (`/api/manager/orders`) | `service/ManagerOrderQuery` đọc; `service/AdminOrderService` cập nhật | `OrderRepository`, `Order`, `OrderItem`, `OrderReturnEvent`; test `AdminOrderServiceTest`, `ManagerQueryIntegrationTest`. |
| PayOS, webhook, đồng bộ và thử thanh toán lại | `controller/OrderController` (payment/sync/retry/return/webhook) | `service/PayosService`, `PaymentReconciliationService`, `OrderService` | Entity `Payment`, `PaymentAttempt`, `PaymentWebhookEvent`; migrations `007_payos_qr.sql`, `008_payos_attempts.sql`; test `PayosQrTest`, `PaymentLifecycleIntegrationTest`, `OrderEmailTransactionTest`. |
| Thu COD và đối soát thanh toán | `controller/ManagerPaymentController` (`/api/manager/orders/{id}/cod-collection`, `/payment/reconcile`) | `service/PaymentCollectionService`, `PaymentReconciliationService` | `Order.codCollectedAt`, `Order.codCollectedAmount`, `Payment`; test `PaymentLifecycleIntegrationTest`, `CashflowReportIntegrationTest`. |
| Xác nhận nhận hàng và đổi trả | `controller/OrderController` (khách), `controller/ManagerReturnController` (Manager) | `service/ReturnManagementService`, `OrderService` | Entity `OrderReturnEvent`; migration `009_return_management.sql`; test `ReturnManagementIntegrationTest`, `ReturnConcurrencyTest`; tài liệu [`return-management.md`](../features/return-management.md). |
| Hoàn tiền — trạng thái code hiện tại | Bắt đầu bằng route trong Controller và kiểm tra có Controller nào đăng ký route hay không | Route quản lý hoàn tiền đã được gỡ; `RefundService`, `OrderRefund` và migration `010_refunds_abandoned_payos.sql` còn là code/dữ liệu lịch sử cần lần theo tham chiếu trước khi coi là luồng đang hoạt động | Test `PaymentLifecycleIntegrationTest` xác nhận route cũ không còn và việc hủy đơn vẫn giữ bằng chứng thanh toán. |
| Đánh giá sản phẩm | `controller/FeedbackController` (khách), `controller/AdminFeedbackController` (quản lý) | Repository `FeedbackRepository`; theo điều kiện đơn đã hoàn thành và chỉ đánh giá sản phẩm trong đơn | Entity `Feedback`; migrations `004_feedback_moderation.sql`, `006_review_survey_rewards.sql`; test `AdminFeedbackServiceTest`, `ReturnManagementIntegrationTest`; tài liệu [`reviews-rewards.md`](../database/reviews-rewards.md). |

### Khảo sát, chăm sóc khách hàng và hỗ trợ

| Chức năng | Bắt đầu đọc | Theo tiếp | Database và test gợi ý |
| --- | --- | --- | --- |
| Khách làm khảo sát | `controller/SurveyController` (`/api/surveys`) | `service/SurveyValidation`, `SurveyRepository`, `SurveyResponseRepository` | Entity `Survey`, `SurveyQuestion`, `SurveyAnswer`, `SurveyResponse`; test `SurveyRecipientGroupIntegrationTest`. |
| Manager tạo/publish khảo sát, lọc người nhận, đặt thưởng | `controller/AdminSurveyController` (`/api/manager/surveys`), `controller/AdminSurveyStatsController` | `service/AdminSurveyService`, `SurveyRewardService`, `SurveyValidation` | Entity `SurveyReward`, `StoreVoucher`, `VoucherUsage`; migrations `003_survey_management.sql`, `006_review_survey_rewards.sql`; test `AdminSurveyServiceTest`, `SurveyRecipientGroupIntegrationTest`. |
| Dashboard chăm sóc, khách ít hoạt động, task và ghi chú | `controller/CustomerCareController` (`/api/manager/care/...`) | `service/CustomerCareService`, `CareDashboardService`, `ManagerCareInbox` | Entity `CustomerCareTask`, `CustomerCareNote`; migration `012_customer_care.sql`; test `CustomerCareIntegrationTest`, `CareWorkflowIntegrationTest`, `CareSourceConcurrencyTest`. |
| Nguồn chăm sóc, kết quả và nhắc việc | `controller/CareOutcomeReportController`, `CustomerCareController`, `ManagerCareInboxController` | `CareOutcomeReportService`, `CareReminderService`, `CareReminderRules`, `CareReminderScheduler` | Migrations `013_care_sources.sql` đến `015_care_reminders.sql`; test nhóm `CareSource*`, `CareOutcome*`, `CareReminder*`; tài liệu trong `docs/features/care-*.md`. |
| Phiếu hỗ trợ | `controller/SupportTicketController` (khách và Manager) | `service/SupportTicketService` | Entity `SupportTicket`, `CustomerNotification`; migration `017_support_tickets.sql`; test `SupportTicketIntegrationTest`, `SupportTicketConcurrencyTest`, `SupportTicketPostgresTest`. |
| Thông báo | `controller/NotificationController` (khách), `ManagerCareInboxController` (Manager) | `service/NotificationService`, `CustomerNotificationRepository` | Entity `CustomerNotification`; migration `015_care_reminders.sql` bổ sung liên kết nhắc việc; test `CareReminderIntegrationTest`, `SupportTicketIntegrationTest`. |

### Nhập kho, báo cáo, audit và tác vụ nền

| Chức năng | Bắt đầu đọc | Theo tiếp | Database và test gợi ý |
| --- | --- | --- | --- |
| Tạo/xem phiếu nhập kho | `controller/StockReceiptController` (`/api/manager/stock-receipts`) | `service/StockReceiptService.receive()` ghi phiếu, dòng sản phẩm, cập nhật tồn và audit | Entity `StockReceipt`, `StockReceiptItem`, `Supplier`, `Product`; Repository `StockReceiptRepository`; migration `019_stock_receipts.sql`; tài liệu [`stock-receipts.md`](../features/stock-receipts.md). |
| Thống kê tiền thu theo tháng/quý/năm, nhân viên, sản phẩm | `controller/SalesStatisticsController` (`/api/manager/reports/sales-statistics`) | `service/SalesStatisticsService.report()`; phần này dùng SQL qua `NamedParameterJdbcTemplate`, không chỉ dựa vào JPA Repository | Đọc `orders`, `order_items`, `stock_receipts`; migrations `018_sales_statistics.sql`, `019_stock_receipts.sql`; test quyền endpoint trong `CashflowReportIntegrationTest`. |
| Chi nhập kho theo năm | `controller/InventoryExpenseReportController` (`/api/manager/reports/inventory-expenses`) | `service/InventoryExpenseReportService` → SQL theo các phiếu đã ghi sổ | Bảng `stock_receipts`; migration `019_stock_receipts.sql`. |
| Báo cáo khách hàng, doanh thu cũ, khảo sát | `controller/AdminReportController`, `AdminAnalyticsController` | `AdminReportService`, `AnalyticsService` | Đọc truy vấn trong service trước để biết định nghĩa chỉ số; test `AnalyticsServiceTest`, `CashflowReportIntegrationTest`. |
| Giữ chân khách hàng | `controller/RetentionReportController` | `service/RetentionReportService`, `CustomerLifecycleQuery`, `CustomerLifecycle` | Test `RetentionReportIntegrationTest`, `CustomerLifecycleIntegrationTest`; tài liệu [`retention-report.md`](../features/retention-report.md). |
| Audit log | `controller/AuditLogController` | `service/AuditLogQuery` để đọc; `service/AuditTrail` để ghi tại các nghiệp vụ | Entity `AuditLog`, `AuditLogRepository`; migration `016_audit_logs.sql`; test `AuditLogIntegrationTest`, `AuditLogPostgresTest`. |
| Tự hủy đơn thanh toán quá hạn | `service/AbandonedOrderScheduler` | `AbandonedOrderWorker` → `PayosService`, `PaymentReconciliationService`, `StockService` | `Order`, `Payment`, `PaymentAttempt`; test `AbandonedOrderSchedulerTest`, `PaymentLifecycleIntegrationTest`; tài liệu [`refunds-auto-cancellation.md`](../features/refunds-auto-cancellation.md). |
| Email giao dịch | `service/TransactionalMail` | Tìm nơi phát event và listener `@TransactionalEventListener` để xem email được gửi ở thời điểm nào | Test `OrderEmailTransactionTest`, `ResendRecoveryTest`; cấu hình liên quan trong `backend/src/main/resources/application.yml`. |

## Đọc database cho đúng

- Entity có `@Entity`/`@Table` là ánh xạ dữ liệu ở Java; migration SQL mới cho biết bảng/cột/index được tạo hoặc đổi thế nào.
- Repository thường là JPA. Với `SalesStatisticsService` và một số báo cáo, tìm `NamedParameterJdbcTemplate` vì SQL nằm ngay trong Service.
- Cài database mới: đọc `database/schema.sql` và hướng dẫn seed. Database đang có dữ liệu: đối chiếu migration hiện tại trước khi áp dụng; không chạy lại schema/seed lên database đang dùng.
- Khi một class có vẻ không được gọi, tìm references (`Shift+F12`) và route Controller trước khi kết luận nó là luồng đang chạy.

## Lộ trình học đề xuất

1. Đọc một API đơn giản: danh sách sản phẩm (`ProductController` → `ProductRepository`).
2. Đọc luồng có nhiều nghiệp vụ: tạo đơn (`OrderController` → `OrderService` → voucher/stock/payment → repository).
3. Đọc luồng ghi kho (`StockReceiptController` → `StockReceiptService` → entity/repository → migration 019).
4. Đọc luồng báo cáo (`SalesStatisticsController` → `SalesStatisticsService` → SQL → migrations 018/019).
5. Sau đó mới mở rộng sang bảo mật, scheduler, audit và các test concurrency.
