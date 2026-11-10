# Changelog đặc tả Use Case v2

## 1. Đối chiếu 19 Use Case cũ

Quy ước: trạng thái phản ánh cả actor/quyền và hành vi. Các UC quản trị cũ đổi actor từ `Admin` sang `Manager` do code bảo vệ nghiệp vụ tại `/api/manager`; phần hành vi cốt lõi nào khớp được ghi rõ trong điểm lệch.

| Mã | Trạng thái | Điểm lệch | Bằng chứng (file/hàm/route) |
|---|---|---|---|
| UC-A01 | ⚠️ LỆCH | Actor thành Manager; không có duyệt/từ chối. Manager cập nhật NEW/IN_PROGRESS/RESOLVED, phản hồi, ẩn hoặc xóa mềm; không gửi thông báo khách khi xử lý. | `controller/AdminFeedbackController.java` `/api/manager/feedback`; `service/AdminFeedbackService.java` `update`, `delete` |
| UC-A02 | ✅ KHỚP (chỉ đổi actor) | Luồng tra cứu khớp; code phân quyền actor là Manager. Hồ sơ 360° được tách thành UC-A14. | `controller/AdminUserController.java` `/api/manager/users`; `service/AdminUserService.java` `list`, `get`; `controller/CustomerProfileController.java` |
| UC-A04 | ⚠️ LỆCH | Actor thành Manager; khóa đã khóa trả 409; mở khóa không cần lý do; khóa gửi thông báo và thu hồi refresh token; audit chỉ khi dữ liệu đổi. | `service/AdminUserService.java` `lock`, `unlock`; `controller/AdminUserController.java` `/lock`, `/unlock` |
| UC-A05 | ⚠️ LỆCH | Actor thành Manager; báo cáo không nhận bộ lọc, có phân bố tuổi, sở thích và số tài khoản khóa. | `controller/AdminAnalyticsController.java` `/api/manager/reports/customers`; `service/AnalyticsService.java` `customers` |
| UC-A06 | ⚠️ LỆCH | Actor thành Manager; xóa sản phẩm là lưu trữ; có cập nhật tồn kho/gán nhà cung cấp; code không quản lý giá vốn. | `service/AdminProductService.java` `archive`, `updateStock`; `controller/DirectoryController.java` `/api/manager/suppliers` |
| UC-A07 | ⚠️ LỆCH | Actor thành Manager; chỉ tạo, cấu hình thưởng, publish/unpublish, xóa; không có API cập nhật nội dung khảo sát; audience là ALL/SELECTED; publish gửi thông báo. | `service/AdminSurveyService.java` `create`, `reward`, `publish`, `delete`; `controller/AdminSurveyController.java` |
| UC-A08 | ✅ KHỚP (chỉ đổi actor) | API thống kê trả tổng số khảo sát theo trạng thái; API kết quả trả số response và thống kê theo câu hỏi. Tỷ lệ chỉ có ở lựa chọn; câu trả lời văn bản có endpoint phân trang riêng. Actor theo code là Manager. | `AdminSurveyStatsController.java` `/api/manager/surveys/stats`; `AdminReportService.java` `surveyStats`; `AdminAnalyticsController.java` `/api/manager/reports/surveys/{id}/results`, `/api/manager/reports/surveys/{id}/questions/{questionId}/answers`; `AnalyticsService.java` `results`, `textAnswers` |
| UC-A09 | ⚠️ LỆCH | Actor thành Manager; chuyển trạng thái tiến về trước; hủy cần lý do; chặn khi đang giao, có đổi trả mở hoặc cần đối soát thanh toán. | `service/AdminOrderService.java` `canAdvance`, `updateStatus`; `controller/AdminOrderController.java` |
| UC-A10 | ✅ KHỚP (chỉ đổi actor) | Chức năng thêm Customer khớp; code phân quyền actor là Manager. | `controller/AdminUserController.java`; `service/AdminUserService.java` `create` |
| UC-A11 | ⚠️ LỆCH | Actor thành Manager; xóa luôn là xóa mềm, đồng thời khóa tài khoản và thu hồi phiên. | `service/AdminUserService.java` `delete`; `controller/AdminUserController.java` `delete` |
| UC-A12 | ⚠️ LỆCH | Actor thành Manager. `/reports/revenue` cộng totalAmount của đơn không hủy, kể cả chưa thanh toán; báo cáo dòng tiền UC-A22 đáp ứng FR-16 về kỳ, tổng doanh thu và sản phẩm bán chạy. | `controller/AdminReportController.java` `/api/manager/reports/revenue`; `service/AdminReportService.java` `revenue`; `controller/CashflowReportController.java`; `service/CashflowReportService.java` |
| UC-01 | ✅ KHỚP | Luồng đăng ký giữ theo code; điều kiện xác thực và định dạng mật khẩu đã có bằng chứng. | `controller/AuthController.java` `register`; `service/AuthService.java` `register` |
| UC-02 | ✅ KHỚP | Luồng đăng nhập Customer giữ; tài khoản bị khóa bị từ chối kèm lý do. | `controller/AuthController.java` `login`; `service/AuthService.java` `login`, `requireCustomer` |
| UC-03 | ✅ KHỚP | Luồng cập nhật hồ sơ Customer giữ; trường hồ sơ thực tế gồm tên, điện thoại, tuổi, sở thích. | `controller/ProfileController.java` `me`, `update` |
| UC-04 | ⚠️ LỆCH | Chỉ đơn COMPLETED mới được đánh giá; yêu cầu có orderId; duy nhất theo cặp đơn/sản phẩm. Đơn COMPLETED đã có đánh giá không được yêu cầu đổi trả. | `controller/FeedbackController.java` `create`; `service/OrderService.java` `requestReturn` |
| UC-05 | ✅ KHỚP | Xem/trả lời khảo sát giữ; code hỗ trợ đối tượng ALL/SELECTED và phát voucher thưởng theo cấu hình. | `controller/SurveyController.java` `active`, `mine`, `respond`; `service/SurveyRewardService.java` `grant` |
| UC-06 | ⚠️ LỆCH | Khách vãng lai được xem/tìm; gender mặc định NAM; chỉ sản phẩm active được liệt kê/xem. | `controller/ProductController.java` `catalog`, `detail` |
| UC-07 | ⚠️ LỆCH | UC cũ gộp giỏ hàng/đặt hàng nhưng nêu sai trạng thái và webhook. Code tạo PENDING; PayOS PENDING 15 phút, COD COD; tồn kho trừ khi tạo và chỉ hoàn khi hủy thành công, không hoàn ngay khi link hết hạn; webhook không xác nhận đơn. | `CartController.java` `/api/cart`; `VoucherController.java` `/api/vouchers/validate`; `OrderController.java` `/api/orders`; `OrderService.java` `create`, `webhook`; `PaymentReconciliationService.java`; `AbandonedOrderWorker.java` |
| UC-08 | ⚠️ LỆCH | Có tab/từ khóa; Manager cập nhật trạng thái; Customer xác nhận nhận hàng để đơn thành COMPLETED. | `service/OrderService.java` `history`, `confirmReceipt`; `service/AdminOrderService.java` `updateStatus` |

