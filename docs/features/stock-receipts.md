# Nhập kho và chi phí mua hàng

## Cài đặt

1. Với database hiện có, sao lưu trước. Đảm bảo đã có bảng `suppliers`, `products`, `customers` và `audit_logs`; nếu nhật ký chưa được cài, chạy `database/migrations/016_audit_logs.sql` trước.
2. Từ thư mục gốc repository, chạy migration mới:

   ```powershell
   psql -U postgres -d htttdn -v ON_ERROR_STOP=1 -f database/migrations/019_stock_receipts.sql
   ```

   Đổi `postgres`/`htttdn` theo tài khoản và database đang cấu hình. Script chỉ thêm hai bảng và index; không cập nhật tồn hoặc tạo dữ liệu lịch sử.
3. Khởi động lại backend và Manager frontend. Không đổi `ddl-auto`; backend xác thực schema bằng `validate`.

Database cài mới dùng `database/schema.sql`, đã bao gồm hai bảng nhập kho.

## Cách dùng

- Mở Manager → **Nhập kho**. Chọn nhà cung cấp, ngày nhận, một hoặc nhiều sản phẩm, số lượng và đơn giá nhập; có thể thêm nhà cung cấp ngay trên màn hình.
- Bấm **Xác nhận nhập kho** sẽ tạo phiếu `POSTED`, cộng số lượng vào tồn sản phẩm và lưu đơn giá, thành tiền, tổng tiền, ngày nhận cùng thông tin nhà cung cấp.
- Giao dịch lưu phiếu và cập nhật tồn trong cùng transaction. Nếu một sản phẩm không hợp lệ hoặc không thể cộng tồn, toàn bộ phiếu bị rollback.
- Lịch sử mở được chi tiết từng phiếu. Phiếu đã xác nhận không sửa hoặc xóa ở phiên bản này; cần rà soát số lượng và đơn giá trước khi xác nhận.
- Thống kê theo quý lấy ngày nhận theo múi giờ `Asia/Ho_Chi_Minh`, chỉ tính phiếu `POSTED`. Đây là giá trị hàng nhận, không phải ngày thanh toán nhà cung cấp hay toàn bộ dòng tiền chi.

## API và cấu trúc

- `POST /api/manager/stock-receipts`: nhận phiếu; body gồm `supplierId`, `receivedAt`, `note` tùy chọn và `items` gồm `productId`, `quantity`, `unitCost`.
- `GET /api/manager/stock-receipts?page=0&size=20`: lịch sử; `GET /api/manager/stock-receipts/{id}`: chi tiết.
- `GET /api/manager/reports/inventory-expenses?year=2025`: tổng chi nhập hàng từng quý và cả năm.
- `stock_receipts` giữ phần đầu phiếu và snapshot nhà cung cấp; `stock_receipt_items` giữ sản phẩm, số lượng, đơn giá và thành tiền. Tồn hiện tại là tổng theo sản phẩm, chưa tách size/màu.
- Nhật ký Manager ghi việc nhận phiếu và biến động tồn. Các bảng chi tiết giữ tham chiếu sản phẩm để không xóa sản phẩm đã có lịch sử nhập.

Bản này chưa xử lý trả hàng cho nhà cung cấp, sửa/hủy phiếu, công nợ/thanh toán nhà cung cấp hoặc giá vốn theo lô. Vì vậy chưa dùng tổng chi nhập hàng riêng lẻ để kết luận lợi nhuận; cần thống nhất thêm quy tắc giá vốn và hoàn trả trước khi làm báo cáo lợi nhuận.
