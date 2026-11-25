import StorefrontMenuDrawer from "../features/storefront/layout/StorefrontMenuDrawer";
import useCustomerNotifications from "../features/customer/hooks/useCustomerNotifications.js";
import useCustomerCart from "../features/storefront/cart/useCustomerCart.js";
import useCustomerSession from "../features/customer/hooks/useCustomerSession.js";
import useCatalog from "../features/storefront/hooks/useCatalog";
import useWishlist from "../features/customer/hooks/useWishlist";
import StorefrontMobileNavigation from "../features/storefront/layout/StorefrontMobileNavigation";
import StorefrontFooter from "../features/storefront/layout/StorefrontFooter";
import StorefrontHeader from "../features/storefront/layout/StorefrontHeader";
import { readOrdersRoute, ordersHref } from "../features/customer/orders/customer-orders-route.js";
import { readGuestCart } from "../features/storefront/cart/guest-cart-storage.js";
import '../shared/styles/order-display.css';
import React, { useEffect, useRef, useState } from "react";
import { useStorefrontDialogs } from '../shared/hooks/storefront-hooks';
import { imageSrc } from '../shared/utils/storefront-display';
import AccountDropdown from '../features/customer/AccountDropdown';
import StorefrontHome from '../features/storefront/StorefrontHome';
import { ProductModal } from '../features/storefront/ProductDetails';
import CatalogSection from '../features/storefront/CatalogSection';
import CheckoutState from "../features/storefront/CheckoutState";
import CustomerLayout from '../features/customer/CustomerLayout';
import { subtractPurchased } from "../features/storefront/cart-selection";
import { useCustomerRouter, actionPaths, isAccountPath, needsCustomer, isKnownPath, safeReturn } from '../shared/routing/customer-routing';
import '../shared/address/checkout-page.css';
import { DEFAULT_ORDERS_ROUTE } from "../features/customer/orders/default-orders-route";
import { api, endpoints, signOut } from "../api/api";
import { ArrowUp, Check, CircleAlert, Headphones, RefreshCw, ShieldCheck, Truck, X } from "lucide-react";

const lazyNamed = (load, name) => React.lazy(() => load().then(module => ({ default: module[name] })));
const OrdersPage = lazyNamed(() => import("../features/customer/orders/CustomerOrders"), "OrdersPage");
const CheckoutPage = React.lazy(() => import("../features/storefront/CheckoutPage"));
const CartDrawer = lazyNamed(() => import("../features/storefront/CartDrawer"), "CartDrawer");
const AddressModal = React.lazy(() => import("../shared/address/AddressBook"));
const CustomerVouchers = React.lazy(() => import("../features/customer/CustomerVouchers"));
const CustomerPassword = React.lazy(() => import("../features/customer/CustomerPassword"));
const AuthModal = lazyNamed(() => import("../features/customer/CustomerDialogs"), "AuthModal");
const WishlistModal = lazyNamed(() => import("../features/customer/CustomerDialogs"), "WishlistModal");
const NotificationsModal = lazyNamed(() => import("../features/customer/CustomerDialogs"), "NotificationsModal");
const ProfileModal = lazyNamed(() => import("../features/customer/CustomerDialogs"), "ProfileModal");
const SurveyModal = lazyNamed(() => import("../features/customer/CustomerDialogs"), "SurveyModal");