### UC bổ sung đã có trong code nhưng thiếu ở tài liệu cũ

- **UC-A03 — Đăng nhập cổng Manager:** login, refresh, logout cho Manager. Bằng chứng: `ManagerAuthController.java` `/api/manager/auth/*`. Đăng nhập Admin tách riêng tại UC-ADM01.
- Các UC mới khác được liệt kê tại mục 3; UC chỉ được thêm khi có route/controller/service tương ứng. Chức năng không có trong code được tách ở mục 5.

## 2. Tóm tắt thay đổi theo từng Use Case cũ đã chỉnh

| Mã | Actor | Tiền điều kiện | Luồng chính | Ngoại lệ | Quy tắc nghiệp vụ |
|---|---|---|---|---|---|
| UC-A01 | Admin → Manager | Bỏ giả định chỉ xử lý phản hồi chờ duyệt. | Duyệt/từ chối → cập nhật NEW/IN_PROGRESS/RESOLVED, phản hồi hoặc ẩn. | Không thêm nhánh thông báo lỗi giả định. | Không có trạng thái approve/reject; xóa mềm; xử lý không gửi thông báo cho khách. |
| UC-A02 | Admin → Manager | Giữ điều kiện tra cứu. | Giữ nội dung khớp; tách xem hồ sơ 360° thành UC-A14. | Giữ nhánh cũ. | Không nới quyền tra cứu. |
| UC-A04 | Admin → Manager | Tài khoản phải tồn tại; khóa cần lý do. | Khóa: gửi thông báo, thu hồi refresh token; mở khóa xóa lý do khóa. | Khóa tài khoản đã khóa trả conflict; mở khóa không cần lý do. | Audit chỉ ghi khi snapshot thay đổi. |
| UC-A05 | Admin → Manager | Không yêu cầu dữ liệu/bộ lọc do người dùng chọn. | Trả phân bố tuổi, sở thích, số tài khoản khóa. | Không có bộ lọc; dữ liệu rỗng được trả theo tổng hợp hiện có. | Không mô tả bộ lọc/khoảng thời gian không có trong code. |
| UC-A06 | Admin → Manager | Sản phẩm/danh mục phải tồn tại khi cập nhật. | Tạo/sửa, ngừng kinh doanh bằng archive, cập nhật tồn kho, gán nhà cung cấp. | Lỗi trường/định danh theo validation thực tế. | Không có giá vốn trong model quản trị đã kiểm tra. |
| UC-A07 | Admin → Manager | Manager có quyền; khảo sát cần câu hỏi và thời gian hợp lệ. | Tạo, cấu hình thưởng, publish/unpublish, xóa. | Không có API sửa nội dung khảo sát sau tạo. | Audience ALL/SELECTED; publish gửi thông báo. |
| UC-A08 | Admin → Manager | Khảo sát tồn tại; câu hỏi cần xem văn bản thuộc khảo sát. | Xem số lượng khảo sát theo trạng thái; xem tổng response, answered/skipped/invalid theo câu hỏi, cùng số lượng và tỷ lệ lựa chọn; yêu cầu riêng danh sách câu trả lời văn bản có phân trang. | Khảo sát/câu hỏi không tồn tại hoặc phân trang sai trả lỗi theo code. | Các route thống kê/kết quả không nhận bộ lọc thời gian. Tỷ lệ chỉ được trả cho câu hỏi lựa chọn; tổng mẫu và số đã trả lời được trả riêng. |
| UC-A09 | Admin → Manager | Đơn tồn tại; yêu cầu trạng thái hợp lệ. | Chuyển trạng thái theo chiều tiến; hủy cần lý do. | Conflict nếu chuyển ngược, hủy lúc đang giao, có return mở hoặc cờ payment review. | Hủy giải phóng tồn kho/voucher; PayOS chưa thanh toán chuyển paymentStatus phù hợp. |
| UC-A10 | Admin → Manager | Giữ điều kiện thêm Customer. | Giữ luồng cũ. | Giữ nhánh cũ. | Bằng chứng xác nhận tạo Customer bởi Manager. |
| UC-A11 | Admin → Manager | Customer tồn tại. | Đánh dấu xóa, khóa tài khoản, thu hồi phiên. | Không có xóa vật lý trong luồng này. | Xóa mềm. |
| UC-A12 | Admin → Manager | Có dữ liệu đơn hàng. | Tách tổng doanh thu đơn không hủy khỏi báo cáo dòng tiền có khoảng ngày/nhóm ngày-tháng. | Báo cáo revenue có thể tính cả đơn chưa thanh toán. | Không ghi lợi nhuận hay top sản phẩm cho UC-A12. |
| UC-04 | Customer | Đơn thuộc Customer và COMPLETED; sản phẩm nằm trong đơn. | Gửi đánh giá với orderId và sản phẩm. | Trùng đánh giá theo đơn/sản phẩm bị từ chối. | Đơn COMPLETED có đánh giá chặn yêu cầu đổi trả. |
| UC-06 | Khách vãng lai | Không cần đăng nhập. | Tìm/lọc/xem catalog; mặc định gender NAM. | Sản phẩm không active hoặc không tồn tại không được xem chi tiết. | Catalog công khai chỉ lấy sản phẩm active. |
| UC-07 | Customer | Đăng nhập; địa chỉ giao hàng và sản phẩm hợp lệ. | Cập nhật giỏ, xác nhận checkout; đơn PENDING; trừ tồn kho; COD hoặc PAYOS; voucher tùy chọn. | Hết hàng/dữ liệu sai bị từ chối; PayOS có xử lý trạng thái riêng. | PAYOS 15 phút; webhook chỉ xác nhận thanh toán, không đổi đơn sang CONFIRMED. |
| UC-08 | Customer/Manager | Customer chỉ xem đơn của mình; Manager có quyền nghiệp vụ. | Customer lọc lịch sử; Manager tiến trạng thái; Customer xác nhận nhận hàng. | Không chuyển ngược trạng thái; xác nhận khi DELIVERED và returnStatus NONE/null; gọi lại COMPLETED là idempotent. | Xác nhận của Customer đưa đơn sang COMPLETED. |

