# ANH LỚN SHOP CRM

Từ vựng nghiệp vụ thống nhất giữa cửa hàng trực tuyến, quản lý kho và nhân viên.

## Kho và sản xuất

**Nguyên vật liệu**:
Vật tư đầu vào được lưu kho và tiêu hao theo công thức khi sản xuất thành phẩm.
_Avoid_: Sản phẩm nguyên liệu

**Tồn nguyên vật liệu khả dụng**:
Lượng nguyên vật liệu còn ở kho trung tâm, chưa được cấp cho lệnh sản xuất.
_Avoid_: Tồn nguyên liệu tổng

**Nguyên vật liệu đã cấp**:
Lượng đã chuyển khỏi kho trung tâm cho một lệnh sản xuất, còn chờ tiêu hao hoặc hoàn kho.
_Avoid_: Nguyên liệu đã xuất khỏi hệ thống

**Lệnh sản xuất**:
Yêu cầu của quản lý kho về sản phẩm, số lượng mục tiêu và nhân viên phụ trách sản xuất.
_Avoid_: Phiếu đề nghị sản xuất

**Tồn thành phẩm kho**:
Thành phẩm đã sản xuất, đang được lưu trong kho và chưa được chuyển sang tồn bán được.
_Avoid_: Tồn bán

**Tồn bán được**:
Số lượng sản phẩm khách có thể đặt trên cửa hàng; đây là số lượng được lưu trong tồn kho sản phẩm hiện tại.
_Avoid_: Thành phẩm kho

**Phiếu đề nghị xuất**:
Yêu cầu nhân viên lập để đề nghị một lần chuyển nguyên vật liệu hoặc thành phẩm; chỉ có hiệu lực sau khi quản lý kho duyệt.
_Avoid_: Phiếu xuất đã ghi sổ

**Chuyển thành phẩm sang bán**:
Nghiệp vụ quản lý kho duyệt để giảm tồn thành phẩm kho và tăng tồn bán được cùng một lượng.
_Avoid_: Xuất hủy thành phẩm

**Khu vực công tác**:
Thuộc tính hồ sơ nhân viên do HR quản lý, nhận các giá trị `GENERAL`, `SALES` hoặc `WAREHOUSE`; đây không phải system role. Chỉ hồ sơ `WAREHOUSE` được mở các API và công việc kho dành cho nhân viên.
_Avoid_: Vai trò hệ thống kho

**Mốc cắt chuyển tồn kho**:
Thời điểm migration 026 ghi số dư sản phẩm bán được hiện tại thành số dư đầu kỳ trong ledger. Báo cáo không khẳng định lịch sử đầy đủ trước mốc này.
_Avoid_: Lịch sử kho đầy đủ từ trước migration
