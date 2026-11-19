import React from "react";
import { Home } from "lucide-react";
import { LayoutGrid } from "lucide-react";
import { Heart } from "lucide-react";
import { Bell } from "lucide-react";
import { UserRound } from "lucide-react";

export default function StorefrontMobileNavigation({ pathname, goHome, catalogPage, openCatalog, user, setWishlistOpen, openAuth, wishlist, setNotificationsOpen, notificationCount, navigate }) {
  return (
<nav className="mobile-bottom-nav" aria-label="Điều hướng di động">
        <button
          type="button"
          className={`mobile-bottom-nav-item ${pathname === '/' ? "active" : ""}`}
          onClick={goHome}
        >
          <Home size={20} strokeWidth={1.8} />
          <span>Trang chủ</span>
        </button>
        <button
          type="button"
          className={`mobile-bottom-nav-item ${catalogPage ? "active" : ""}`}
          onClick={() => openCatalog("")}
        >
          <LayoutGrid size={20} strokeWidth={1.8} />
          <span>Sản phẩm</span>
        </button>
        <button
          type="button"
          className="mobile-bottom-nav-item"
          onClick={() => (user ? setWishlistOpen(true) : openAuth("wishlist"))}
        >
          <span className="mobile-nav-icon-wrap">
            <Heart size={20} strokeWidth={1.8} />
            {wishlist.length > 0 && <span className="mobile-nav-badge">{wishlist.length}</span>}
          </span>
          <span>Yêu thích</span>
        </button>
        <button
          type="button"
          className="mobile-bottom-nav-item"
          onClick={() => (user ? setNotificationsOpen(true) : openAuth("notifications"))}
        >
          <span className="mobile-nav-icon-wrap">
            <Bell size={20} strokeWidth={1.8} />
            {user && notificationCount > 0 && (
              <span className="mobile-nav-badge">{notificationCount > 9 ? "9+" : notificationCount}</span>
            )}
          </span>
          <span>Thông báo</span>
        </button>
        <button
          type="button"
          className="mobile-bottom-nav-item"
          onClick={() => {
            if (user) navigate('/tai-khoan');
            else openAuth("profile");
          }}
        >
          <UserRound size={20} strokeWidth={1.8} />
          <span>{user ? "Cá nhân" : "Tài khoản"}</span>
        </button>
      </nav>
  );
}