Các UC-A02, UC-A08, UC-A10 khớp hành vi và chỉ đổi actor Admin thành Manager theo phân quyền code. UC-01/02/03/05 cũng khớp; các đặc tả được giữ và bổ sung truy vết.

## 3. UC mới và bằng chứng

### Customer

| Mã | Use Case | Bằng chứng code |
|---|---|---|
| UC-09 | Đặt lại mật khẩu (email Resend tùy chọn; fallback development; demo tắt cả hai cờ; gửi email chưa được xác minh) | `AuthController.java` `forgotPassword`, `resetPassword`; `AuthService.java` `requestPasswordReset`, `resetPassword` |
| UC-10 | Đổi mật khẩu | `AuthController.java` `changePassword`; `AuthService.java` `changePassword` |
| UC-11 | Quản lý sổ địa chỉ | `AddressController.java` list/create/update/delete/default; `AddressService.java` |
| UC-12 | Quản lý wishlist | `WishlistController.java` list/add/remove |
| UC-13 | Xem thông báo | `NotificationController.java` list/read/readAll |
| UC-14 | Xem ví voucher | `VoucherController.java` `/api/customers/me/vouchers`; UC-07 dùng route kiểm tra voucher khi checkout |
| UC-15 | Hủy đơn hàng | `OrderController.java` `/api/orders/{id}/cancel`; `OrderService.java` `cancel` |
| UC-16 | Xác nhận nhận hàng | `OrderController.java` `/api/orders/{id}/confirm-receipt`; `OrderService.java` `confirmReceipt` |
| UC-17 | Yêu cầu đổi trả | `OrderController.java` `/api/orders/{id}/return`; `OrderService.java` `requestReturn` |
| UC-18 | Thanh toán lại hoặc đồng bộ thanh toán | `OrderController.java` `/payment/retry`, `/payment/sync`; `OrderService.java` `retryPayment`, `syncPayment` |
| UC-19 | Gửi và theo dõi phiếu hỗ trợ | `SupportTicketController.java`; `SupportTicketService.java` `create`, `list`, `detail`, `reply` |

