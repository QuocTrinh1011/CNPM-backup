# Rà soát User / Manager — 06/10/2026

## Phạm vi và bằng chứng

Giữ các nghiệp vụ hiện có và các thay đổi local trước đợt rà soát. Không sửa `application.yml`, không push/PR, không thanh toán thật. Không tự coi test đơn vị là kiểm thử thao tác thật trên toàn bộ hệ thống.

| Chức năng | Kiểm tra / hồi quy | Kết quả và thay đổi |
|---|---|---|
| Đăng ký, đăng nhập, refresh, phân quyền ba portal | `api`, `PortalSplit`, `AuthServiceAccountState`, các integration test | Giữ phân biệt lỗi mạng và lỗi xác thực; không thay cơ chế token |
| Quên / đặt lại mật khẩu | `PasswordRecoveryPolicy`, `ManagerQueryIntegration`, `Optimization` | Chặn phát hành mã và đặt lại qua API công khai khi chưa có kênh an toàn. Chỉ bật với profile `development` **và** `DEV_PASSWORD_RESET_ENABLED=true` |
| Hồ sơ, địa chỉ, đổi mật khẩu | `customer-pages`, `ShippingFields`, `CheckoutPage` | Giữ validation, địa chỉ 2 cấp và nghiệp vụ hiện có |
| Catalog, sản phẩm, yêu thích, menu | `App`, `StorefrontHome`, `AccountDropdown`, browser responsive | Một ô tìm kiếm; card đồng đều, Manrope, nền sáng/cam; giữ chế độ tối đã lưu |
| Giỏ chọn món / checkout / gộp giỏ | `cart-selection`, `CheckoutPage` | Giữ chọn theo dòng, chỉ mua phần được chọn, chống gửi lặp, COD/PayOS |
| Voucher chung / cá nhân / khảo sát | `VoucherField`, `AdminVouchers`, `RewardsReviews`, `VoucherIntegration` | Không cho chọn dữ liệu trang cũ khi đang tải; sao chép mã; hiển thị số tiền còn thiếu để đạt mức tối thiểu |
| QR và đồng bộ thanh toán | `PaymentQr`, `Optimization`, `PayosQr` | Một request đang chạy; request thử lại hủy/invalidate request cũ; cleanup khi rời trang; thông báo PAID một lần |
| Đơn, nhận hàng và đánh giá | `ReceiptAction`, `ReceiptReviews`, `order-transitions`, `OrderConfirmation` | Giữ nhận hàng rồi mở đánh giá, không thay trạng thái/tiền/tồn kho |
| Đổi trả | `ReturnDisplay`, `ReturnManagement`, `ReturnManagementIntegration`, `ReturnConcurrency` | Giữ nhãn ưu tiên đổi trả và luồng xử lý đã triển khai trước đó |
| Thông báo và khảo sát | `customer-pages`, `RewardsReviews`, `AdminApp` | Giữ các thao tác và điều kiện thưởng hiện có |
| Manager khách hàng / hồ sơ 360° | `CustomerProfile`, `CustomerProfileIntegration` | Giữ lịch sử/tổng hợp, tìm kiếm server và polling tab đang mở |
| Manager đơn hàng | `ManagerQueryIntegration`, `ManagerPostgresSmoke`, `AdminApp` | Tìm mã/tên/email, thanh toán, ngày, sắp xếp, lọc **trước** phân trang; summary toàn dữ liệu; DTO không chứa mật khẩu/token |
| Manager sản phẩm / tồn kho | `ManagerQueryIntegration`, `AdminApp` | Danh mục từ API; giá, tồn kho, hiển thị, sort và page server; chặn gửi lặp; mobile chuyển bảng thành thẻ |
| Manager phản hồi, khảo sát, báo cáo, voucher | `AdminApp`, `AdminVouchers`, `ManagerPolling`, service/integration suite | Giữ 5s polling, dữ liệu khi lỗi, không ghi đè form |
| URL, back/forward, StrictMode, request chậm | `Optimization`, `useManagerResource`, các route test | Giữ query lọc/page, reset page khi đổi lọc, bỏ response cũ, không push history trong updater React |

## API tra cứu mới

