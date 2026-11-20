import React from "react";
import { X } from "lucide-react";
import { UserRound } from "lucide-react";
import { Package } from "lucide-react";
import { Heart } from "lucide-react";
import { Bell } from "lucide-react";
import { MapPin } from "lucide-react";
import { ClipboardList } from "lucide-react";
import { KeyRound } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Sun } from "lucide-react";
import { Moon } from "lucide-react";
import { Headphones } from "lucide-react";
import { LogOut } from "lucide-react";
export default function StorefrontMenuDrawer({
  setMobileMenuOpen,
  goHome,
  user,
  setProfileOpen,
  setAuthMode,
  setAuthAfterLogin,
  setAuthOpen,
  navigateOrders,
  openAuth,
  setWishlistOpen,
  setNotificationsOpen,
  notificationCount,
  setAddressesOpen,
  setSurveysOpen,
  setPasswordOpen,
  openCatalog,
  shopTheme,
  setShopTheme,
  logout
}) {
  return <div className="shop-menu-drawer-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <aside
            className="shop-menu-drawer"
            aria-label="Menu chức năng và điều hướng"
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
          >
            <div className="shop-menu-drawer-header">
              <div className="shop-menu-drawer-brand">
                <a className="wordmark" href="/" onClick={e => {
            e.preventDefault();
            setMobileMenuOpen(false);
            goHome();
          }}>
                  ANH LỚN <em>SHOP</em>
                </a>
              </div>
              <button className="shop-menu-drawer-close icon-button" aria-label="Đóng menu" onClick={() => setMobileMenuOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="shop-menu-drawer-body">
              {/* User Card */}
              <div className="shop-menu-user-card">
                {user ? <>
                    <div className="shop-menu-user-info">
                      <div className="shop-menu-avatar">
                        {user.fullName ? user.fullName[0].toUpperCase() : <UserRound size={22} />}
                      </div>
                      <div className="shop-menu-user-meta">
                        <span className="shop-menu-greeting">Xin chào,</span>
                        <strong className="shop-menu-name">{user.fullName || "Khách hàng"}</strong>
                        <span className="shop-menu-email">{user.email || user.phone || "Thành viên thân thiết"}</span>
                      </div>
                    </div>
                    <div className="shop-menu-user-badge">
                      <span className="shop-badge-pill">Thành viên thân thiết</span>
                      <button type="button" className="shop-menu-profile-btn" onClick={() => {
                setMobileMenuOpen(false);
                setProfileOpen(true);
              }}>
                        Xem tài khoản
                      </button>
                    </div>
                  </> : <div className="shop-menu-guest">
                    <div className="shop-menu-guest-header">
                      <div className="shop-menu-avatar guest">
                        <UserRound size={22} />
                      </div>
                      <div>
                        <strong>Xin chào quý khách</strong>
                        <p>Đăng nhập để nhận ưu đãi và theo dõi đơn hàng</p>
                      </div>
                    </div>
                    <div className="shop-menu-auth-actions">
                      <button type="button" className="button button-dark shop-menu-login-btn" onClick={() => {
                setMobileMenuOpen(false);
                setAuthMode("signin");
                setAuthAfterLogin(null);
                setAuthOpen(true);
              }}>
                        Đăng nhập
                      </button>
                      <button type="button" className="button shop-menu-register-btn" onClick={() => {
                setMobileMenuOpen(false);
                setAuthMode("signup");
                setAuthAfterLogin(null);
                setAuthOpen(true);
              }}>
                        Đăng ký
                      </button>
                    </div>
                  </div>}
              </div>

              {/* User Functions / Shortcuts */}
              <div className="shop-menu-section">
                <p className="shop-menu-section-title">TIỆN ÍCH NGƯỜI DÙNG</p>
                <div className="shop-menu-actions-grid">
                  <button type="button" className="shop-menu-action-item" onClick={() => {
              setMobileMenuOpen(false);
              if (user) navigateOrders();else openAuth("orders");
            }}>
                    <Package size={17} />
                    <span>Đơn hàng của tôi</span>
                  </button>

                  <button type="button" className="shop-menu-action-item" onClick={() => {
              setMobileMenuOpen(false);
              if (user) setWishlistOpen(true);else openAuth("wishlist");
            }}>
                    <Heart size={17} />
                    <span>Sản phẩm yêu thích</span>
                  </button>

                  <button type="button" className="shop-menu-action-item" onClick={() => {
              setMobileMenuOpen(false);
              if (user) setNotificationsOpen(true);else openAuth("notifications");
            }}>
                    <Bell size={17} />
                    <span>Thông báo</span>
                    {user && notificationCount > 0 && <span className="shop-menu-badge">
                        {notificationCount > 99 ? "99+" : notificationCount}
                      </span>}
                  </button>

                  <button type="button" className="shop-menu-action-item" onClick={() => {
              setMobileMenuOpen(false);
              if (user) setAddressesOpen(true);else openAuth("addresses");
            }}>
                    <MapPin size={17} />
                    <span>Sổ địa chỉ</span>
                  </button>

                  <button type="button" className="shop-menu-action-item" onClick={() => {
              setMobileMenuOpen(false);
              if (user) setSurveysOpen(true);else openAuth("surveys");
            }}>
                    <ClipboardList size={17} />
                    <span>Khảo sát phong cách</span>
                  </button>

                  {user && <button type="button" className="shop-menu-action-item" onClick={() => {
              setMobileMenuOpen(false);
              setPasswordOpen(true);
            }}>
                      <KeyRound size={17} />
                      <span>Bảo mật tài khoản</span>
                    </button>}
                </div>
              </div>

              {/* Product Categories */}
              <div className="shop-menu-section">
                <p className="shop-menu-section-title">DANH MỤC SẢN PHẨM</p>
                <div className="shop-menu-nav-list">
                  <button type="button" className="shop-menu-nav-item" onClick={() => {
              setMobileMenuOpen(false);
              openCatalog("");
            }}>
                    <span>HÀNG MỚI</span>
                    <ChevronRight size={16} />
                  </button>
                  <button type="button" className="shop-menu-nav-item" onClick={() => {
              setMobileMenuOpen(false);
              openCatalog("Áo khoác");
            }}>
                    <span>ÁO KHOÁC</span>
                    <ChevronRight size={16} />
                  </button>
                  <button type="button" className="shop-menu-nav-item" onClick={() => {
              setMobileMenuOpen(false);
              openCatalog("Áo thun");
            }}>
                    <span>ÁO THUN</span>
                    <ChevronRight size={16} />
                  </button>
                  <button type="button" className="shop-menu-nav-item" onClick={() => {
              setMobileMenuOpen(false);
              openCatalog("Áo polo");
            }}>
                    <span>ÁO POLO</span>
                    <ChevronRight size={16} />
                  </button>
                  <button type="button" className="shop-menu-nav-item" onClick={() => {
              setMobileMenuOpen(false);
              openCatalog("Quần");
            }}>
                    <span>QUẦN</span>
                    <ChevronRight size={16} />
                  </button>
                  <button type="button" className="shop-menu-nav-item sale" onClick={() => {
              setMobileMenuOpen(false);
              openCatalog("", {
                minPrice: "",
                maxPrice: "500000"
              });
            }}>
                    <span>ƯU ĐÃI ĐẶC BIỆT</span>
                    <span className="shop-menu-sale-tag">SALE</span>
                  </button>
                </div>
              </div>

              {/* Settings & Support */}
              <div className="shop-menu-footer">
                <div className="shop-menu-theme-row">
                  <span>Chế độ giao diện ({shopTheme === "dark" ? "Tối" : "Sáng"})</span>
                  <button
                  type="button"
                  className="shop-theme-toggle"
                  aria-label={shopTheme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
                  title={shopTheme === "dark" ? "Chế độ sáng" : "Chế độ tối"}
                  onClick={() => setShopTheme(v => v === "dark" ? "light" : "dark")}
                >
                    {shopTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                  </button>
                </div>
                <div className="shop-menu-hotline">
                  <Headphones size={16} />
                  <div>
                    <small>Hotline chăm sóc khách hàng</small>
                    <b>1900 6868 (8:30 - 22:00)</b>
                  </div>
                </div>
                {user && <button type="button" className="shop-menu-logout-btn" onClick={() => {
            setMobileMenuOpen(false);
            logout();
          }}>
                    <LogOut size={16} />
                    <span>Đăng xuất tài khoản</span>
                  </button>}
              </div>
            </div>
          </aside>
        </div>;
}