### Manager

| Mã | Use Case | Bằng chứng code |
|---|---|---|
| UC-A03 | Đăng nhập cổng Manager | `ManagerAuthController.java` `/api/manager/auth/*` |
| UC-A13 | Quản lý voucher | `AdminVoucherController.java` `/api/manager/vouchers`; `AdminVoucherService.java` `createFromJson`, `update`, `list` |
| UC-A14 | Xem hồ sơ khách hàng 360° | `CustomerProfileController.java`; `CustomerProfileService.java` `profile`, `addresses`, `orders`, `feedback`, `surveys`, `vouchers`, `voucherUsages`; `CustomerActivityService.java` `list` |
| UC-A15 | Quản lý nhà cung cấp | `DirectoryController.java`; `DirectoryService.java` |
| UC-A16 | Hoàn tiền, thu COD và đối soát thanh toán (ghi nhận thủ công; không gửi lệnh hoàn tới PayOS) | `ManagerRefundController.java`; `RefundService.java`; `PaymentReconciliationService.java`; `PayosService.java` |
| UC-A17 | Xử lý yêu cầu đổi trả | `ManagerReturnController.java`; `ReturnManagementService.java` |
| UC-A18 | Xử lý phiếu hỗ trợ | `SupportTicketController.java`; `SupportTicketService.java` `update`, `reply` |
| UC-A19 | Chăm sóc khách hàng | `CustomerCareController.java`; `CustomerCareService.java`; `CareDashboardService.java`; `CareReminderScheduler.java` |
| UC-A20 | Xem kết quả chăm sóc | `CareOutcomeReportController.java`; `CareOutcomeReportService.java` |
| UC-A21 | Xem báo cáo giữ chân | `RetentionReportController.java`; `RetentionReportService.java`; `CustomerLifecycle.java` |
| UC-A22 | Xem báo cáo dòng tiền | `CashflowReportController.java`; `CashflowReportService.java` |
| UC-A23 | Xem thông báo công việc nội bộ | `ManagerCareInboxController.java`; `ManagerCareInbox.java` |

### Admin

