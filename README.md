# ANH LỚN SHOP - Hệ thống bán hàng và quản lý quan hệ khách hàng (CRM)

Đồ án môn **Hệ thống thông tin doanh nghiệp**, xây dựng website bán thời trang nam kết hợp CRM. Hệ thống không chỉ hỗ trợ mua hàng mà còn tổng hợp hồ sơ khách hàng, phân nhóm, khảo sát, tiếp nhận yêu cầu hỗ trợ và theo dõi công việc chăm sóc sau bán.

Dự án gồm ba giao diện độc lập **Khách hàng**, **Admin hệ thống** và **Nhân viên quản lý**, dùng chung backend và cơ sở dữ liệu PostgreSQL. Nội dung dưới đây mô tả chức năng đã có trong mã nguồn; các giới hạn triển khai được nêu riêng, không xem đây là hệ thống vận hành thương mại đã được chứng nhận.

## Mục lục

- [Mục tiêu và phạm vi đồ án](#mục-tiêu-và-phạm-vi-đồ-án)
- [Vai trò và phân quyền](#vai-trò-và-phân-quyền)
- [Các chức năng chính](#các-chức-năng-chính)
- [Quy tắc nghiệp vụ và chỉ số CRM](#quy-tắc-nghiệp-vụ-và-chỉ-số-crm)
- [Công nghệ và kiến trúc](#công-nghệ-và-kiến-trúc)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Cài đặt và chạy local](#cài-đặt-và-chạy-local)
- [Cấu hình môi trường demo/nghiệm thu](#cấu-hình-môi-trường-demonghiệm-thu)
- [Cấu hình thanh toán PayOS](#cấu-hình-thanh-toán-payos)
- [Kiểm thử và CI](#kiểm-thử-và-ci)
- [Tài liệu chi tiết](#tài-liệu-chi-tiết)
- [Giới hạn và lưu ý triển khai](#giới-hạn-và-lưu-ý-triển-khai)
- [Quy trình đóng góp](#quy-trình-đóng-góp)

## Mục tiêu và phạm vi đồ án

- Phân tích yêu cầu, mô hình hóa nghiệp vụ, thiết kế hệ thống và cơ sở dữ liệu.
- Xây dựng luồng bán hàng từ tra cứu sản phẩm đến đặt hàng, thanh toán, nhận hàng, đánh giá và đổi trả.
- Tách quản trị tài khoản nội bộ khỏi nghiệp vụ vận hành cửa hàng.
- Tập trung dữ liệu và lịch sử tương tác trong hồ sơ khách hàng 360°.
- Hỗ trợ chăm sóc có người phụ trách, hạn xử lý, kết quả, nhắc việc và báo cáo.
- Kiểm thử phân quyền, tính đúng dữ liệu, thao tác đồng thời và khả năng phục hồi khi lỗi API.

Đầu việc được theo dõi tại [GitHub Issues](https://github.com/duygri/do-an-htttdn-crm/issues) và [GitHub Project](https://github.com/users/duygri/projects/1).

## Vai trò và phân quyền

| Vai trò | Giao diện local | Trách nhiệm chính |
| --- | --- | --- |
| `CUSTOMER` | <http://localhost:5173> | Mua hàng, quản lý thông tin cá nhân, theo dõi đơn, khảo sát và gửi yêu cầu hỗ trợ |
| `ADMIN` | <http://localhost:5174/admin/login> | Quản trị tài khoản ADMIN/MANAGER, tra cứu sản phẩm và xem nhật ký hệ thống |
| `MANAGER` | <http://localhost:5175/manager/login> | Vận hành cửa hàng, quản lý khách hàng và thực hiện nghiệp vụ CRM |

Ba portal sử dụng luồng đăng nhập và phiên riêng. Backend kiểm tra vai trò, trạng thái tài khoản và quyền sở hữu dữ liệu; không chỉ ẩn nút trên giao diện. ADMIN không dùng token của mình để thao tác nghiệp vụ thay MANAGER.

## Các chức năng chính

### 1. Website khách hàng

- **Tài khoản:** đăng ký, đăng nhập/đăng xuất, cập nhật hồ sơ, đổi mật khẩu và quản lý sổ địa chỉ nhận hàng.
- **Sản phẩm:** tìm kiếm, lọc, sắp xếp, xem chi tiết, chọn màu/size/số lượng, xem đánh giá và lưu yêu thích.
- **Giỏ hàng:** chỉnh số lượng, xóa dòng, chọn từng sản phẩm hoặc chọn tất cả; giữ các món chưa mua trong giỏ sau khi đặt hàng. Hỗ trợ giỏ khách và gộp giỏ khi đăng nhập.
- **Đặt hàng:** trang checkout riêng, địa chỉ mặc định hoặc địa chỉ khác cho đơn hiện tại, voucher, tổng tiền và phương thức COD/PayOS.
- **Thanh toán QR:** hiển thị QR PayOS, mở link thanh toán, kiểm tra trạng thái và thử lại mã hết hạn/thất bại trên cùng đơn đủ điều kiện.
- **Đơn hàng:** lịch sử có tab trạng thái, tìm kiếm/phân trang, xem chi tiết, tiếp tục thanh toán, hủy đơn theo điều kiện và xác nhận đã nhận hàng.
- **Đánh giá/đổi trả:** đánh giá gắn với sản phẩm trong đơn hoàn thành; gửi yêu cầu đổi trả khi đủ điều kiện và theo dõi kết quả xử lý.
- **Khảo sát/voucher:** trả lời khảo sát công khai hoặc được chỉ định, nhận voucher thưởng nếu được cấu hình; xem voucher cá nhân và ưu đãi cửa hàng còn hiệu lực.
- **Hỗ trợ:** tạo phiếu gắn với đơn của mình nếu cần, gửi trao đổi và theo dõi tiến trình; không xem được ghi chú nội bộ của Manager.
- **Thông báo:** xem và đánh dấu đã đọc các thông báo trong web. Có giao diện sáng/tối và bố cục responsive.

Các trang thường dùng: `/san-pham/{id}`, `/gio-hang`, `/dat-hang`, `/don-hang`, `/tai-khoan`, `/tai-khoan/voucher`, `/khao-sat`, `/ho-tro`. Đường dẫn `/thanh-toan` phục vụ luồng quay về từ PayOS, không phải trang tạo đơn mới.

### 2. Portal nhân viên quản lý

- **Tổng quan:** chỉ số vận hành và liên kết nhanh đến đúng chức năng/bộ lọc.
- **Khách hàng:** thêm/sửa, khóa/mở khóa, xóa mềm, tìm kiếm và lọc trên toàn bộ dữ liệu trước phân trang.
- **Hồ sơ 360°:** thông tin liên hệ, địa chỉ, đơn hàng, đánh giá, khảo sát, voucher, chăm sóc và lịch sử hoạt động đã được ghi nhận.
- **Phân nhóm:** chưa mua, mua lần đầu, quay lại, thân thiết; nhãn lâu chưa mua lại. Kết hợp ngày mua, số đơn, giá trị, điểm đánh giá và trạng thái tham gia khảo sát.
- **Chăm sóc:** ghi chú, tạo/giao việc, hạn xử lý, ghi nhận kết quả, tạo việc kế tiếp; tạo việc từ phản hồi chưa xử lý hoặc đơn đổi trả.
- **Việc của tôi:** xem việc cá nhân đang mở, đến hạn, sắp đến hạn, quá hạn và việc chăm sóc tiếp; nhận thông báo nhắc hạn có lưu.
- **Sản phẩm và tồn kho:** quản lý thông tin, danh mục, giá, trạng thái hiển thị và số lượng tồn.
- **Đơn hàng/đổi trả:** tìm kiếm, lọc, theo dõi thanh toán, cập nhật tiến trình giao hàng; chấp thuận, từ chối hoặc hoàn tất yêu cầu đổi trả theo luồng cho phép.
- **Phản hồi:** tiếp nhận, trả lời, xử lý, ẩn/hiện và xóa mềm đánh giá.
- **Phiếu hỗ trợ:** tạo hộ khách, phân công, trao đổi công khai, ghi chú nội bộ và cập nhật trạng thái xử lý.
- **Khảo sát:** tạo nháp, phát hành/gỡ, thống kê kết quả, chọn tất cả khách hoặc chỉ định người nhận và cấu hình voucher thưởng.
- **Khảo sát theo nhóm:** tạo bản nháp từ toàn bộ khách khớp bộ lọc, xem trước và chốt người nhận khi lưu; không tự phát hành. Có thể lọc đã/chưa trả lời một khảo sát cụ thể.
- **Voucher/báo cáo:** quản lý mã giảm giá, báo cáo khách hàng, khảo sát, mua lại và kết quả chăm sóc. Lịch sử hoạt động của khách được xem riêng trong hồ sơ 360°; audit log hệ thống chỉ dành cho Admin.

Các màn hình chính nằm dưới `/manager/*`. Dữ liệu màn hình đang mở được cập nhật mỗi 5 giây; tạm dừng khi tab bị ẩn hoặc người dùng đang nhập/gửi thao tác liên quan.

### 3. Portal Admin hệ thống

- Xem tổng quan và tra cứu sản phẩm bằng tìm kiếm, bộ lọc, sắp xếp và phân trang.
- Tạo, sửa, khóa/mở khóa, xóa mềm và đổi quyền tài khoản ADMIN/MANAGER.
- Bảo vệ thao tác tự khóa/xóa/đổi quyền và tài khoản Admin hoạt động cuối cùng.
- Xem toàn bộ audit log, gồm cả các thao tác quản lý tài khoản nội bộ do Admin thực hiện.
- Liên kết đến portal Manager và website khách hàng; không thay thế vai trò vận hành của Manager.

## Quy tắc nghiệp vụ và chỉ số CRM

### Đơn hàng, thanh toán và hậu mãi

- Trạng thái xử lý đơn, thanh toán và đổi trả được quản lý riêng.
- Luồng điển hình: **Chờ xác nhận → Đang xử lý → Đang giao → Đã giao/chờ khách xác nhận → Hoàn thành**. Đơn mới không được xem là hoàn thành chỉ vì đã thanh toán.
- Chỉ khách sở hữu đơn đã giao, chưa có yêu cầu đổi trả mới xác nhận nhận hàng. Manager không hoàn thành đơn thay khách và không có tác vụ tự hoàn tất theo thời gian.
- Mỗi sản phẩm trong mỗi đơn hoàn thành chỉ đánh giá một lần; nhiều màu/size của cùng sản phẩm trong đơn dùng chung đánh giá. Bình luận tối đa 4.000 ký tự.
- Đơn đã xác nhận nhận hàng và đã có đánh giá không được gửi yêu cầu đổi trả mới.
- QR mặc định có hạn 15 phút. Trạng thái trả tiền do backend xác nhận qua PayOS; không tin tham số trên URL trình duyệt. Thử lại QR không tạo đơn mới hoặc trừ tồn kho lần nữa.
- Có sổ hoàn tiền thủ công, xác nhận thu toàn bộ COD và cảnh báo đối soát PayOS. Tự hủy đơn PayOS bỏ dở sau hạn QR 24 giờ mặc định tắt; đọc [hướng dẫn migration, hoàn tiền và tự hủy](docs/features/refunds-auto-cancellation.md) trước khi bật. Không tự chuyển tiền hoặc xác nhận thu COD từ trạng thái giao hàng.
- Mỗi đơn dùng một voucher. Voucher thưởng khảo sát thuộc đúng tài khoản, có giới hạn lượt; điều kiện được kiểm tra lại khi đặt hàng.
- Xử lý đổi trả không tự hoàn tiền, cộng tồn kho hoặc thay trạng thái thanh toán. Việc xử lý thực tế bên ngoài cần được ghi nhận đúng nghiệp vụ.

### Phân nhóm và báo cáo

| Chỉ số/nhóm | Quy tắc |
| --- | --- |
| Chưa mua hàng | Không có đơn `COMPLETED` |
| Mua lần đầu | Có một đơn hoàn thành, chưa đạt ngưỡng thân thiết |
| Khách quay lại | Có ít nhất hai đơn hoàn thành, chưa đạt ngưỡng thân thiết |
| Khách thân thiết | Ít nhất 5 đơn hoàn thành **hoặc** giá trị đơn hoàn thành từ 5.000.000 đồng; ưu tiên nhóm này |
| Lâu chưa mua lại | Nhãn bổ sung: đã mua và từ 30 ngày lịch Việt Nam kể từ ngày đặt gần nhất trong các đơn hoàn thành |
| Tỷ lệ mua lại toàn thời gian | Khách có ít nhất hai đơn hoàn thành / khách có ít nhất một đơn hoàn thành × 100 |
| Giá trị đơn hoàn thành | Tổng tiền sau giảm giá của đơn `COMPLETED`, chưa trừ hoàn tiền; không đồng nhất tiền đã thu |
| Tỷ lệ đã giải quyết công việc chăm sóc | Số việc có kết quả `RESOLVED` / số việc hoàn thành đã ghi nhận kết quả hợp lệ × 100 |

Các phép chia có mẫu số 0 trả 0. Ngày nghiệp vụ CRM dùng múi giờ `Asia/Ho_Chi_Minh`. Đơn hoàn thành có đổi trả vẫn nằm trong phép tính giá trị đơn hoàn thành. Chỉ số **Giá trị đơn chưa hủy** ở dashboard là một phép tính khác, không phải tiền thực thu.

Khi lọc theo khảo sát cụ thể, **chưa trả lời chỉ tính trong đối tượng nhận khảo sát đó**, không gom khách ngoài nhóm. Điểm đánh giá sản phẩm không được gọi là điểm hài lòng khảo sát. Timeline chỉ tổng hợp sự kiện có dữ liệu lưu, không dựng lại lịch sử cũ.

Phiếu hỗ trợ có luồng **Mới → Đang xử lý → Chờ khách → Đã giải quyết**, cho phép xử lý tiếp từ bước chờ khách. Công việc chăm sóc có luồng riêng **Chưa thực hiện → Đang xử lý → Hoàn thành**. Nhắc việc đến hạn/quá hạn được backend kiểm tra định kỳ 60 giây, chống gửi trùng và không nhắc lặp hằng ngày.

## Công nghệ và kiến trúc

| Thành phần | Công nghệ/cách tổ chức |
| --- | --- |
| Frontend | React, Vite, JavaScript/JSX, CSS; Lucide React và `qrcode.react` |
| Backend | Java 21, Spring Boot 3.4.3, REST API, Spring Data JPA, JDBC và Bean Validation |
| Dữ liệu | PostgreSQL; transaction, khóa bản ghi và kiểm soát phiên bản ở các luồng cần chống tranh chấp |
| Xác thực | JWT, refresh token, BCrypt; kiểm tra vai trò và trạng thái tài khoản tại backend |
| Kiểm thử | JUnit, Spring Boot Test, MockMvc, H2, PostgreSQL opt-in; Vitest và React Testing Library |
| CI | GitHub Actions: backend verify, frontend build, lint tài liệu/PlantUML và CodeQL |
| Thiết kế/tài liệu | Figma/Google Stitch, Markdown và sơ đồ PlantUML |

Luồng chung: **Ba portal React → REST API Spring Boot → PostgreSQL**. PayOS là dịch vụ thanh toán bên ngoài, giao tiếp với backend qua API và webhook. Namespace nghiệp vụ Manager là `/api/manager/*`, quản trị hệ thống là `/api/admin/*`; API khách hàng dùng các đường dẫn như `/api/orders`, `/api/surveys`, `/api/support-tickets`.

## Cấu trúc thư mục

```text
backend/               Ứng dụng Spring Boot, REST API và test backend
frontend/
├── src/
│   ├── main.jsx        Chọn portal theo Vite mode
│   ├── app/            App shell, routing và portal entrypoint
│   ├── api/            API client
│   ├── features/       Storefront, customer, support-tickets, manager, admin
│   ├── shared/         Hook, tiện ích và CSS dùng chung
│   ├── styles/         CSS toàn cục
│   └── data/           Dữ liệu địa chỉ và giấy phép nguồn
├── scripts/            Công cụ kiểm tra responsive
└── public/             Tài nguyên tĩnh
database/
├── schema.sql          Schema PostgreSQL khởi tạo
├── seed/               Dữ liệu minh họa
├── migrations/         Migration đánh số và README thứ tự chạy
├── maintenance/        Script bảo trì cấu trúc cũ
└── backup/             Ghi chú backup/restore
docs/
├── README.md           Mục lục tài liệu
├── requirements/       PRD, yêu cầu hệ thống và quyết định
├── features/           Tài liệu chức năng CRM
├── database/           Hướng dẫn database theo chức năng
├── ops/                Cấu hình và hướng dẫn vận hành
├── qa/                 Kịch bản QA và báo cáo hoàn thành
├── design/
│   ├── diagrams/       Sơ đồ hiện hành
│   └── use-cases/      Đặc tả Use Case v2
├── plans/              Kế hoạch triển khai
├── specs/              Đặc tả thiết kế
└── archive/            Tài liệu cũ được giữ để tra cứu
tests/                 Tài liệu/kịch bản kiểm thử bổ sung
.github/workflows/     Quy trình CI và kiểm tra mã nguồn
```

## Cài đặt và chạy local

### 1. Yêu cầu môi trường

- Git, JDK 21 và Maven 3.9.x.
- PostgreSQL và công cụ `psql` hoặc pgAdmin.
- Node.js **22.22.2 trở lên trong nhánh 22.x**, hoặc **24.15.0 trở lên trong nhánh 24.x**, phù hợp yêu cầu engine của lockfile hiện tại.
- Chạy lệnh từ thư mục gốc repository, trừ các bước có `cd` riêng. Ví dụ dưới dùng PowerShell; mỗi portal/backend chạy trong một terminal riêng.

```powershell
git clone https://github.com/duygri/do-an-htttdn-crm.git
cd do-an-htttdn-crm
```

### 2. Tạo database mới

```powershell
psql -U postgres -c "CREATE DATABASE htttdn;"
psql -U postgres -d htttdn -v ON_ERROR_STOP=1 -f database/schema.sql
psql -U postgres -d htttdn -v ON_ERROR_STOP=1 -f database/seed/seed_data.sql
```

`schema.sql` là cấu trúc khởi tạo hiện tại; `seed_data.sql` thêm dữ liệu minh họa để demo. Không chạy seed tùy tiện trên dữ liệu thật.

Tài khoản Admin minh họa do seed tạo là `admin@shop.com`, mật khẩu mẫu được ghi trong chính script seed. Chỉ dùng tài khoản mẫu ở local, đổi mật khẩu trước khi triển khai. Đăng nhập Admin để tạo tài khoản `MANAGER` với mật khẩu riêng; **không có tài khoản Manager mặc định**. Khách có thể đăng ký trên website.

### 3. Nâng cấp database đã có

Sao lưu, xác định phiên bản schema đã triển khai và đọc migration liên quan trước khi thực hiện. Không thay việc nâng cấp bằng cách xóa database hoặc chạy lại mọi script. Danh sách đầy đủ, thứ tự và phụ thuộc nằm trong [database/migrations/README.md](database/migrations/README.md).

| Nhóm chức năng | Script |
| --- | --- |
| Nền tảng tài khoản/portal | `001_admin_user_split.sql`, `002_manager_portal.sql` |
| Khảo sát, phản hồi và voucher | `003_survey_management.sql`, `004_feedback_moderation.sql`, `005_voucher_management.sql`, `006_review_survey_rewards.sql` |
| Thanh toán và đổi trả | `007_payos_qr.sql`, `008_payos_attempts.sql`, `009_return_management.sql` |
| Hoàn tiền và dòng tiền | `010_refunds_abandoned_payos.sql`, `011_cashflow_voucher_customer_limit.sql` |
| Chăm sóc khách hàng | `012_customer_care.sql` → `013_care_sources.sql` → `014_care_outcomes.sql` → `015_care_reminders.sql` |
| Nhật ký và phiếu hỗ trợ | `016_audit_logs.sql`, `017_support_tickets.sql` |
| Thống kê doanh thu và nhập kho | `018_sales_statistics.sql`, `019_stock_receipts.sql` |

Các script nằm trong `database/migrations/`. Migration nhắc hạn cần bảng công việc chăm sóc và thông báo nền có trước; phiếu hỗ trợ cần các bảng nền khách hàng, đơn hàng và thông báo. Backend có ghi audit cần bảng nhật ký trước khi thực hiện nghiệp vụ mới. Xem hướng dẫn từng chức năng ở mục [Tài liệu chi tiết](#tài-liệu-chi-tiết).

`database/maintenance/cleanup_legacy.sql` dành cho dữ liệu/cấu trúc cũ, **không phải bước cài đặt mặc định**. Chỉ dùng khi đã hiểu nội dung, có bản sao lưu và đã kiểm thử trên bản sao. Khởi động lại backend sau khi cập nhật migration/mã nguồn; chạy SQL không tự nạp endpoint mới vào tiến trình Java đang chạy.

### 4. Chạy backend

```powershell
cd backend
$env:DB_URL='jdbc:postgresql://localhost:5432/htttdn'
$env:DB_USERNAME='postgres'
$env:DB_PASSWORD='<mat-khau-postgresql-cua-ban>'
$env:SERVER_PORT='8080'
$env:JWT_SECRET=[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
mvn spring-boot:run
```

Lệnh trên giả định đã chạy schema/migration phù hợp. Mặc định `ddl-auto: validate` kiểm tra schema và không tự sửa database; thiếu cột/bảng phải áp dụng migration phù hợp trước khi khởi động. Không chuyển sang `update` để bỏ qua lỗi này.

`DB_PASSWORD` và `JWT_SECRET` là bắt buộc, không có bí mật dự phòng. JWT secret phải có ít nhất 32 byte UTF-8, không dùng khóa mẫu. Ví dụ tạo khóa trên dùng PowerShell 7; hãy lưu khóa an toàn để tái sử dụng khi khởi động, không tạo lại mỗi lần chạy. Có thể đặt biến trong cấu hình chạy IDE. Spring Boot **không tự nạp `.env`**.

Nếu từng dùng mật khẩu DB hoặc JWT secret đã có trên Git, cần đổi mật khẩu PostgreSQL (và nơi dùng chung), thay JWT secret và khởi động lại backend. Thay JWT secret vô hiệu access token cũ; để kết thúc cả phiên refresh, cần thu hồi refresh token theo quy trình vận hành. Không ghi bí mật vào Git/log. Xem [hướng dẫn bảo mật và hủy đơn](docs/ops/security-order-cancellation.md).

**Lưu ý cổng:** cấu hình backend trong repository mặc định là `8082`, còn frontend mặc định gọi `8080`. Ví dụ chủ động đặt backend về `8080`. Nếu giữ `8082` hoặc dùng cổng khác, phải đổi `VITE_API_BASE_URL` tương ứng ở cả ba terminal frontend.

### 5. Chạy ba portal frontend

Cài dependency một lần:

```powershell
cd frontend
npm ci
```

Trong ba terminal riêng, từ thư mục `frontend`:

```powershell
$env:VITE_API_BASE_URL='http://localhost:8080'
npm run dev:user
```

```powershell
$env:VITE_API_BASE_URL='http://localhost:8080'
npm run dev:admin
```

```powershell
$env:VITE_API_BASE_URL='http://localhost:8080'
npm run dev:manager
```

`npm run dev` mặc định chạy User. Các cổng lần lượt là `5173`, `5174`, `5175` và dùng `--strictPort`: nếu bị chiếm, chương trình báo lỗi thay vì tự chuyển cổng. Khởi động lại Vite sau khi thay biến môi trường. Có thể tham khảo [frontend/.env.example](frontend/.env.example), không commit cấu hình riêng hoặc khóa bí mật vào Git.

### 6. Các biến môi trường thường dùng

| Biến | Công dụng |
| --- | --- |
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | Kết nối PostgreSQL |
| `SERVER_PORT` | Cổng backend |
| `SPRING_JPA_HIBERNATE_DDL_AUTO` | Quản lý thay đổi schema; ví dụ local ở trên dùng `none` sau khi cài SQL |
| `JWT_SECRET` | Bí mật ký token; phải thay giá trị phát triển trước khi triển khai |
| `CORS_ORIGINS` | Danh sách origin frontend được phép, phân cách bằng dấu phẩy; cần đủ ba portal |
| `SECURE_REFRESH_COOKIE` | Đặt `true` khi triển khai qua HTTPS |
| `VITE_API_BASE_URL` | URL backend mà từng portal gọi |
| `VITE_USER_ORIGIN`, `VITE_ADMIN_ORIGIN`, `VITE_MANAGER_ORIGIN` | Origin các portal để tạo liên kết điều hướng |
| `CRM_CARE_REMINDERS_ENABLED` | Bật/tắt scheduler nhắc việc; mặc định bật |

Ví dụ CORS local: `http://localhost:5173,http://localhost:5174,http://localhost:5175`. Không dùng cấu hình phát triển, bí mật mặc định hoặc tài khoản seed để vận hành thật.

## Cấu hình môi trường demo/nghiệm thu

Spring Boot không tự đọc file `.env`. Đặt các biến trong môi trường của tiến trình backend trước khi khởi động; ví dụ PowerShell và giá trị mẫu được ghi tại [docs/ops/env-demo.md](docs/ops/env-demo.md). Không đưa bí mật vào file mẫu hoặc Git.

| Biến | Giá trị demo/nghiệm thu | Mặc định code | Ghi chú |
| --- | --- | --- | --- |
| `PAYOS_AUTO_CANCEL_ENABLED` | `true` | `false` | Bật tự hủy đơn PayOS chưa thanh toán trong demo/nghiệm thu. |
| `PAYOS_AUTO_CANCEL_GRACE_HOURS` | `24` | `24` | Thời gian chờ sau khi link thanh toán hết hạn. Số nguyên từ 1 đến 720 giờ; giá trị ngoài khoảng này khiến backend không khởi động. |
| `DEV_PASSWORD_RESET_ENABLED` | `false` | `false` | Tắt nhánh mã sáu chữ số dành cho profile development. |
| `RESEND_ENABLED` | `false` | `false` | Tắt nhánh khôi phục qua email và email đơn hàng trong bộ cấu hình demo này. |
| `APP_PAYOS_AUTO_CANCEL_MS` (`app.payos.auto-cancel-ms`) | `300000` | `300000` | Chu kỳ kiểm tra tự hủy, tương đương 5 phút. |

PayOS không có sandbox. COD là luồng smoke test mặc định; chỉ thử PayOS thật khi người phụ trách đã xác nhận tài khoản, số tiền giới hạn và thời điểm thực hiện. Không commit `PAYOS_CLIENT_ID`, `PAYOS_API_KEY` hoặc `PAYOS_CHECKSUM_KEY`.

Code đã hỗ trợ khôi phục mật khẩu qua Resend khi cấu hình email hợp lệ; `DEV_PASSWORD_RESET_ENABLED=false` không tắt nhánh email. Bộ demo ở trên chủ động tắt cả hai cờ. Khi thử riêng luồng email, xem [cấu hình Resend](docs/ops/resend-email.md); liên kết dùng token 43 ký tự, API không trả mã đặt lại trong chế độ email. Chưa xác nhận gửi email thật trong đợt rà soát tài liệu này.

## Cấu hình thanh toán PayOS

Thiết lập ở terminal backend trước khi chạy:

```powershell
$env:PAYOS_CLIENT_ID='<client-id>'
$env:PAYOS_API_KEY='<api-key>'
$env:PAYOS_CHECKSUM_KEY='<checksum-key>'
$env:PAYOS_RETURN_URL='http://localhost:5173/thanh-toan'
$env:PAYOS_CANCEL_URL='http://localhost:5173/thanh-toan'
```

- Thiếu khóa thì checkout PayOS trả lỗi cấu hình, không tạo QR giả; COD vẫn dùng được.
- Đăng ký webhook trỏ đến `POST /api/payments/payos/webhook` ở backend có thể truy cập công khai. Backend xác thực chữ ký và có API đồng bộ trạng thái để đối chiếu với nhà cung cấp.
- URL quay về trình duyệt chỉ phục vụ hiển thị, không được dùng để tự đánh dấu đã thanh toán.
- Không đưa khóa PayOS vào biến `VITE_*`, ảnh chụp, log hoặc commit. Kiểm thử tự động dùng phản hồi giả lập, không yêu cầu thanh toán tiền thật.

## Kiểm thử và CI

Backend, chạy trong `backend`:

```powershell
mvn test -q
mvn verify
```

Frontend, chạy trong `frontend`:

```powershell
npm test
npm run build
# Máy ít tài nguyên có thể giới hạn số worker:
npm test -- --maxWorkers=2
```

Kiểm tra whitespace, chạy tại thư mục gốc:

```powershell
git diff --check
```

Test backend thường dùng H2 và dữ liệu thử. Một số test PostgreSQL chỉ chạy khi bật `CRM_POSTGRES_QA=true`; đọc từng lớp test trước khi bật và chỉ dùng database kiểm thử. Không phải mọi test opt-in đều dùng bảng tạm: một số tạo dữ liệu rồi rollback và có thể làm tăng sequence. Không trỏ các test này vào database vận hành.

GitHub Actions phân loại thay đổi để chạy backend `mvn verify`, frontend build và lint/typecheck nếu được cấu hình, kiểm tra whitespace và sơ đồ PlantUML; CodeQL kiểm tra riêng. Chỉ merge khi các kiểm tra bắt buộc đạt. Không lấy số test ghi trong tài liệu cũ làm số cố định cho mọi phiên bản; kết quả thực tế nằm trong log CI và báo cáo test.

## Tài liệu chi tiết

| Nội dung | Tài liệu |
| --- | --- |
| Yêu cầu và phạm vi | [PRD](docs/requirements/prd-htttdn-crm.md), [yêu cầu hệ thống](docs/requirements/requirements.md) |
| Hồ sơ 360° và phân nhóm | [Hồ sơ khách hàng](docs/features/customer-profile-360.md), [vòng đời](docs/features/customer-lifecycle.md) |
| Chăm sóc và việc kế tiếp | [Chăm sóc](docs/features/customer-care.md), [liên kết nguồn](docs/features/care-sources.md), [kết quả và theo dõi tiếp](docs/features/care-outcomes.md) |
| Nhắc việc cá nhân | [Việc của tôi và thông báo](docs/features/care-reminders.md) |
| Báo cáo | [Dashboard chăm sóc](docs/features/care-dashboard.md), [kết quả chăm sóc](docs/features/care-outcomes-report.md), [giữ chân khách hàng](docs/features/retention-report.md) |
| Khảo sát theo nhóm | [Chốt người nhận từ bộ lọc](docs/features/survey-recipient-groups.md), [lọc theo khảo sát cụ thể](docs/features/customer-survey-filters.md) |
| Hỗ trợ và đổi trả | [Phiếu hỗ trợ](docs/features/support-tickets.md), [xử lý đổi trả](docs/features/return-management.md) |
| Quản lý portal | [Ba portal](docs/database/manager-portal.md) |
| Voucher và đánh giá | [Voucher](docs/database/vouchers.md), [đánh giá và thưởng khảo sát](docs/database/reviews-rewards.md) |
| Thu – hoàn tiền và giới hạn cá nhân | [Báo cáo, quy tắc voucher và migration](docs/features/cashflow-voucher-limits.md) |
| Nhật ký và kiểm tra nghiệp vụ | [Audit log](docs/features/audit-logs.md), [ma trận QA](docs/qa/crm-workflow-qa.md), [cấu hình demo](docs/ops/env-demo.md), [quyết định và ghi nhận thay đổi](docs/requirements/decisions-changelog.md) |
| Nhập kho và chi phí mua hàng | [Phiếu nhập kho](docs/features/stock-receipts.md) |
| Sơ đồ | [Thư mục sơ đồ](docs/design/diagrams/) |

Tài liệu từng đợt có thể ghi kết quả kiểm tra ở thời điểm khác nhau. Khi có khác biệt, đối chiếu phiên bản mã nguồn và migration đang triển khai.

## Giới hạn và lưu ý triển khai

- Đây là đồ án mô phỏng; cần rà soát bảo mật, cấu hình, hiệu năng, sao lưu/khôi phục và vận hành trước khi dùng thực tế.
- Đã tích hợp email khôi phục mật khẩu và thông báo đơn qua Resend dưới cờ cấu hình. Bộ demo/nghiệm thu mặc định giữ `RESEND_ENABLED=false` và `DEV_PASSWORD_RESET_ENABLED=false`; nhánh mã sáu chữ số chỉ dành cho profile `development`. Việc gửi email thật và điều kiện triển khai được kiểm tra riêng theo [hướng dẫn Resend](docs/ops/resend-email.md).
- Chưa có email marketing, thông báo hệ điều hành, hoàn tiền tự động hoặc chiến dịch tự phát voucher. Nhắc việc và thông báo hiện tại nằm trong web.
- Báo cáo mua lại toàn thời gian chưa phải phân tích giữ chân theo cohort; giá trị đơn không phải tiền thực thu hay lợi nhuận.
- Giao diện quản lý nhà cung cấp không nằm trong menu hiện tại; database/API có thể còn thành phần tương thích từ các phiên bản trước.
- Khi triển khai frontend lên web server, cần cấu hình fallback phù hợp cho route phía client để mở URL trực tiếp/refresh không bị 404, đồng thời chuyển tiếp đúng API và cookie.
- Khi lỗi kết nối, kiểm tra backend đã chạy đúng cổng, `VITE_API_BASE_URL`, CORS và migration. Lỗi thiếu endpoint thường cần build/khởi động lại backend đúng phiên bản, không chỉ chạy SQL.
- Thư mục `database/backup` hiện là khung tài liệu; không xem đó là bằng chứng đã hoàn tất diễn tập sao lưu/khôi phục.

## Quy trình đóng góp

1. Chọn hoặc tạo GitHub Issue với phạm vi và tiêu chí hoàn thành rõ ràng.
2. Tạo branch mới từ `main` đã cập nhật; đặt tên mô tả công việc, ví dụ `codex/docs-vietnamese-project-readme`.
3. Giữ các thay đổi local của người khác; không commit mật khẩu, token, `.env.local` hoặc cấu hình database riêng.
4. Bổ sung test hồi quy, tài liệu và migration khi thật sự cần thay đổi schema.
5. Chạy các kiểm tra tương ứng, tạo Pull Request và liên kết Issue bằng `Closes #...` nếu có.
6. Nhờ thành viên khác review, đợi CI đạt rồi mới merge. Migration được triển khai có kiểm soát, không tự chạy vào database thật để thử.
