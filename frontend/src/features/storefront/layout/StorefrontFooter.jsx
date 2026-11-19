import React from "react";

export default function StorefrontFooter({ goHome, openCatalog, user, navigateOrders, openAuth, navigate, setSurveysOpen, setProfileOpen }) {
  return (
<footer className="footer">
        <div className="footer-brand">
          <a className="wordmark" href="/" onClick={goHome}>
            ANH LỚN <em>SHOP</em>
          </a>
          <p>Thời trang nam tinh giản & hiện đại. Tỉ mỉ từ chất liệu, chuẩn phom dáng cho tủ đồ phái mạnh mỗi ngày.</p>
          <div className="footer-contact-details">
            <span>Hotline: <b>1900 6868</b> (8:30 – 22:00)</span>
            <span>Email: <b>cskh@anhlonshop.vn</b></span>
          </div>
          <small>© 2026 ANH LỚN SHOP. BẢO LƯU MỌI QUYỀN.</small>
        </div>
        <div>
          <b>KHÁM PHÁ</b>
          <button onClick={() => openCatalog("")}>Hàng mới</button>
          <button onClick={() => openCatalog("Áo polo")}>Áo polo</button>
          <button onClick={() => openCatalog("Áo khoác")}>Áo khoác</button>
          <button onClick={() => openCatalog("Áo thun")}>Áo thun</button>
          <button onClick={() => openCatalog("Quần")}>Quần nam</button>
          <button onClick={() => openCatalog("", { minPrice: "", maxPrice: "500000" })}>Ưu đãi đặc biệt</button>
        </div>
        <div>
          <b>HỖ TRỢ</b>
          <button
            onClick={() => (user ? navigateOrders() : openAuth("orders"))}
          >
            Đơn hàng của tôi
          </button>
          <button onClick={() => (user ? navigate('/tai-khoan/voucher') : openAuth("profile"))}>
            Kho voucher & ưu đãi
          </button>
          <button onClick={() => setSurveysOpen(true)}>
            Khảo sát phong cách
          </button>
          <button onClick={() => (user ? setProfileOpen(true) : openAuth("profile"))}>
            Tài khoản của tôi
          </button>
          <button onClick={() => openCatalog("")}>
            Chính sách đổi trả 30 ngày
          </button>
        </div>
        <div>
          <b>THEO DÕI</b>
          <div className="socials-wrap">
            <span className="social-tag">Instagram</span>
            <span className="social-tag">Facebook</span>
            <span className="social-tag">TikTok</span>
          </div>
          <div className="footer-payment-tags">
            <span>VietQR</span>
            <span>PayOS</span>
            <span>COD</span>
          </div>
          <small>Giao hàng toàn quốc · Kiểm tra khi nhận hàng</small>
        </div>
      </footer>
  );
}