| Mã | Use Case | Bằng chứng code |
|---|---|---|
| UC-ADM01 | Đăng nhập Admin Portal | `AdminAuthController.java`; `AdminAuthService.java` |
| UC-ADM02 | Quản lý tài khoản nội bộ | `InternalAccountController.java`; `InternalAccountService.java` |
| UC-ADM03 | Xem audit log | `AuditLogController.java`; `AuditLogQuery.java` `list` |
| UC-ADM04 | Xem tổng quan hệ thống | `DirectoryController.java` `/api/admin/overview`; `DirectoryService.java` `overview` |
| UC-ADM05 | Xem danh mục sản phẩm và nhà cung cấp | `DirectoryController.java` `/api/admin/products`, `/api/admin/suppliers`; chế độ đọc theo phạm vi được phép tại PRD mục 5.2. |

## 4. Quyết định đã chốt và điểm cần xác nhận

### Quyết định đã chốt

- **Audit log:** Chỉ Admin tra cứu audit log qua `/api/admin/audit-logs`; không có endpoint hoặc điều hướng audit cho Manager. Lịch sử hoạt động Customer được xem riêng trong hồ sơ 360°.
- **Đặt lại mật khẩu:** Code hỗ trợ tùy chọn gửi liên kết đặt lại qua Resend khi được cấu hình, dùng token 43 ký tự và không trả mã trong response email. Fallback mã sáu chữ số chỉ bật bằng `DEV_PASSWORD_RESET_ENABLED` ở development. Demo/nghiệm thu giữ `RESEND_ENABLED=false` và `DEV_PASSWORD_RESET_ENABLED=false`; chưa xác minh gửi/nhận email hoặc vận hành production.
- **Tự hủy PayOS:** demo/nghiệm thu bật `PAYOS_AUTO_CANCEL_ENABLED=true` và đặt grace 24 giờ; mặc định code vẫn `false`.

### Điểm cần xác nhận

1. `/reports/cashflow` đáp ứng FR-16 về kỳ báo cáo, tổng doanh thu, sản phẩm bán chạy và bằng chứng dữ liệu. Riêng `/reports/revenue` cộng cả đơn chưa thanh toán; có cần giữ UC-A12 kèm cảnh báo số liệu này có thể bị hiểu là doanh thu đã thu?
2. PRD mục 5.2 cho phép Admin xem các danh mục được phép đọc; cần xác nhận `/api/admin/products` và `/api/admin/suppliers` giới hạn đúng phạm vi được phép và không mở thao tác ghi.
3. PRD xếp hoàn tiền production và đối soát production ngoài MVP; code có quy trình ghi nhận hoàn tiền thủ công, thu COD và đối soát PayOS. Phần nào được trình bày là chức năng demo, phần nào ngoài nghiệm thu?

## 5. Khoảng trống so với PRD và rủi ro

### Khoảng trống so với PRD

- **FR-16:** `/reports/cashflow` đáp ứng kỳ báo cáo, tổng doanh thu, sản phẩm bán chạy và bằng chứng dữ liệu. Rủi ro còn lại ở `/reports/revenue`: endpoint cộng totalAmount của đơn chưa hủy kể cả đơn chưa thanh toán, nên số này không đại diện riêng cho khoản tiền đã thu.
- **Khôi phục mật khẩu:** Code hỗ trợ tùy chọn gửi liên kết đặt lại qua Resend khi được cấu hình, dùng token 43 ký tự và không trả mã trong response email. Fallback mã sáu chữ số chỉ bật bằng `DEV_PASSWORD_RESET_ENABLED` ở development. Demo/nghiệm thu giữ `RESEND_ENABLED=false` và `DEV_PASSWORD_RESET_ENABLED=false`; chưa xác minh gửi/nhận email hoặc vận hành production.
- **Refund/reconciliation production:** PRD mục 3.2 ghi hoàn tiền và đối soát production ngoài phạm vi. Code có quy trình nội bộ để ghi nhận yêu cầu/kết quả hoàn tiền, thu COD và đối soát PayOS; không xác nhận giao dịch hoàn tiền với cổng thanh toán bên ngoài.
- **Giao vận thực tế:** PRD ngoài phạm vi tích hợp vận chuyển; không thấy controller tích hợp hãng vận chuyển trong 34 controller được quét.

### Rủi ro trong code cần lưu ý