function App() {
  useStorefrontDialogs();
  const { pathname, search: routeSearch, navigate } = useCustomerRouter();
  const pageToggle = path => value => { if (value) navigate(path); };
  const cartOpen = pathname === '/gio-hang', setCartOpen = pageToggle('/gio-hang');
  const authOpen = ['/dang-nhap', '/dang-ky'].includes(pathname);
  const authMode = pathname === '/dang-ky' ? 'register' : 'login';
  const setAuthMode = mode => navigate(`${mode === 'register' ? '/dang-ky' : '/dang-nhap'}?returnTo=${encodeURIComponent(safeReturn(new URLSearchParams(window.location.search).get('returnTo'), safeReturn(window.location.pathname + window.location.search)))}`);
  const setAuthOpen = value => { if (value && !['/dang-nhap', '/dang-ky'].includes(window.location.pathname)) navigate(`/dang-nhap?returnTo=${encodeURIComponent(safeReturn(window.location.pathname + window.location.search))}`); };
  const profileOpen = pathname === '/tai-khoan', setProfileOpen = pageToggle('/tai-khoan');
  const addressesOpen = pathname === '/tai-khoan/dia-chi', setAddressesOpen = pageToggle('/tai-khoan/dia-chi');
  const wishlistOpen = pathname === '/yeu-thich', setWishlistOpen = pageToggle('/yeu-thich');
  const notificationsOpen = pathname === '/thong-bao', setNotificationsOpen = pageToggle('/thong-bao');
  const surveysOpen = pathname === '/khao-sat' || /^\/khao-sat\/\d+$/.test(pathname), setSurveysOpen = pageToggle('/khao-sat');
  const passwordOpen = ['/tai-khoan/doi-mat-khau', '/quen-mat-khau', '/dat-lai-mat-khau'].includes(pathname), setPasswordOpen = pageToggle('/tai-khoan/doi-mat-khau');
  const productId = pathname.match(/^\/san-pham\/(\d+)$/)?.[1];
  const accountPage = isAccountPath(pathname);
  const extraPage = cartOpen || authOpen || accountPage || passwordOpen || !!productId || !isKnownPath(pathname) || pathname === '/thanh-toan';
  const searchRef = useRef(null);

  const { products, catalogPage, setCatalogPage, filters, setFilters, searchInput, setSearchInput, catalogError, loading, loadProducts } = useCatalog((...args) => showNotice(...args));
  const { categories, user, setUser, sessionChecking, sessionError, setSessionError, retrySession } = useCustomerSession();

  const { cart, setCart, cartLoading, setCartLoading, cartError, setCartError, cartOwner, setCartOwner, cartLoad, userRef, updatingCartKeys, loadCart, addToCart, updateCart, selection } = useCustomerCart({ user, sessionChecking, sessionError, cartOpen, showNotice: (...args) => showNotice(...args) });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  useEffect(() => setQuickViewProduct(null), [pathname]);
  const [authAfterLogin, setAuthAfterLogin] = useState(null);
  const [checkoutPage, setCheckoutPage] = useState(() => window.location.pathname === "/dat-hang");
  const [ordersRoute, setOrdersRoute] = useState(readOrdersRoute);

  const { wishlist, setWishlist, wishlistError, wishlistLoading, loadWishlist } = useWishlist(user, wishlistOpen);

  const { notificationCount, setNotificationCount, reloadNotifications } = useCustomerNotifications(user);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  const [notice, setNotice] = useState(null);

  const productRequest = useRef(0);

  useEffect(() => {
    const expire = () => {
      setUser(null); setCartOwner(null); cartLoad.current = null; setProfileOpen(false);
      setAddressesOpen(false); setNotificationsOpen(false); setPasswordOpen(false); setWishlistOpen(false);
      setNotice({ message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', type: 'error' });
    };
    window.addEventListener('shop-session-expired', expire);
    return () => window.removeEventListener('shop-session-expired', expire);
  }, [setProfileOpen, setAddressesOpen, setNotificationsOpen, setPasswordOpen, setWishlistOpen, cartLoad, setCartOwner, setUser]);

  const buyNow = async (product, variant, quantity) => {
    const next = await addToCart(product, variant, quantity);
    if (next) { selection.only({ productId: product.id, ...variant }, next); goCheckout(); }
    return next;
  };

  const openAuth = (afterLogin = null) => {
    setAuthAfterLogin(afterLogin);
    const destination = actionPaths[afterLogin] || safeReturn(window.location.pathname + window.location.search);
    navigate(`/dang-nhap?returnTo=${encodeURIComponent(destination)}`);
  };
  useEffect(() => {
    setMobileMenuOpen(false);
    if (!sessionChecking && !sessionError && !user && needsCustomer(pathname)) {
      navigate(`/dang-nhap?returnTo=${encodeURIComponent(pathname + routeSearch)}`, { replace: true });
    }
  }, [pathname, routeSearch, sessionChecking, sessionError, user, navigate]);

  const showNotice = (message, type = "success") => {
    setNotice({ message, type });
  };

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (user) loadCart();
    else {
      cartLoad.current = null;
      setCartOwner(null); setCartError(""); setCartLoading(false);
      setCart(readGuestCart());
      setWishlist([]);
      setNotificationCount(0);
    }
    if (user) {
      const customerId = user.id;
      api(endpoints.notifications).then((data) => { if (userRef.current?.id === customerId) setNotificationCount(data.unreadCount || 0); }).catch(() => null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- This effect runs on account changes; loadCart is recreated during render and would duplicate cart and notification requests.
  }, [user]);

  const navigateOrders = (next = DEFAULT_ORDERS_ROUTE, { replace = false } = {}) => {
    const route = {
      orderId: next.orderId || null,
      tab: next.tab || "ALL",
      keyword: String(next.keyword || "").trim().slice(0, 120),
      page: Math.max(0, Number(next.page) || 0),
    };
    setMobileMenuOpen(false);
    setOrdersRoute(route);
    setCatalogPage(false);
    setCheckoutPage(false);
    navigate(ordersHref(route), { replace });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const search = (event) => {
    event?.preventDefault();
    const keyword = searchInput.trim();
    setSearchInput(keyword);
    setFilters((current) => ({ ...current, keyword, page: 0 }));
    if (!catalogPage) {
      setCatalogPage(true);
      setOrdersRoute(null);
      navigate(`/san-pham${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ""}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const openCatalog = (category = "", options = {}) => {
    const nextFilters = {
      ...filters,
      keyword: "",
      minPrice: "",
      maxPrice: "",
      onSale: false,
      subCategory: "",
      ...options,
      category,
      page: 0,
    };
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (nextFilters.subCategory) params.set("subCategory", nextFilters.subCategory);
    if (nextFilters.minPrice) params.set("minPrice", nextFilters.minPrice);
    if (nextFilters.maxPrice) params.set("maxPrice", nextFilters.maxPrice);
    if (nextFilters.onSale) params.set("onSale", "true");
    setMobileMenuOpen(false);
    setSearchInput(nextFilters.keyword || "");
    setOrdersRoute(null);
    setCatalogPage(true);
    setCheckoutPage(false);
    setFilters(nextFilters);
    navigate(`/san-pham${params.toString() ? `?${params.toString()}` : ""}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goHome = (event) => {
    event?.preventDefault();
    setMobileMenuOpen(false);
    setCatalogPage(false);
    setCheckoutPage(false);
    setOrdersRoute(null);
    setSearchInput("");
    setFilters((current) => ({
      ...current,
      keyword: "",
      category: "",
      subCategory: "",
      minPrice: "",
      maxPrice: "",
      onSale: false,
      page: 0,
    }));
    navigate('/');
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  useEffect(() => {
    const syncRoute = () => {
      const isCatalog = window.location.pathname === "/san-pham";
      const nextOrdersRoute = readOrdersRoute();
      setOrdersRoute(nextOrdersRoute);
      setCheckoutPage(window.location.pathname === "/dat-hang");
      const params = new URLSearchParams(window.location.search);
      setCatalogPage(isCatalog);
      setFilters((current) => ({
        ...current,
        keyword: isCatalog ? params.get("keyword") || "" : "",
        category: isCatalog ? params.get("category") || "" : "",
        subCategory: isCatalog ? params.get("subCategory") || "" : "",
        minPrice: isCatalog ? params.get("minPrice") || "" : "",
        maxPrice: isCatalog ? params.get("maxPrice") || "" : "",
        onSale: isCatalog && params.get("onSale") === "true",
        sort: isCatalog && ["newest", "price_asc", "price_desc"].includes(params.get("sort")) ? params.get("sort") : "newest",
        page: isCatalog ? Math.max(0, Number.parseInt(params.get("page") || "0", 10) || 0) : 0,
      }));
      setSearchInput(isCatalog ? params.get("keyword") || "" : "");
    };
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, [setCatalogPage, setFilters, setSearchInput]);
  const [productError, setProductError] = useState('');
  const [productReload, setProductReload] = useState(0);
  const openProduct = product => {
    setQuickViewProduct(null);
    navigate(`/san-pham/${product.id}`);
  };
  const openQuickView = product => setQuickViewProduct({ product, feedback: [] });
  const openPurchaseOptions = (product, purchaseIntent, initialVariant, initialQuantity = 1) =>
    setQuickViewProduct({ product, feedback: [], purchaseIntent, initialVariant, initialQuantity });
  useEffect(() => {
    const requestId = ++productRequest.current;
    setSelectedProduct(null); setProductError('');
    if (!productId) return;
    const load = async () => {
    try {
      const detail = await api(endpoints.product(productId));
      if (requestId !== productRequest.current) return;
      setSelectedProduct({
        product: detail,
        feedback: [],
      });
      const feedback = await api(endpoints.feedback(productId));
      if (requestId !== productRequest.current) return;
      setSelectedProduct((current) =>
        String(current?.product.id) === productId ? { ...current, feedback } : current,
      );
    } catch (error) {
      if (requestId === productRequest.current) setProductError(error.message);
    }
    };
    void load();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Invalidate the product request when its route or reload key changes.
      productRequest.current++;
    };
  }, [productId, productReload]);

  const toggleWishlist = async (product) => {
    if (!user) {
      openAuth("wishlist");
      return;
    }
    const exists = wishlist.some((item) => item.productId === product.id);
    try {
      if (exists) {
        await api(endpoints.wishlistItem(product.id), { method: "DELETE" });
        setWishlist((current) => current.filter((item) => item.productId !== product.id));
        showNotice("Đã bỏ khỏi danh sách yêu thích.");
      } else {
        const saved = await api(endpoints.wishlistItem(product.id), { method: "POST" });
        setWishlist((current) => [saved, ...current]);
        showNotice("Đã thêm vào danh sách yêu thích.");
      }
    } catch (error) {
      showNotice(error.message, "error");
    }
  };

  const goCheckout = () => {
    setCartOpen(false); setSelectedProduct(null); setMobileMenuOpen(false);
    navigate('/dat-hang');
    setCatalogPage(false); setCheckoutPage(true); setOrdersRoute(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const startCheckout = () => {
    if (!selection.cart.items.length || updatingCartKeys.length) return showNotice("Vui lòng chọn sản phẩm muốn mua và chờ giỏ cập nhật.", "error");
    goCheckout();
    if (!user && !sessionChecking && !sessionError) openAuth("checkout");
  };

  const afterAuth = (customer) => {
    const destination = safeReturn(new URLSearchParams(window.location.search).get('returnTo'), actionPaths[authAfterLogin] || '/');
    setCartOwner(null); setCartError(""); setSessionError("");
    setUser(customer);
    setAuthOpen(false);
    setAuthAfterLogin(null);
    navigate(destination, { replace: true });
    showNotice(`Chào mừng ${customer.fullName}!`);
  };
  const logout = async () => {
    try { await signOut(); } catch (error) { showNotice(error.message, "error"); return; }
    setUser(null);
    setProfileOpen(false);
      setCart(readGuestCart());
    showNotice("Bạn đã đăng xuất.");
    navigate('/');
  };

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mobileMenuOpen]);

  return (
    <div className={catalogPage ? "site-shell catalog-page" : `site-shell ${!checkoutPage && !ordersRoute && !extraPage ? 'shop-home-page' : ''}`} data-shop-theme="light">
      <div className="announcement">
        <span>ĐỔI SIZE TRONG 30 NGÀY</span>
        <span className="announcement-secondary">NOVA SHOP / NEW FORM</span>
      </div>
      <StorefrontHeader
        categories={categories}
        accountDropdown={<AccountDropdown user={user} unreadCount={notificationCount} onAction={action => {
            if (action === 'login' || action === 'register') { setAuthMode(action); setAuthAfterLogin(null); setAuthOpen(true); return; }
            if (action === 'logout') { logout(); return; }
            if (action === 'orders') { navigateOrders(); return; }
            const screens = { profile: setProfileOpen, wishlist: setWishlistOpen, notifications: setNotificationsOpen, addresses: setAddressesOpen, surveys: setSurveysOpen, password: setPasswordOpen };
            screens[action]?.(true);
          }}/>}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        goHome={goHome}
        openCatalog={openCatalog}
        search={search}
        searchRef={searchRef}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        setFilters={setFilters}
        user={user}
        setNotificationsOpen={setNotificationsOpen}
        openAuth={openAuth}
        notificationCount={notificationCount}
        setWishlistOpen={setWishlistOpen}
        wishlist={wishlist}
        setCartOpen={setCartOpen}
        cart={cart}
      />

      {/* Slide-out Navigation & User Drawer */}
      {mobileMenuOpen && (
        <StorefrontMenuDrawer
          setMobileMenuOpen={setMobileMenuOpen}
          goHome={goHome}
          user={user}
          setProfileOpen={setProfileOpen}
          setAuthMode={setAuthMode}
          setAuthAfterLogin={setAuthAfterLogin}
          setAuthOpen={setAuthOpen}
          navigateOrders={navigateOrders}
          openAuth={openAuth}
          setWishlistOpen={setWishlistOpen}
          setNotificationsOpen={setNotificationsOpen}
          notificationCount={notificationCount}
          setAddressesOpen={setAddressesOpen}
          setSurveysOpen={setSurveysOpen}
          setPasswordOpen={setPasswordOpen}
          openCatalog={openCatalog}
          logout={logout}
        />
      )}

      {ordersRoute ? <CustomerLayout pathname={pathname} user={user} navigate={navigate}>
        {sessionChecking ? <CheckoutState title="Đang mở đơn hàng" message="Đang khôi phục phiên đăng nhập..." loading/> :
         sessionError ? <CheckoutState
                  title="Chưa kết nối được tài khoản"
                  message={sessionError}
                  action="Thử lại"
                  onAction={retrySession}
                /> :
         !user ? <CheckoutState
                  title="Đăng nhập để xem đơn hàng"
                  message="Đăng nhập để theo dõi trạng thái, thanh toán hoặc quản lý đơn đã đặt."
                  action="Đăng nhập"
                  onAction={() => openAuth()}
                /> :
         <React.Suspense fallback={<CheckoutState title="Đang mở đơn hàng" message="Đang tải lịch sử đơn hàng..." loading/>}>
           <OrdersPage
             key={user.id}
             route={ordersRoute}
             onNavigate={navigateOrders}
             onNotice={showNotice}
             onChanged={reloadNotifications}
           />
         </React.Suspense>}
      </CustomerLayout> : checkoutPage ? (
        sessionChecking ? <CheckoutState title="Chuẩn bị đặt hàng" message="Đang khôi phục phiên đăng nhập..." loading/> :
        sessionError ? <CheckoutState
                  title="Chưa kết nối được tài khoản"
                  message={sessionError}
                  action="Thử lại"
                  onAction={retrySession}
                /> :
        !user ? <CheckoutState
                  title="Đăng nhập để đặt hàng"
                  message="Đăng nhập để sử dụng địa chỉ đã lưu và theo dõi đơn hàng."
                  action="Đăng nhập"
                  onAction={() => openAuth("checkout")}
                /> :
        cartError ? <CheckoutState
                  title="Chưa tải được giỏ hàng"
                  message={cartError}
                  action="Thử lại giỏ hàng"
                  onAction={loadCart}
                /> :
        cartLoading || cartOwner !== user.id ? <CheckoutState title="Chuẩn bị đặt hàng" message="Đang tải và đồng bộ giỏ hàng..." loading/> :
        <React.Suspense fallback={<CheckoutState title="Chuẩn bị đặt hàng" message="Đang tải trang thanh toán..." loading/>}>
        <CheckoutPage
          key={user.id}
          cart={selection.cart}
          onShop={() => openCatalog("")}
          onCart={() => navigate('/gio-hang')}
          onOrders={() => navigateOrders()}
          VoucherWallet={CustomerVouchers}
          onPlaced={async (response, purchased) => {
            if (userRef.current?.id !== user.id) return;
            setCart(current => subtractPurchased(current, purchased)); reloadNotifications();
            try { const remaining = await api(endpoints.cart); if (userRef.current?.id === user.id) setCart(remaining); }
            catch { showNotice('Đơn đã tạo thành công. Chưa tải lại được giỏ hàng; vui lòng mở giỏ và thử lại.', 'error'); }
          }}
        />
        </React.Suspense>
      ) : extraPage ? null : <main id="top">
        {sessionError && <div className="shop-connection" role="alert"><CircleAlert size={20} /><span>{sessionError}</span><button onClick={retrySession}>Thử lại</button></div>}
        {catalogPage ? (
          <CatalogSection
            catalogPage={catalogPage}
            products={products}
            filters={filters}
            setFilters={setFilters}
            filtersOpen={filtersOpen}
            setFiltersOpen={setFiltersOpen}
            loading={loading}
            catalogError={catalogError}
            setSearchInput={setSearchInput}
            wishlist={wishlist}
            openProduct={openProduct}
            openQuickView={openQuickView}
            toggleWishlist={toggleWishlist}
            loadProducts={loadProducts}
            openCatalog={openCatalog}
            goHome={goHome}
            onAddToCart={product => openPurchaseOptions(product, 'cart')}
            onBuyNow={product => openPurchaseOptions(product, 'buy')}
          />
        ) : (
          <StorefrontHome
            products={products.content || []}
            categories={categories}
            wishlist={wishlist}
            loading={loading}
            catalogError={catalogError}
            onCatalog={openCatalog}
            onProduct={openProduct}
            onQuickView={openQuickView}
            onWishlist={toggleWishlist}
            onAddToCart={product => openPurchaseOptions(product, 'cart')}
            onBuyNow={product => openPurchaseOptions(product, 'buy')}
            onRetry={loadProducts}
            imageSrc={imageSrc}
          />
        )}
        <section className="promise">
          <div>
            <ShieldCheck size={24} />
            <b>THIẾT KẾ CÓ CHỦ ĐÍCH</b>
            <small>Từng đường cắt đều có lý do</small>
          </div>
          <div>
            <RefreshCw size={24} />
            <b>ĐỔI SIZE DỄ DÀNG</b>
            <small>Trong vòng 30 ngày</small>
          </div>
          <div>
            <Truck size={24} />
            <b>FREESHIP ĐƠN TỪ 399K</b>
            <small>Áp dụng trên giá trị đơn sau giảm giá</small>
          </div>
          <div>
            <Headphones size={24} />
            <b>HỖ TRỢ TẬN TÂM</b>
            <small>Luôn sẵn sàng lắng nghe</small>
          </div>
        </section>
      </main>}

      {notice && (
        <div className={`toast ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'} aria-atomic="true">
          <span aria-hidden="true">
            {notice.type === "error" ? (
              <CircleAlert size={18} />
            ) : (
              <Check size={18} />
            )}
          </span>
          <div className="toast-message">{notice.message}</div>
          {notice.message?.includes('thêm') && notice.message?.includes('giỏ') && <button onClick={() => navigate('/gio-hang')}>Xem giỏ hàng</button>}
          <button className="toast-close" aria-label="Đóng thông báo" onClick={() => setNotice(null)}><X size={18} aria-hidden="true" /></button>
        </div>
      )}
      {extraPage && !ordersRoute && <CustomerPageFrame
                  account={accountPage}
                  pathname={pathname}
                  user={user}
                  navigate={navigate}
                >
      {needsCustomer(pathname) && (sessionChecking || sessionError || !user) ? <CheckoutState
                  title={sessionChecking ? 'Đang khôi phục tài khoản' : 'Đăng nhập để tiếp tục'}
                  message={sessionError || 'Đang kiểm tra phiên đăng nhập...'}
                  loading={sessionChecking}
                  action={sessionError ? 'Thử lại' : undefined}
                  onAction={retrySession}
                /> : <>
      {pathname === '/tai-khoan/voucher' && <CustomerVouchers/>}
      {!isKnownPath(pathname) && <CheckoutState
                  title="Không tìm thấy trang"
                  message="Đường dẫn không tồn tại."
                  action="Về trang chủ"
                  onAction={() => navigate('/')}
                />}
      {pathname === '/thanh-toan' && <CheckoutState
                  title="Kiểm tra thanh toán"
                  message="Mở đơn hàng để kiểm tra trạng thái thanh toán được xác nhận từ cửa hàng."
                  action="Xem đơn hàng"
                  onAction={() => navigate('/don-hang')}
                />}
      {productId && productError && <CheckoutState
                  title="Chưa tải được sản phẩm"
                  message={productError}
                  action="Thử lại"
                  onAction={() => setProductReload(value => value + 1)}
                />}
      {productId && !selectedProduct && !productError && <CheckoutState title="Đang tải sản phẩm" loading/>}
      {productId && selectedProduct && (
          <ProductModal
            page
            key={productId}
            data={selectedProduct}
            user={user}
            onClose={() => navigate(safeReturn(window.history.state?.customerFrom, '/san-pham'))}
            onAdd={(variant, quantity) =>
              openPurchaseOptions(selectedProduct.product, 'cart', variant, quantity)
            }
            onBuyNow={(variant, quantity) => openPurchaseOptions(selectedProduct.product, 'buy', variant, quantity)}
            onLogin={() => openAuth()}
          />
      )}
      {cartOpen && (sessionChecking ? <CheckoutState title="Đang tải giỏ hàng" loading/> : sessionError || cartError ? <CheckoutState
                  title="Chưa tải được giỏ hàng"
                  message={sessionError || cartError}
                  action="Thử lại"
                  onAction={sessionError ? retrySession : loadCart}
                /> : cartLoading || user && cartOwner !== user.id ? <CheckoutState title="Đang đồng bộ giỏ hàng" loading/> :
        <CartDrawer
          page
          selection={selection}
          cart={cart}
          onClose={() => navigate('/san-pham')}
          onUpdate={updateCart}
          updatingKeys={updatingCartKeys}
          onCheckout={startCheckout}
        />
      )}
      {authOpen && (
        <AuthModal
          page
          onForgot={() => navigate('/quen-mat-khau')}
          mode={authMode}
          onModeChange={setAuthMode}
          onClose={() => navigate('/')}
          onAuthenticated={afterAuth}
          onNotice={showNotice}
        />
      )}

      {profileOpen && (
        <ProfileModal
          page
          user={user}
          onClose={() => setProfileOpen(false)}
          onUser={setUser}
          onLogout={logout}
          onOpenOrders={() => {
             setProfileOpen(false);
             navigateOrders();
           }}
          onOpenWishlist={() => {
             setProfileOpen(false);
             setWishlistOpen(true);
           }}
          onOpenNotifications={() => {
             setProfileOpen(false);
             setNotificationsOpen(true);
           }}
          onOpenSurveys={() => {
            setProfileOpen(false);
            setSurveysOpen(true);
          }}
          onOpenAddresses={() => {
            setProfileOpen(false);
            setAddressesOpen(true);
          }}
          onOpenPassword={() => {
            setProfileOpen(false);
            setPasswordOpen(true);
          }}
          onNotice={showNotice}
        />
      )}
      {surveysOpen && (
        <SurveyModal
          page
          surveyId={pathname.match(/^\/khao-sat\/(\d+)$/)?.[1]}
          onNavigate={navigate}
          user={user}
          onClose={() => navigate('/khao-sat')}
          onLogin={() => {
            setSurveysOpen(false);
            setAuthOpen(true);
          }}
          onNotice={showNotice}
        />
      )}
      {wishlistOpen && (wishlistError ? <CheckoutState
                  title="Chưa tải được yêu thích"
                  message={wishlistError}
                  action="Thử lại"
                  onAction={loadWishlist}
                /> : wishlistLoading ? <CheckoutState title="Đang tải yêu thích" loading/> : <WishlistModal
                  page
                  items={wishlist}
                  onClose={() => navigate('/tai-khoan')}
                  onRemove={(item) => toggleWishlist(item)}
                  onOpen={openProduct}
                />)}
      {addressesOpen && <AddressModal page onClose={() => navigate('/tai-khoan')} onNotice={showNotice} />}
      {notificationsOpen && <NotificationsModal page onClose={() => navigate('/tai-khoan')} onCount={setNotificationCount} />}
      {passwordOpen && <CustomerPassword initialMode={pathname === '/quen-mat-khau' ? 'forgot' : pathname === '/dat-lai-mat-khau' ? 'reset' : 'change'} onNavigate={navigate} onNotice={showNotice} />}
      </>}
      </CustomerPageFrame>}

      {quickViewProduct && (
        <ProductModal
          key={`${quickViewProduct.product.id}-${quickViewProduct.purchaseIntent || 'preview'}`}
          quickView
          purchaseIntent={quickViewProduct.purchaseIntent}
          initialVariant={quickViewProduct.initialVariant}
          initialQuantity={quickViewProduct.initialQuantity}
          data={quickViewProduct}
          user={user}
          onClose={() => setQuickViewProduct(null)}
          onAdd={(variant, quantity) =>
            addToCart(quickViewProduct.product, variant, quantity)
          }
          onBuyNow={(variant, quantity) =>
            buyNow(quickViewProduct.product, variant, quantity)
          }
          onViewDetails={() => openProduct(quickViewProduct.product)}
          onLogin={() => openAuth()}
        />
      )}

      {/* Mobile Bottom Navigation Bar */}
      <StorefrontFooter
        goHome={goHome}
        openCatalog={openCatalog}
        user={user}
        navigateOrders={navigateOrders}
        openAuth={openAuth}
        navigate={navigate}
        setSurveysOpen={setSurveysOpen}
        setProfileOpen={setProfileOpen}
      />
      <StorefrontMobileNavigation
        pathname={pathname}
        goHome={goHome}
        catalogPage={catalogPage}
        openCatalog={openCatalog}
        user={user}
        setWishlistOpen={setWishlistOpen}
        openAuth={openAuth}
        wishlist={wishlist}
        setNotificationsOpen={setNotificationsOpen}
        notificationCount={notificationCount}
        navigate={navigate}
      />
      {showBackToTop && (
        <button
          type="button"
          className="back-to-top-button"
          aria-label="Lên đầu trang"
          title="Lên đầu trang"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <ArrowUp size={20} />
        </button>
      )}
    </div>
  );
}

function CustomerPageFrame({ account, pathname, user, navigate, children }) {
  return <React.Suspense fallback={<CheckoutState title="Đang tải trang" message="Đang chuẩn bị nội dung..." loading/>}>
    {account ? <CustomerLayout pathname={pathname} user={user} navigate={navigate}>{children}</CustomerLayout> : <main className="customer-standalone">{children}</main>}
  </React.Suspense>;
}

export default App;
