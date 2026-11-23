import React, { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, Heart, Menu, Search, ShoppingBag, X } from "lucide-react";
export default function StorefrontHeader({
  mobileMenuOpen,
  setMobileMenuOpen,
  categories = [],
  goHome,
  openCatalog,
  search,
  searchRef,
  searchInput,
  setSearchInput,
  setFilters,
  user,
  setNotificationsOpen,
  openAuth,
  notificationCount,
  setWishlistOpen,
  wishlist,
  accountDropdown,
  setCartOpen,
  cart
}) {
  const [productsMenuOpen, setProductsMenuOpen] = useState(false);
  const productsMenuRef = useRef(null);
  const productsMenuCloseTimer = useRef(null);
  const canHover = () => typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
  const openProductsMenuOnHover = () => {
    if (!canHover()) return;
    if (productsMenuCloseTimer.current) {
      clearTimeout(productsMenuCloseTimer.current);
      productsMenuCloseTimer.current = null;
    }
    setProductsMenuOpen(true);
  };
  const scheduleProductsMenuClose = () => {
    if (!canHover()) return;
    if (productsMenuCloseTimer.current) clearTimeout(productsMenuCloseTimer.current);
    productsMenuCloseTimer.current = setTimeout(() => {
      productsMenuCloseTimer.current = null;
      setProductsMenuOpen(false);
    }, 180);
  };
  const availableCategories = Array.isArray(categories) && categories.length
    ? categories.filter(category => typeof category === "string")
    : ["Áo thun", "Áo polo", "Áo khoác", "Quần"];
  const categoryOrder = ["Áo thun", "Áo polo", "Áo sơ mi", "Áo khoác", "Áo nỉ", "Quần"];
  const sortCategories = names => [...names].sort((a, b) => {
    const aIndex = categoryOrder.findIndex(name => name.toLocaleLowerCase("vi") === a.toLocaleLowerCase("vi"));
    const bIndex = categoryOrder.findIndex(name => name.toLocaleLowerCase("vi") === b.toLocaleLowerCase("vi"));
    return (aIndex < 0 ? categoryOrder.length : aIndex) - (bIndex < 0 ? categoryOrder.length : bIndex) || a.localeCompare(b, "vi");
  });
  const topCategories = sortCategories(availableCategories.filter(category => /áo|polo|hoodie|shirt|top/i.test(category)));
  const bottomCategories = sortCategories(availableCategories.filter(category => /quần|jean|denim|short|kaki|chino/i.test(category)));
  const otherCategories = sortCategories(availableCategories.filter(category => !topCategories.includes(category) && !bottomCategories.includes(category)));
  const productMenuColumns = [
    {
      title: "TẤT CẢ SẢN PHẨM",
      links: [
        { label: "Tất cả sản phẩm", category: "" },
        { label: "Sản phẩm mới nhất", category: "", options: { sort: "newest" } },
        { label: "Sản phẩm đang ưu đãi", category: "", options: { onSale: true }, featured: true },
      ],
    },
    ...(topCategories.length ? [{ title: "ÁO NAM", links: topCategories.map(category => ({ label: category, category })) }] : []),
    ...(bottomCategories.length ? [{ title: "QUẦN NAM", links: bottomCategories.map(category => ({ label: category, category })) }] : []),
    ...(otherCategories.length ? [{ title: "DANH MỤC KHÁC", links: otherCategories.map(category => ({ label: category, category })) }] : []),
  ];

  useEffect(() => () => {
    if (productsMenuCloseTimer.current) clearTimeout(productsMenuCloseTimer.current);
  }, []);

  useEffect(() => {
    if (!productsMenuOpen) return undefined;
    const closeMenu = event => {
      if (event.key === "Escape") setProductsMenuOpen(false);
    };
    const closeOnOutsidePointer = event => {
      if (!productsMenuRef.current?.contains(event.target)) setProductsMenuOpen(false);
    };
    window.addEventListener("keydown", closeMenu);
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      window.removeEventListener("keydown", closeMenu);
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [productsMenuOpen]);

  const chooseProductCategory = (category, options = {}) => {
    setProductsMenuOpen(false);
    openCatalog(category, options);
  };

  return <header className="site-header">
        <button
          className="mobile-menu icon-button"
          aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(value => !value)}
        >
          {mobileMenuOpen ? <X size={22} strokeWidth={1.8} /> : <Menu size={22} strokeWidth={1.8} />}
        </button>
        <a className="wordmark" href="/" onClick={goHome}>
          NOVA <em>SHOP · MENSWEAR</em>
        </a>
        <nav className={`main-nav ${mobileMenuOpen ? "is-open" : ""}`} aria-label="Điều hướng chính">
          <div
            ref={productsMenuRef}
            className={`shop-products-menu${productsMenuOpen ? " is-open" : ""}`}
            onMouseEnter={openProductsMenuOnHover}
            onMouseLeave={scheduleProductsMenuClose}
            onBlur={event => {
              if (!event.currentTarget.contains(event.relatedTarget)) setProductsMenuOpen(false);
            }}
          >
            <button
              className="shop-products-trigger"
              type="button"
              aria-expanded={productsMenuOpen}
              aria-controls="shop-products-mega-menu"
              onClick={() => setProductsMenuOpen(value => !value)}
            >
              SẢN PHẨM <ChevronDown size={14} aria-hidden="true" />
            </button>
            {productsMenuOpen && <div className="shop-mega-menu" id="shop-products-mega-menu" aria-label="Danh mục sản phẩm">
              {productMenuColumns.map(column => <section className="shop-mega-menu-column" key={column.title}>
                <h2>{column.title}</h2>
                <ul>
                  {column.links.map(link => <li key={`${column.title}-${link.label}`}>
                    <button
                      type="button"
                      className={link.featured ? "is-featured" : ""}
                      onClick={() => chooseProductCategory(link.category, link.options)}
                    >{link.label}</button>
                  </li>)}
                </ul>
              </section>)}
            </div>}
          </div>
          <button className="sale-link" onClick={() => openCatalog("", {
        onSale: true
      })}>
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
                onChange={event => setSearchInput(event.target.value)}
                placeholder="Tìm kiếm sản phẩm..."
              />
              {searchInput && <button
                  className="shop-search-clear"
                  type="button"
                  aria-label="Xóa từ khóa tìm kiếm"
                  onClick={() => {
        setSearchInput('');
        setFilters(current => ({
          ...current,
          keyword: '',
          page: 0
        }));
        searchRef.current?.focus();
      }}
                ><X size={16} /></button>}
              <button className="shop-search-submit" type="submit">TÌM</button>
            </form>
        <div className="header-actions">
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
          <button className="cart-button icon-button" aria-label="Giỏ hàng" onClick={() => setCartOpen(true)}>
            <ShoppingBag size={20} strokeWidth={1.8} />
            <span>{cart.itemCount || 0}</span>
          </button>
        </div>
      </header>;
}