- **Khôi phục mật khẩu:** Code hỗ trợ tùy chọn gửi liên kết đặt lại qua Resend khi được cấu hình, dùng token 43 ký tự và không trả mã trong response email. Fallback mã sáu chữ số chỉ bật bằng `DEV_PASSWORD_RESET_ENABLED` ở development. Demo/nghiệm thu giữ `RESEND_ENABLED=false` và `DEV_PASSWORD_RESET_ENABLED=false`; chưa xác minh gửi/nhận email hoặc vận hành production.
- Hoàn tiền thủ công và đối soát thanh toán có code nhưng PRD xếp hoạt động production tương ứng ngoài MVP; không mô tả đây là tích hợp hoàn tiền tự động.
- `/api/manager/reports/revenue` cộng `totalAmount` của đơn không hủy, kể cả chưa thanh toán; số liệu có thể bị hiểu nhầm là doanh thu đã thu.
- PayOS webhook cập nhật trạng thái thanh toán; không tự chuyển đơn từ PENDING sang CONFIRMED. Luồng nghiệp vụ phải giữ hai trạng thái riêng.
- Ranh giới quyền danh mục: PRD mục 5.2 cho phép ADMIN đọc danh mục được phép; cần bảo đảm `/api/admin/products` và `/api/admin/suppliers` chỉ đọc đúng phạm vi được cấp. Chỉ Admin tra cứu audit log qua `/api/admin/audit-logs`; không có endpoint hoặc điều hướng audit cho Manager. Lịch sử hoạt động Customer được xem riêng trong hồ sơ 360°. Phân bố vai trò trong dữ liệu lịch sử chưa được kiểm tra.

## 6. Danh sách controller được quét và ánh xạ

Đếm theo lớp có `@RestController` trong `backend/src/main/java/com/htttdn/crm/controller`: hiện có **34 controller**, không phải 35. Không bỏ sót controller nghiệp vụ nào; các controller được ánh xạ như sau:

| Controller | UC được truy vết |
|---|---|
| AddressController | UC-11 |
| AdminAnalyticsController | UC-A05, UC-A08 |
| AdminAuthController | UC-ADM01 |
| AdminFeedbackController | UC-A01 |
| AdminOrderController | UC-A09 |
| AdminProductController | UC-A06 |
| AdminReportController | UC-A05, UC-A08, UC-A12 |
| AdminSurveyController | UC-A07 |
| AdminSurveyStatsController | UC-A08 |
| AdminUserController | UC-A02, UC-A04, UC-A10, UC-A11 |
| AdminVoucherController | UC-A13 |
| AuditLogController | UC-ADM03; chỉ Admin tra cứu audit log |
| AuthController | UC-01, UC-02, UC-09, UC-10 |
| CareOutcomeReportController | UC-A20 |
| CartController | UC-07 |
| CashflowReportController | UC-A22 |
| CustomerCareController | UC-A19 |
| CustomerProfileController | UC-A14 |
| DirectoryController | UC-A15, UC-ADM04, UC-ADM05 |
| FeedbackController | UC-04 |
| InternalAccountController | UC-ADM02 |
| ManagerAuthController | UC-A03 |
| ManagerCareInboxController | UC-A23 |
| ManagerRefundController | UC-A16 |
| ManagerReturnController | UC-A17 |
| NotificationController | UC-13 |
| OrderController | UC-07, UC-08, UC-15, UC-16, UC-17, UC-18 |
| ProductController | UC-06 |
| ProfileController | UC-03 |
| RetentionReportController | UC-A21 |
| SupportTicketController | UC-19, UC-A18 |
| SurveyController | UC-05 |
| VoucherController | UC-07, UC-14 |
| WishlistController | UC-12 |
| AdminPageSupport | Không phải controller/route; helper hiển thị, không là Use Case độc lập. |
| ApiExceptionHandler | Không phải `@RestController`; mapper lỗi dùng chung, không phải chức năng actor khởi tạo. |

## 7. Chức năng/nhánh chưa có bằng chứng triển khai đầy đủ

Các nội dung dưới đây không được trình bày như hành vi đang có trong các Use Case v2. Chúng được giữ riêng để quyết định tiếp tục làm phạm vi tương lai hay bỏ khỏi tài liệu hiện hành:

