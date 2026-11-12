# Đánh giá và hướng hardening JWT

Tài liệu này ghi nhận hiện trạng trong [`JwtTokenService`](../../backend/src/main/java/com/htttdn/crm/security/JwtTokenService.java) và đề xuất phạm vi nâng cấp. Đây là phân tích; chưa thay đổi code xác thực.

## Hiện trạng

- Backend tự tạo và xác minh JWT: mã hóa header/payload bằng Base64URL, ký HS256 bằng `HmacSHA256`, rồi so chữ ký bằng so sánh constant-time.
- Payload hiện có `sub` (ID người dùng), `role` và `exp`. Không có `iat` hoặc `jti`. Thời hạn access token mặc định là 15 phút (`app.auth.access-minutes`), có thể cấu hình bằng `ACCESS_TOKEN_MINUTES`.
- `parse` kiểm tra định dạng Bearer, chữ ký, thời hạn, ID người dùng và role. Token không mang issuer/audience để xác minh.
- Bí mật ký JWT lấy từ `JWT_SECRET`; README yêu cầu giá trị ngẫu nhiên tối thiểu 32 byte UTF-8.
- Sau khi kiểm tra token, backend đọc lại người dùng từ cơ sở dữ liệu: `AdminAccessGuard` kiểm tra role, khóa và xóa mềm cho API Admin/Manager; `AuthService.requireCustomer` kiểm tra role, khóa và xóa mềm cho API khách hàng. Vì vậy các thay đổi trạng thái tài khoản được áp dụng ở request kế tiếp.
- Hệ thống không thu hồi được riêng một access token đã phát hành. Thu hồi refresh token hoặc đổi mật khẩu không vô hiệu hóa ngay access token đang còn hạn; token đó vẫn có thể dùng đến khi hết hạn nếu trạng thái người dùng vẫn cho phép.

## Điểm gọi và phạm vi test

`JwtTokenService.issue` được gọi từ luồng phát hành phiên của `AuthService`, `AdminAuthService` và `ManagerAuthService`. `parse` được gọi từ `AuthService.requireCustomer`, `AdminAccessGuard`, `InternalAccountService` và `ReturnManagementService`.

Nếu thay cơ chế phát hành/xác minh hoặc chuyển sang Spring Security Resource Server, cần rà soát:

- Unit test về trạng thái tài khoản: `AuthServiceAccountStateTest`, `AdminAccessGuardCoverageTest`.
- Integration test đang tạo Bearer token qua `jwt.issue`: `AuditLogIntegrationTest`, `CustomerLifecycleIntegrationTest`, `CustomerOrderActivityIntegrationTest`, `CustomerProfileIntegrationTest`, `ManagerQueryIntegrationTest`, `PaymentLifecycleIntegrationTest`, `ReturnConcurrencyTest`, `ReturnManagementIntegrationTest`, `SurveyRecipientGroupIntegrationTest` và `VoucherIntegrationTest`.
- Các test luồng đăng nhập, refresh, logout và phân quyền khác cần được cập nhật nếu kiểu claims hoặc cách gắn role vào request thay đổi.

Các test integration hiện dùng chung `JwtTokenService.issue` để tạo token phù hợp với cấu hình test. Khi đổi decoder, có thể chuyển test sang encoder tương ứng hoặc cấp decoder giả trong test; vẫn cần giữ các kiểm tra role, khóa/xóa tài khoản, hết hạn và quyền truy cập.

## Phương án nâng cấp

| Phương án | Phạm vi ảnh hưởng ước lượng | Công việc chính |
| --- | --- | --- |
| Spring Security OAuth2 Resource Server và OAuth2 JOSE/Nimbus | Trung bình nếu giữ giao diện `issue`/`parse`; trung bình đến lớn nếu chuyển toàn bộ filter | Dùng `JwtEncoder`/`JwtDecoder` thay phần ký/đọc tự viết; cấu hình rõ thuật toán được chấp nhận và kiểm tra claim; nếu dùng Resource Server đầy đủ thì thay phần xác thực Bearer trong `AdminAccessGuard`, ánh xạ claim `role` sang authority, rồi giữ kiểm tra tài khoản trong database. |
| Thư viện JJWT | Nhỏ đến trung bình | Thay phần ghép JSON/ký/parse trong `JwtTokenService` bằng builder/parser có kiểu; giữ API `issue`/`parse` và các lớp guard/service hiện tại để giới hạn phạm vi thay đổi. |

Cả hai lựa chọn đều không tự cung cấp khả năng thu hồi từng access token. Chỉ thêm `jti` là chưa đủ: backend phải lưu trạng thái thu hồi hoặc phiên/token version và kiểm tra nó trên request. Giữ việc nạp lại người dùng hiện tại cũng vẫn cần thiết để áp dụng thay đổi role, khóa và xóa tài khoản.

Tài liệu chính thức: [Spring Security OAuth2 Resource Server JWT](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html), [Spring Security OAuth2/JWT APIs](https://docs.spring.io/spring-security/reference/servlet/oauth2/), [JJWT README](https://github.com/jwtk/jjwt/blob/master/README.adoc).

## Khuyến nghị cho phạm vi đồ án

Chưa cần dựng một Authorization Server riêng cho đồ án. Cơ chế hiện tại đã có hạn dùng ngắn, refresh token tách biệt và kiểm tra lại trạng thái tài khoản; điều này phù hợp cho demo/local khi `JWT_SECRET` được bảo vệ đúng cách. Nếu có thêm thời gian hardening, ưu tiên thay phần JWT tự viết bằng Spring Security OAuth2 JOSE/Nimbus mà vẫn giữ contract và các kiểm tra hiện có. Việc triển khai `jti`/denylist hoặc chuyển toàn bộ xác thực sang Resource Server nên là thay đổi riêng, kèm test phân quyền và thu hồi rõ ràng.
