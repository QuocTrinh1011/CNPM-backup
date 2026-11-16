# Thiết kế freeship từ 399.000đ

## Mục tiêu

Áp dụng chính sách giao hàng nội bộ: phí giao hàng 30.000đ khi tiền hàng sau voucher dưới 399.000đ; miễn phí giao hàng từ đúng 399.000đ. Khách hàng thấy rõ quyền lợi trên storefront và breakdown ở checkout.

## Các cách đã cân nhắc

- Chỉ thêm dòng quyền lợi như ảnh: không phù hợp vì đơn hàng hiện chưa tính phí giao hàng, nên không thực thi ngưỡng.
- Tính phí cố định nội bộ ở backend và checkout: chọn cách này vì áp dụng được chính sách mà không cần tích hợp hãng vận chuyển.
- Tích hợp báo giá từ hãng vận chuyển: ngoài phạm vi yêu cầu và dự án hiện chưa có tích hợp vận chuyển.

## Thiết kế

- Dùng tiền hàng sau voucher để xét ngưỡng. Nếu số tiền này nhỏ hơn 399.000đ thì phí là 30.000đ; nếu bằng hoặc lớn hơn thì phí bằng 0.
- Backend là nơi quyết định phí, không nhận mức phí do renderer gửi. Tổng đơn và số tiền COD/PayOS phải là tiền hàng trừ voucher cộng phí giao hàng.
- Thêm `shipping_fee` vào đơn hàng bằng migration tăng dần tiếp theo; schema khởi tạo mới cũng có cột này. Các đơn cũ nhận phí 0 để giữ nguyên tổng tiền đã lưu.
- Trả phí giao hàng trong API đơn hàng. Checkout hiển thị tạm tính, giảm giá voucher, phí giao hàng hoặc “Miễn phí”, và tổng phải thanh toán. Trang giới thiệu storefront hiển thị “FREESHIP ĐƠN TỪ 399K”. Chi tiết đơn đã tạo cũng thể hiện phí đã chốt.
- Báo cáo tổng thu tiếp tục thể hiện số tiền thực thu từ khách, bao gồm phí giao hàng; chưa có dữ liệu chi phí hãng vận chuyển để trừ.

## Phạm vi và kiểm tra

- Không tích hợp hãng vận chuyển, không thay đổi điều kiện voucher, không dùng phí theo địa phương.
- Kiểm thử biên dưới/đúng ngưỡng, voucher làm tiền hàng sau giảm giá xuống dưới ngưỡng, và đảm bảo client không thể tự đặt phí. Kiểm tra hiển thị checkout và tổng tiền COD/PayOS.

## Quyết định triển khai

Phí và ngưỡng được xác nhận: 30.000đ dưới ngưỡng; 399.000đ được xét sau voucher. Quyền lợi storefront và breakdown checkout thuộc cùng thay đổi để thông báo khớp với số tiền backend tính.