- **Duyệt/từ chối feedback và báo kết quả cho khách:** UC-A01 cũ mô tả approve/reject và thông báo. Code chỉ có trạng thái NEW/IN_PROGRESS/RESOLVED, phản hồi, ẩn và xóa mềm; không thấy hành động approve/reject hoặc thông báo khi Manager xử lý.
- **Sửa nội dung khảo sát sau khi tạo:** UC-A07 cũ có nhánh sửa khảo sát; controller hiện có tạo, phần thưởng, publish/unpublish và xóa, không có route update nội dung.
- **Nghiệm thu email production:** code đã có gửi reset qua Resend tùy chọn; chưa xác minh gửi/nhận thực tế hoặc vận hành production. Demo giữ cả hai cờ email/development tắt.
- **Hoàn tiền qua cổng thanh toán production:** code ghi nhận hoàn tiền thủ công; chưa thấy thao tác gửi lệnh hoàn tới PayOS.
- **Tích hợp đơn vị vận chuyển thực tế:** PRD loại khỏi phạm vi MVP; không có controller tích hợp hãng vận chuyển trong 34 controller đã kiểm tra.

## 8. Các con số và giới hạn được ghi trong v2

| Con số/quy tắc | Nguồn code |
|---|---|
| Email: token 43 ký tự, không trả mã; development: fallback sáu chữ số; hiệu lực 15 phút, demo tắt cả hai cờ | `AuthController.java`; `AuthService.java`; `application.yml` |
| Password Customer tối thiểu 8 ký tự, phải có chữ và số; giới hạn request 72 ký tự | `AuthService.java` `validatePassword`; `AuthController.java` `RegisterRequest`, `ChangePasswordRequest`, `ResetPasswordRequest` |
| HTTP lỗi 400/401/403/404/409/423 xuất hiện trong các luồng cũ được giữ | `ApiExceptionHandler.java`; `AdminAccessGuard.java`; `AuthService.java` `login`, `requireCustomer`; `SurveyController.java` `respond` |
| Feedback rating 1–5; comment tối đa 4.000 ký tự | `FeedbackController.java` `FeedbackRequest`, `create` |
| Phản hồi Manager tối đa 4.000 ký tự | `AdminFeedbackService.java` `update` |
| Đơn PayOS hết hạn sau 15 phút; lịch dọn đơn chạy theo khoảng mặc định 300.000 ms; chỉ khi `PAYOS_AUTO_CANCEL_ENABLED=true` mới áp dụng thời gian chờ tự hủy mặc định 24 giờ (cờ mặc định `false`; demo/nghiệm thu bật) | `OrderService.java` `create`; `AbandonedOrderScheduler.java`; `AbandonedOrderWorker.java` |
| Lịch sử đơn mặc định 10 mục/trang, tối đa 50 | `OrderController.java` `history`; `OrderService.java` `history` |
| Manager hủy đơn cần lý do 1–1.000 ký tự | `AdminOrderService.java` `updateStatus` |
| Ghi chú từ chối/hoàn tất đổi trả tối đa 1.000 ký tự | `ReturnManagementService.java` `process` |
| Danh sách thông báo Customer tối đa 50 mục | `NotificationController.java` `list` |
| Ví voucher mặc định 20 mục/trang | `VoucherController.java` `mine` |
| Phiếu hỗ trợ: tiêu đề tối đa 150, nội dung tối đa 4.000 ký tự; tối đa 200 tin nhắn trao đổi | `SupportTicketService.java` `create`, `append` |
| Báo cáo dòng tiền mặc định 30 ngày; tối đa 366 ngày; nhóm day/month; top 10 sản phẩm | `CashflowReportService.java` `report` |
| Nhóm LOYAL: ít nhất 5 đơn hoàn tất hoặc 5.000.000 VND; dormant từ 30 ngày; Asia/Ho_Chi_Minh | `CustomerLifecycle.java` `calculate`; `RetentionReportService.java` `report` |
| Nhắc việc nội bộ mặc định theo chu kỳ 60 giây | `CareReminderScheduler.java` `tick` |
| Tài khoản nội bộ: mật khẩu ít nhất 8 ký tự, tối đa 72 byte; trang danh sách tối đa 100 mục | `InternalAccountService.java` validation/list |

## 9. Thống kê bản v2