- `GET /api/manager/orders`: giữ `status,page,size`, thêm `q,paymentStatus,from,to,sort,direction`.
- `GET /api/manager/orders/summary`: nhận `q,paymentStatus,from,to`; không bị giới hạn bởi trang hoặc status đang chọn.
- Nhóm summary: hủy trước, đổi trả tiếp theo, sau đó nhóm trạng thái giao hàng. Alias `PENDING_PAYMENT/PREPARING/DELIVERING` gộp về `PENDING/CONFIRMED/SHIPPED`.
- Thời gian `from` bao gồm, `to` không bao gồm. UI chuyển đầu ngày Việt Nam thành ISO; ngày kết thúc UI bao gồm cả ngày đó bằng cách gửi đầu ngày kế tiếp.
- Sort đơn chỉ `createdAt,totalAmount,orderCode`; sort sản phẩm chỉ `name,price,stock,createdAt`. Hướng ASC/DESC; size 1–100, page không âm.
- `GET /api/manager/products/categories` trả toàn bộ danh mục; danh sách sản phẩm nhận `q,category,minPrice,maxPrice,stock,active,sort,direction,page,size`.
- DTO danh sách đơn không tải items/history. Chi tiết dùng 3 truy vấn cố định; danh sách 2 truy vấn (count + page), summary 1 truy vấn. Không join nhiều bảng con để nhân đôi tiền.

## Kiểm tra browser và PostgreSQL

- `frontend/scripts/portal-responsive-check.cjs`: headless Edge, API intercept, 42 lượt mở trang ở 1440/768/390 px, sáng/tối; trang chủ, catalog, đơn đổi trả, ví voucher, quên mật khẩu, Manager đơn/sản phẩm. Kiểm tra overflow, console và một ô tìm kiếm. Không tạo đơn thật.
- Quan sát ảnh browser: bổ sung style input/select và thẻ sản phẩm Manager mobile để giá/tồn kho/nút sửa/ẩn không bị nằm ngoài khung.
- PostgreSQL 18.4: `ManagerPostgresSmokeTest` tạo 45 đơn và 1 customer thử trong transaction rollback, kiểm tra nhóm/phân trang/summary/detail; một lượt đo các truy vấn khoảng 85 ms. Đây không phải benchmark tải đồng thời hoặc dữ liệu hàng triệu dòng. Sequence có thể tăng dù transaction rollback.
- Backend local đã nạp lại trên cổng cấu hình hiện có 8082. Smoke API công khai: recovery `enabled:false`, forgot trả 503 không trả mã; summary không đăng nhập trả 401.
- Các luồng thanh toán, tồn kho, hủy/đổi trả dùng test tự động/mock, **không** xử lý đơn thật. Chưa mô phỏng toàn bộ nút ở mọi màn hình với tài khoản thật; không khẳng định đã QA thủ công toàn hệ thống.

## Chạy và bàn giao

Kết quả lượt cuối: `npm test` 181/181 qua; `mvn test -q` 92 test qua, 1 test PostgreSQL opt-in bỏ qua mặc định; test PostgreSQL opt-in đã chạy riêng và qua; `npm run build` thành công; 42 lượt browser responsive qua. `git diff --check` không có lỗi whitespace. Bundle entry khoảng 222,55 KB (gzip 69,89 KB), User tải thêm chunk riêng, Manager khoảng 89,22 KB cộng các trang lazy-loaded.

```powershell
cd backend
mvn test -q
mvn spring-boot:run
# Terminal khác tại frontend:
npm test
npm run build
npm run dev:user
npm run dev:manager
```

User 5173, Admin 5174, Manager 5175; giữ cấu hình API frontend hiện có. Nếu backend đang chạy bản cũ, dừng đúng tiến trình và chạy lại; chạy migration không cập nhật bytecode Java.

Test PostgreSQL tùy chọn (dùng cấu hình local; không chạy mặc định):

```powershell
$env:CRM_POSTGRES_QA='true'
mvn '-Dtest=ManagerPostgresSmokeTest' test -q
Remove-Item Env:CRM_POSTGRES_QA
```

Browser harness cần Playwright và Edge; có thể đặt `PLAYWRIGHT_MODULE` là đường dẫn module có sẵn và `QA_SCREENSHOT_DIR` là thư mục ảnh tùy chọn.

Bundle được lazy-load theo portal; Manager còn tách voucher và hồ sơ 360° theo trang. CSS mới giới hạn bằng `.site-shell` / `.manager-shell`, không đổi thiết kế Admin hệ thống. Build vẫn có cảnh báo `use client` từ Lucide, không làm build thất bại.
