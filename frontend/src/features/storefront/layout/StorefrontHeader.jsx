import React from "react";
import { X } from "lucide-react";
import { Menu } from "lucide-react";
import { Search } from "lucide-react";
import { Sun } from "lucide-react";
import { Moon } from "lucide-react";
import { Bell } from "lucide-react";
import { Heart } from "lucide-react";
import { ShoppingBag } from "lucide-react";

export default function StorefrontHeader({ mobileMenuOpen, setMobileMenuOpen, goHome, openCatalog, search, searchRef, searchInput, setSearchInput, setFilters, shopTheme, setShopTheme, user, setNotificationsOpen, openAuth, notificationCount, setWishlistOpen, wishlist, accountDropdown, setCartOpen, cart }) {
  return (
<header className="site-header">
        <button
          className="mobile-menu icon-button"
          aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((value) => !value)}
        >
          {mobileMenuOpen ? (
            <X size={22} strokeWidth={1.8} />
          ) : (
            <Menu size={22} strokeWidth={1.8} />
          )}
        </button>
        <a className="wordmark" href="/" onClick={goHome}>
          ANH LỚN <em>SHOP · MENSWEAR</em>
        </a>
        <nav
          className={`main-nav ${mobileMenuOpen ? "is-open" : ""}`}
          aria-label="Điều hướng chính"
        >
          <button onClick={() => openCatalog("")}>HÀNG MỚI</button>
          <button onClick={() => openCatalog("Áo khoác")}>ÁO KHOÁC</button>
          <button onClick={() => openCatalog("Áo thun")}>ÁO THUN</button>
          <button onClick={() => openCatalog("Áo polo")}>ÁO POLO</button>
          <button onClick={() => openCatalog("Quần")}>QUẦN</button>
          <button
            className="sale-link"
            onClick={() =>
              openCatalog("", { minPrice: "", maxPrice: "500000" })
            }
          >
            ƯU ĐÃI
          </button>
        </nav>
            <form className="catalog-search-wrap" role="search" onSubmit={search}>
              <Search size={19} aria-hidden="true" />
              <input
                className="catalog-search"
                ref={searchRef}
                type="search"
                aria-label="Tìm kiếm sản phẩm"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tìm kiếm sản phẩm..."
              />
              {searchInput && <button className="shop-search-clear" type="button" aria-label="Xóa từ khóa tìm kiếm" onClick={() => { setSearchInput(''); setFilters(current => ({ ...current, keyword: '', page: 0 })); searchRef.current?.focus(); }}><X size={16}/></button>}
              <button className="shop-search-submit" type="submit">TÌM</button>
            </form>
        <div className="header-actions">
          <button className="shop-theme-toggle" type="button" aria-label={shopTheme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'} title={shopTheme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'} onClick={() => setShopTheme(value => value === 'dark' ? 'light' : 'dark')}>
            {shopTheme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}
          </button>
          <button
            className="icon-button notification-button"
            aria-label="Thông báo"
            title="Thông báo"
            onClick={() => user ? setNotificationsOpen(true) : openAuth("notifications")}
          >
            <Bell size={22} strokeWidth={1.8} />
            {user && notificationCount > 0 && <span>{notificationCount > 9 ? "9+" : notificationCount}</span>}
          </button>
          <button
            className="icon-button wishlist-button"
            aria-label="Sản phẩm yêu thích"
            title="Sản phẩm yêu thích"
            onClick={() => user ? setWishlistOpen(true) : openAuth("wishlist")}
          >
            <Heart size={22} strokeWidth={1.8} />
            {wishlist.length > 0 && <span>{wishlist.length > 9 ? "9+" : wishlist.length}</span>}
          </button>
          {accountDropdown}
          <button
            className="cart-button icon-button"
            aria-label="Giỏ hàng"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingBag size={20} strokeWidth={1.8} />
            <span>{cart.itemCount || 0}</span>
          </button>
        </div>
      </header>
  );
}