- **19 UC cũ:** 12 lệch hành vi; 3 khớp hành vi nhưng đổi actor (UC-A02/A08/A10); 4 khớp (UC-01/02/03/05). Không có Use Case cũ nào bị bỏ vì không có code.
- **UC thiếu được bổ sung:** UC-A03 cho đăng nhập Manager; Admin login tách ở UC-ADM01.
- **UC mới:** 28 (12 Manager gồm UC-A03 và UC-A13–A23; 11 Customer UC-09–UC-19; 5 Admin UC-ADM01–UC-ADM05).
- **Tổng UC trong ba tài liệu v2:** 47.
- **Controller:** 34 lớp `@RestController` được quét và ánh xạ; con số yêu cầu 35 không trùng với checkout hiện tại. Không có controller nghiệp vụ nào bị bỏ qua.

## 10. Nguồn tài liệu

- Code ưu tiên đối chiếu: `backend/src/main/java/com/htttdn/crm`.
- PRD: `docs/prd-htttdn-crm.md`, nhất là mục 3.1–3.2, bảng role và FR-09–FR-20.
- Tài liệu cũ được giữ nguyên: `docs/use-cases/admin/admin-use-case-specifications.docx`, `docs/use-cases/customer/customer-use-case-specifications.docx`.

## 11. Cập nhật theo nhận xét review

- UC-A08 được viết lại theo route và dữ liệu trả về thực tế: số khảo sát theo trạng thái; tổng response; answered/skipped/invalid; số lượng và tỷ lệ chỉ cho lựa chọn; danh sách câu trả lời văn bản phân trang riêng. Không mô tả lọc thời gian hoặc xử lý nền.
- UC-A02, UC-A08, UC-A10 được phân loại khớp hành vi, chỉ đổi actor từ Admin sang Manager. Thống kê 19 UC cũ là 12 lệch hành vi, 3 khớp nhưng đổi actor và 4 khớp.
- FR-16 được đáp ứng bởi `/reports/cashflow`; rủi ro ghi nhận riêng là `/reports/revenue` tính cả đơn chưa thanh toán.
- Bảng trạng thái ở cả ba tài liệu ghi rõ PENDING_PAYMENT là trạng thái cũ, OrderService.create tạo PENDING; PREPARING/DELIVERING chỉ là mốc PROGRESS, không thuộc STATUSES. UC-15 nêu rõ các trạng thái và cờ đối soát chặn hủy theo OrderService.cancel.
- Bỏ dòng mô tả trùng ở UC mới theo phạm vi review và in đậm tiêu đề cột Nội dung ở các UC được chỉ định.
- UC-ADM05 bỏ nhãn cần xác nhận; giữ ranh giới danh mục chỉ đọc theo PRD mục 5.2 và ghi chú quyền ở phần rủi ro.
- UC-09 phân biệt email Resend tùy chọn và fallback development; demo tắt cả hai cờ, production chưa được xác minh. UC-A16 ghi nhận hoàn tiền thủ công, không gửi lệnh hoàn PayOS.
- **Audit log:** Chỉ Admin tra cứu audit log qua `/api/admin/audit-logs`; không có endpoint hoặc điều hướng audit cho Manager. Lịch sử hoạt động Customer được xem riêng trong hồ sơ 360°.
- Ba tệp PlantUML độc lập, mỗi tệp có đúng một `@startuml`: [Customer/Khách vãng lai](use-case-diagrams-v2.puml), [Manager](use-case-diagrams-manager-v2.puml), [Admin](use-case-diagrams-admin-v2.puml), kèm PNG cùng tên. UC-13/UC-14 nối Customer; PayOS là tác nhân phụ của UC-07, UC-18 và nhánh đối soát UC-A16; hoàn tiền UC-A16 chỉ ghi nhận thủ công, không gọi PayOS refund API.

## 12. Đối chiếu ngày 26/10/2026

- Các sequence vận hành cũ trong `admin/` dùng actor Manager; tên thư mục được giữ để bảo toàn liên kết. M-15 trong `manager/` biểu diễn audit chỉ dành cho Admin.
- Feedback không có approve/reject hoặc email/SMS; thống kê khảo sát không có CSAT; revenue không có lợi nhuận.
- PayOS tạo đơn PENDING, webhook chỉ cập nhật paymentStatus PAID; thất bại không giải phóng tồn kho ngay. Feedback yêu cầu COMPLETED và duy nhất theo cặp đơn/sản phẩm.
- Xác nhận nhận hàng yêu cầu DELIVERED và returnStatus NONE/null; COMPLETED là nhánh idempotent. Đổi trả: REQUESTED → APPROVED → COMPLETED hoặc REQUESTED → REJECTED.
