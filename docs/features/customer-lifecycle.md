# Phân nhóm khách hàng Manager

Trang `/manager/users` và `/manager/users/{id}` tính tự động từ đơn `COMPLETED`.

- Chưa mua hàng: 0 đơn; mua lần đầu: 1 đơn; quay lại: từ 2 đơn.
- Thân thiết ưu tiên: từ 5 đơn **hoặc** giá trị từ 5.000.000 đ.
- Lâu chưa mua lại: từ 30 ngày lịch `Asia/Ho_Chi_Minh` kể từ ngày đặt gần nhất trong đơn hoàn thành; không gắn cho khách chưa mua.
- Giá trị là tổng tiền sau giảm giá, chưa trừ hoàn tiền, bao gồm đơn hoàn thành có đổi trả. Không phải tiền đã thu.

`GET /api/manager/users` giữ `q,page,size`; thêm:

| Tham số | Giá trị |
| --- | --- |
| stage | NO_PURCHASE, FIRST_PURCHASE, RETURNING, LOYAL |
| dormant | true hoặc false (false bao gồm người chưa mua) |
| minCompletedOrders / maxCompletedOrders | Số nguyên không âm |
| minCompletedValue / maxCompletedValue | Giá trị không âm |
| lastPurchaseFrom / lastPurchaseTo | YYYY-MM-DD, gồm cả hai ngày theo Việt Nam; khách chưa mua không nằm trong khoảng |
| sort | createdAt, completedOrders, completedValue, lastPurchaseAt |
| direction | asc hoặc desc; mặc định desc |

Ngày mua trống xếp cuối; cùng chỉ số sắp theo ID giảm dần. Tìm kiếm escape ký tự `%`, `_`, `!`. Truy vấn tổng hợp một dòng trên một customer trước lọc, sắp xếp và phân trang; không nối các dòng sản phẩm. Chỉ MANAGER được truy cập; khách khóa vẫn có, khách xóa mềm và tài khoản nội bộ không có. DTO không có mật khẩu/token.

Bộ lọc nằm trong URL; quay về danh sách từ hồ sơ giữ bộ lọc. Polling 5 giây giữ dữ liệu cũ khi mất kết nối và tạm dừng khi đang sửa/thao tác. Không thêm schema, tác vụ nền, thông báo hay chiến dịch.

## Kiểm tra

- Backend: `mvn test -q`.
- Frontend: `npm test`, `npm run build`.
- PostgreSQL kiểm thử riêng: bật `CRM_POSTGRES_QA=true`, chạy `mvn test -q -Dtest=CustomerLifecyclePostgresTest` trong backend. Dữ liệu customer/đơn sinh riêng được rollback; sequence có thể tăng. Không xử lý đơn thật.
- Browser: `frontend/scripts/portal-responsive-check.cjs` dùng API giả lập, desktop/tablet/mobile sáng/tối; không tạo thanh toán thật.

Sau cập nhật cần khởi động lại backend để nạp API mới; không cần migration. Không sửa `application.yml`.

### Kết quả kiểm tra local 06/10/2026

- `mvn test -q`: đạt; 96 test chạy thành công, 2 test PostgreSQL opt-in được bỏ qua mặc định.
- PostgreSQL 18.4: test riêng đạt với 12 customer và 66 đơn thử, đối chiếu tổng trực tiếp, phân trang và mốc 29/30/31 ngày; rollback dữ liệu.
- Frontend: 185 test đạt với `npm test -- --maxWorkers=1`; build đạt. Lượt chạy nhiều worker đồng thời với browser/backend có timeout ở test storefront cũ; chạy riêng và chạy tuần tự đạt, không nới assertion.
- Browser API giả lập: 54 lượt kiểm tra route ở 1440/768/390px, sáng/tối đạt; không tràn ngang, không lỗi JavaScript, nhãn nhóm xuất hiện ở danh sách và hồ sơ.
- Backend local đã khởi động lại cổng 8082; API sản phẩm trả 200, API Manager chưa đăng nhập trả 401. Không push hoặc tạo PR.
