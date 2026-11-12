import '../shared/styles/order-display.css';
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useStorefrontDialogs } from '../shared/hooks/storefront-hooks';
import { imageSrc } from '../shared/utils/storefront-display';
import AccountDropdown from '../features/customer/AccountDropdown';
import StorefrontHome from '../features/storefront/StorefrontHome';
import { ProductModal } from '../features/storefront/ProductDetails';
import CatalogSection from '../features/storefront/CatalogSection';
import { CartDrawer } from '../features/storefront/CartDrawer';
import AddressModal from "../shared/address/AddressBook";
import CheckoutPage, { CheckoutState } from "../features/storefront/CheckoutPage";
import CustomerLayout from '../features/customer/CustomerLayout';
import CustomerVouchers from '../features/customer/CustomerVouchers';
import CustomerPassword from '../features/customer/CustomerPassword';
import { AuthModal, WishlistModal, NotificationsModal, ProfileModal, SurveyModal } from '../features/customer/CustomerDialogs';
import { useCartSelection, transferGuestSelection, subtractPurchased } from '../features/storefront/cart-selection';
import { useCustomerRouter, actionPaths, isAccountPath, needsCustomer, isKnownPath, safeReturn } from '../shared/routing/customer-routing';
import '../features/customer/customer-pages.css';
export { default as AddressModal } from "../shared/address/AddressBook";
export { CartDrawer } from "../features/storefront/CartDrawer";
import { OrdersPage, DEFAULT_ORDERS_ROUTE } from "./CustomerOrders";
export { OrdersPage, OrdersModal, ReceiptAction, OrderView } from "./CustomerOrders";
import {
  api,
  endpoints,
  refreshSession,
  signOut,
} from "../api/api";
import {
  ArrowUp,
  Bell,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Heart,
  Headphones,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  MapPin,
  RefreshCw,
  Search,
  Sun,
  Moon,
  ShieldCheck,
  ShoppingBag,
  Truck,
  KeyRound,
  UserRound,
  X,
} from "lucide-react";

const GUEST_CART_KEY = "anh-lon-shop-guest-cart";
const emptyCart = () => ({ items: [], subtotal: 0, itemCount: 0 });
const readGuestCart = () => {
  if (typeof window === "undefined") return emptyCart();
  try {
    const value = JSON.parse(window.localStorage.getItem(GUEST_CART_KEY) || "null");
    return value?.items ? value : emptyCart();
  } catch {
    return emptyCart();
  }
};
const saveGuestCart = (value) => {
  if (typeof window !== "undefined") window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(value));
};
const clearGuestCart = () => {
  if (typeof window !== "undefined") window.localStorage.removeItem(GUEST_CART_KEY);
};
const readOrdersRoute = () => {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/^\/don-hang(?:\/(\d+))?\/?$/);
  if (!match) return null;
  const params = new URLSearchParams(window.location.search);
  const allowedTabs = new Set(["ALL", "TO_PAY", "TO_CONFIRM", "TO_SHIP", "TO_RECEIVE", "TO_CONFIRM_RECEIPT", "COMPLETED", "CANCELLED", "RETURN"]);
  const requestedTab = (params.get("tab") || "ALL").toUpperCase();
  return {
    orderId: match[1] ? Number(match[1]) : null,
    tab: allowedTabs.has(requestedTab) ? requestedTab : "ALL",
    keyword: (params.get("keyword") || "").slice(0, 120),
    page: Math.max(0, Number.parseInt(params.get("page") || "0", 10) || 0),
  };
};
const ordersHref = ({ orderId = null, tab = "ALL", keyword = "", page = 0 } = {}) => {
  const params = new URLSearchParams();
  if (tab !== "ALL") params.set("tab", tab);
  if (keyword) params.set("keyword", keyword);
  if (page > 0) params.set("page", String(page));
  const query = params.toString();
  return `/don-hang${orderId ? `/${orderId}` : ""}${query ? `?${query}` : ""}`;
};

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
  const [shopTheme, setShopTheme] = useState(() => {
    try { return localStorage.getItem('anh-lon-shop-theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
  });
  const searchRef = useRef(null);
  useEffect(() => { try { localStorage.setItem('anh-lon-shop-theme', shopTheme); } catch { /* Theme still works when storage is unavailable. */ } }, [shopTheme]);
  const [products, setProducts] = useState({
    content: [],
    totalElements: 0,
    totalPages: 0,
    number: 0,
  });
  const [categories, setCategories] = useState([]);
  const [catalogPage, setCatalogPage] = useState(
    () =>
      typeof window !== "undefined" && window.location.pathname === "/san-pham",
  );
  const [filters, setFilters] = useState(() => {
    const isCatalog =
      typeof window !== "undefined" && window.location.pathname === "/san-pham";
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    );
    return {
      keyword: isCatalog ? params.get("keyword") || "" : "",
      category: isCatalog ? params.get("category") || "" : "",
      minPrice: isCatalog ? params.get("minPrice") || "" : "",
      maxPrice: isCatalog ? params.get("maxPrice") || "" : "",
      gender: "NAM",
      sort: isCatalog && ["newest", "price_asc", "price_desc"].includes(params.get("sort")) ? params.get("sort") : "newest",
      page: isCatalog ? Math.max(0, Number.parseInt(params.get("page") || "0", 10) || 0) : 0,
    };
  });
  const [searchInput, setSearchInput] = useState(() => window.location.pathname === "/san-pham" ? new URLSearchParams(window.location.search).get("keyword") || "" : "");
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState(() => readGuestCart());
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [authAfterLogin, setAuthAfterLogin] = useState(null);
  const [checkoutPage, setCheckoutPage] = useState(() => window.location.pathname === "/dat-hang");
  const [ordersRoute, setOrdersRoute] = useState(readOrdersRoute);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState("");
  const [cartOwner, setCartOwner] = useState(null);
  const cartLoad = useRef(null);
  const userRef = useRef(user);
  userRef.current = user;
  const [wishlist, setWishlist] = useState([]);
  const [wishlistError, setWishlistError] = useState('');
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const wishlistRequest = useRef(0);
  const loadWishlist = useCallback(async () => {
    const request = ++wishlistRequest.current;
    if (!user?.id) return;
    setWishlistLoading(true); setWishlistError('');
    try { const items = await api(endpoints.wishlist); if (request === wishlistRequest.current) setWishlist(items); }
    catch (error) { if (request === wishlistRequest.current) setWishlistError(error.message); }
    finally { if (request === wishlistRequest.current) setWishlistLoading(false); }
  }, [user?.id]);
  const userId = user?.id;
  useEffect(() => { if (userId) void loadWishlist();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Invalidate an in-flight request when the user or wishlist route changes.
      wishlistRequest.current++;
    };
  }, [userId, wishlistOpen, loadWishlist]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  const [notice, setNotice] = useState(null);
  const [catalogError, setCatalogError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const catalogRequest = useRef(0);
  const productRequest = useRef(0);
  const cartUpdateLocks = useRef(new Set());
  const [updatingCartKeys, setUpdatingCartKeys] = useState([]);
  useEffect(() => {
    const expire = () => {
      setUser(null); setCartOwner(null); cartLoad.current = null; setProfileOpen(false);
      setAddressesOpen(false); setNotificationsOpen(false); setPasswordOpen(false); setWishlistOpen(false);
      setNotice({ message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', type: 'error' });
    };
    window.addEventListener('shop-session-expired', expire);
    return () => window.removeEventListener('shop-session-expired', expire);
  }, [setProfileOpen, setAddressesOpen, setNotificationsOpen, setPasswordOpen, setWishlistOpen]);

  const buyNow = async (product, variant, quantity) => {
    const next = await addToCart(product, variant, quantity);
    if (next) { selection.only({ productId: product.id, ...variant }, next); goCheckout(); }
  };
  const selection = useCartSelection({ owner: user ? `customer-${user.id}` : 'guest', cart,
    ready: !sessionChecking && !sessionError && !cartLoading && !cartError && (!user || cartOwner === user.id), initialize: cartOpen });

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

  const loadProducts = async () => {
    const requestId = ++catalogRequest.current;
    setLoading(true);
    try {
      setCatalogError("");
      const result = await api(endpoints.catalog(filters));
      if (requestId === catalogRequest.current) setProducts(result);
    } catch (error) {
      if (requestId !== catalogRequest.current) return;
      const message =
        error.message === "Failed to fetch"
          ? "Không kết nối được với máy chủ. Hãy khởi động backend rồi bấm thử lại."
          : error.message;
      setCatalogError(message);
      showNotice(message, "error");
    } finally {
      if (requestId === catalogRequest.current) setLoading(false);
    }
  };
  const loadCart = async () => {
    const customerId = user?.id;
    if (!customerId) return;
    if (cartLoad.current?.customerId === customerId) return cartLoad.current.promise;
    const task = { customerId };
    cartLoad.current = task;
    setCartLoading(true); setCartError("");
    const current = () => userRef.current?.id === customerId && cartLoad.current === task;
    task.promise = (async () => {
      try {
        const serverCart = await api(endpoints.cart);
        if (!current()) return;
        if (!Array.isArray(serverCart?.items)) throw new Error("Dữ liệu giỏ hàng không hợp lệ. Vui lòng thử lại.");
        const guest = readGuestCart();
        let next = serverCart;
        if (guest.items.length) {
          const merged = serverCart.items.map(item => ({ ...item }));
          guest.items.forEach(item => {
            const found = merged.find(value => value.productId === item.productId && value.size === item.size && value.color === item.color);
            if (found) found.quantity += item.quantity;
            else merged.push({ ...item });
          });
          next = await api(endpoints.cart, { method: "PUT", body: { items: merged.map(({ productId, quantity, size, color }) => ({ productId, quantity, size, color })) } });
          if (!Array.isArray(next?.items)) throw new Error("Chưa đồng bộ được giỏ hàng. Vui lòng thử lại.");
          if (current()) transferGuestSelection(customerId);
          if (JSON.stringify(readGuestCart()) === JSON.stringify(guest)) clearGuestCart();
        }
        if (current()) { setCart(next); setCartOwner(customerId); }
      } catch (error) {
        if (current()) setCartError(error.message || "Không tải được giỏ hàng. Vui lòng thử lại.");
      } finally {
        if (current()) { setCartLoading(false); cartLoad.current = null; }
      }
    })();
    return task.promise;
  };

  const showNotice = (message, type = "success") => {
    setNotice({ message, type });
  };

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    api(endpoints.categories)
      .then(setCategories)
      .catch(() => null);
    let active = true;
    refreshSession().then((session) => {
      if (active && session?.customer) setUser(session.customer);
    }).catch(error => { if (active) setSessionError(error.message); })
      .finally(() => { if (active) setSessionChecking(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    loadProducts();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Invalidate the pending catalog request when the tracked query changes.
      catalogRequest.current++;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- The effect intentionally tracks only catalog query fields; loadProducts is recreated each render and would refetch on unrelated state updates.
  }, [
    catalogPage,
    filters.keyword,
    filters.category,
    filters.minPrice,
    filters.maxPrice,
    filters.sort,
    filters.page,
  ]);
  useEffect(() => {
    if (!catalogPage || window.location.pathname !== "/san-pham") return;
    const params = new URLSearchParams();
    if (filters.keyword) params.set("keyword", filters.keyword);
    if (filters.category) params.set("category", filters.category);
    if (filters.minPrice) params.set("minPrice", filters.minPrice);
    if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
    if (filters.sort !== "newest") params.set("sort", filters.sort);
    if (filters.page > 0) params.set("page", String(filters.page));
    const query = params.toString();
    window.history.replaceState({}, "", `/san-pham${query ? `?${query}` : ""}`);
  }, [catalogPage, filters.keyword, filters.category, filters.minPrice, filters.maxPrice, filters.sort, filters.page]);
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

  const chooseCategory = (category) =>
    setFilters((current) => ({ ...current, category, page: 0 }));
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
      ...options,
      category,
      page: 0,
    };
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (nextFilters.minPrice) params.set("minPrice", nextFilters.minPrice);
    if (nextFilters.maxPrice) params.set("maxPrice", nextFilters.maxPrice);
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
      minPrice: "",
      maxPrice: "",
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
        minPrice: isCatalog ? params.get("minPrice") || "" : "",
        maxPrice: isCatalog ? params.get("maxPrice") || "" : "",
        sort: isCatalog && ["newest", "price_asc", "price_desc"].includes(params.get("sort")) ? params.get("sort") : "newest",
        page: isCatalog ? Math.max(0, Number.parseInt(params.get("page") || "0", 10) || 0) : 0,
      }));
      setSearchInput(isCatalog ? params.get("keyword") || "" : "");
    };
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);
  const [productError, setProductError] = useState('');
  const [productReload, setProductReload] = useState(0);
  const openProduct = product => navigate(`/san-pham/${product.id}`);
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
  const localCart = (product, quantity = 1, variant = {}) => {
    const existing = cart.items.find(
      (item) =>
        item.productId === product.id &&
        item.size === variant.size &&
        item.color === variant.color,
    );
    const items = existing
      ? cart.items.map((item) =>
          item.productId === product.id &&
          item.size === variant.size &&
          item.color === variant.color
            ? {
                ...item,
                quantity: item.quantity + quantity,
                lineTotal: Number(item.unitPrice) * (item.quantity + quantity),
              }
            : item,
        )
      : [
          ...cart.items,
          {
            productId: product.id,
            name: product.name,
            imageUrl: product.imageUrl,
            unitPrice: product.salePrice || product.price,
            quantity,
            lineTotal: Number(product.salePrice || product.price) * quantity,
            stock: product.stock,
            size: variant.size,
            color: variant.color,
          },
        ];
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.lineTotal),
      0,
    );
    const nextCart = {
      items,
      subtotal,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    };
    setCart(nextCart);
    saveGuestCart(nextCart);
    return nextCart;
  };
  const addToCart = async (product, variant = {}, quantity = 1) => {
    const requestedQuantity = Math.max(1, Number(quantity) || 1);
    const existing = cart.items.find(
      (item) =>
        item.productId === product.id &&
        item.size === variant.size &&
        item.color === variant.color,
    );
    if (existing && existing.quantity + requestedQuantity > product.stock) {
      showNotice(`Sản phẩm chỉ còn ${product.stock} sản phẩm trong kho.`, "error");
      return;
    }
    if (!product.stock || requestedQuantity > product.stock) {
      showNotice("Sản phẩm đã hết hàng hoặc không đủ số lượng.", "error");
      return;
    }
    if (!user) {
      const next = localCart(product, requestedQuantity, variant);
      showNotice("Đã thêm sản phẩm vào giỏ tạm. Đăng nhập khi thanh toán nhé.");
      return next;
    }
    try {
      const next = await api(endpoints.addCart, {
          method: "POST",
          body: { productId: product.id, quantity: requestedQuantity, ...variant },
        });
      setCart(next);
      showNotice("Đã thêm vào giỏ hàng.");
      return next;
    } catch (error) {
      showNotice(error.message, "error");
    }
  };
  const updateCart = async (line, quantity) => {
    const nextQuantity = Math.max(0, Number(quantity) || 0);
    const sameLine = (item) =>
      item.productId === line.productId &&
      item.size === line.size &&
      item.color === line.color;
    if (nextQuantity > line.stock) {
      showNotice(`Sản phẩm chỉ còn ${line.stock} sản phẩm trong kho.`, "error");
      return;
    }
    if (!user) {
      const items = cart.items.filter((item) => !sameLine(item));
      const nextItems = nextQuantity < 1 ? items : cart.items.map((item) => sameLine(item) ? { ...item, quantity: nextQuantity, lineTotal: Number(item.unitPrice) * nextQuantity } : item);
      const nextCart = {
        items: nextItems,
        subtotal: nextItems.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0),
        itemCount: nextItems.reduce((sum, item) => sum + item.quantity, 0),
      };
      setCart(nextCart);
      saveGuestCart(nextCart);
    } else {
      const updateKey = `${line.productId}|${line.size || ""}|${line.color || ""}`;
      if (cartUpdateLocks.current.has(updateKey)) return;
      cartUpdateLocks.current.add(updateKey);
      setUpdatingCartKeys((current) => [...current, updateKey]);
      try {
        setCart(
          await api(endpoints.cart, {
            method: "PUT",
            body: {
              items: cart.items
                .map((item) => ({
                  productId: item.productId,
                  quantity: sameLine(item) ? nextQuantity : item.quantity,
                  size: item.size,
                  color: item.color,
                }))
                .filter((item) => item.quantity > 0),
            },
          }),
        );
      } catch (error) {
        showNotice(error.message, "error");
      } finally {
        cartUpdateLocks.current.delete(updateKey);
        setUpdatingCartKeys((current) => current.filter((key) => key !== updateKey));
      }
    }
  };
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
  const reloadNotifications = async () => {
    if (!user) return;
    try {
      const data = await api(endpoints.notifications);
      setNotificationCount(data.unreadCount || 0);
    } catch { /* thông báo không làm gián đoạn việc mua hàng */ }
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
  const retrySession = async () => {
    setSessionChecking(true);
    try {
      const session = await refreshSession();
      setUser(session?.customer || null); setSessionError("");
    } catch (error) { setSessionError(error.message); }
    finally { setSessionChecking(false); }
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
    <div className={catalogPage ? "site-shell catalog-page" : `site-shell ${!checkoutPage && !ordersRoute && !extraPage ? 'shop-home-page' : ''}`} data-shop-theme={shopTheme}>
      <div className="announcement">
        <span>ĐỔI SIZE TRONG 30 NGÀY</span>
        <span className="announcement-secondary">ANH LỚN / NEW FORM</span>
      </div>
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
          <AccountDropdown user={user} unreadCount={notificationCount} onAction={action => {
            if (action === 'login' || action === 'register') { setAuthMode(action); setAuthAfterLogin(null); setAuthOpen(true); return; }
            if (action === 'logout') { logout(); return; }
            if (action === 'orders') { navigateOrders(); return; }
            const screens = { profile: setProfileOpen, wishlist: setWishlistOpen, notifications: setNotificationsOpen, addresses: setAddressesOpen, surveys: setSurveysOpen, password: setPasswordOpen };
            screens[action]?.(true);
          }}/>
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

      {/* Slide-out Navigation & User Drawer */}
      {mobileMenuOpen && (
        <div
          className="shop-menu-drawer-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            className="shop-menu-drawer"
            aria-label="Menu chức năng và điều hướng"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shop-menu-drawer-header">
              <div className="shop-menu-drawer-brand">
                <a
                  className="wordmark"
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    setMobileMenuOpen(false);
                    goHome();
                  }}
                >
                  ANH LỚN <em>SHOP</em>
                </a>
              </div>
              <button
                className="shop-menu-drawer-close icon-button"
                aria-label="Đóng menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="shop-menu-drawer-body">
              {/* User Card */}
              <div className="shop-menu-user-card">
                {user ? (
                  <>
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
                      <button
                        type="button"
                        className="shop-menu-profile-btn"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setProfileOpen(true);
                        }}
                      >
                        Xem tài khoản
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="shop-menu-guest">
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
                      <button
                        type="button"
                        className="button button-dark shop-menu-login-btn"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setAuthMode("signin");
                          setAuthAfterLogin(null);
                          setAuthOpen(true);
                        }}
                      >
                        Đăng nhập
                      </button>
                      <button
                        type="button"
                        className="button shop-menu-register-btn"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setAuthMode("signup");
                          setAuthAfterLogin(null);
                          setAuthOpen(true);
                        }}
                      >
                        Đăng ký
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* User Functions / Shortcuts */}
              <div className="shop-menu-section">
                <p className="shop-menu-section-title">TIỆN ÍCH NGƯỜI DÙNG</p>
                <div className="shop-menu-actions-grid">
                  <button
                    type="button"
                    className="shop-menu-action-item"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (user) navigateOrders();
                      else openAuth("orders");
                    }}
                  >
                    <Package size={17} />
                    <span>Đơn hàng của tôi</span>
                  </button>

                  <button
                    type="button"
                    className="shop-menu-action-item"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (user) setWishlistOpen(true);
                      else openAuth("wishlist");
                    }}
                  >
                    <Heart size={17} />
                    <span>Sản phẩm yêu thích</span>
                  </button>

                  <button
                    type="button"
                    className="shop-menu-action-item"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (user) setNotificationsOpen(true);
                      else openAuth("notifications");
                    }}
                  >
                    <Bell size={17} />
                    <span>Thông báo</span>
                    {user && notificationCount > 0 && (
                      <span className="shop-menu-badge">
                        {notificationCount > 99 ? "99+" : notificationCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    className="shop-menu-action-item"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (user) setAddressesOpen(true);
                      else openAuth("addresses");
                    }}
                  >
                    <MapPin size={17} />
                    <span>Sổ địa chỉ</span>
                  </button>

                  <button
                    type="button"
                    className="shop-menu-action-item"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (user) setSurveysOpen(true);
                      else openAuth("surveys");
                    }}
                  >
                    <ClipboardList size={17} />
                    <span>Khảo sát phong cách</span>
                  </button>

                  {user && (
                    <button
                      type="button"
                      className="shop-menu-action-item"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setPasswordOpen(true);
                      }}
                    >
                      <KeyRound size={17} />
                      <span>Bảo mật tài khoản</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Product Categories */}
              <div className="shop-menu-section">
                <p className="shop-menu-section-title">DANH MỤC SẢN PHẨM</p>
                <div className="shop-menu-nav-list">
                  <button
                    type="button"
                    className="shop-menu-nav-item"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openCatalog("");
                    }}
                  >
                    <span>HÀNG MỚI</span>
                    <ChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="shop-menu-nav-item"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openCatalog("Áo khoác");
                    }}
                  >
                    <span>ÁO KHOÁC</span>
                    <ChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="shop-menu-nav-item"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openCatalog("Áo thun");
                    }}
                  >
                    <span>ÁO THUN</span>
                    <ChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="shop-menu-nav-item"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openCatalog("Áo polo");
                    }}
                  >
                    <span>ÁO POLO</span>
                    <ChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="shop-menu-nav-item"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openCatalog("Quần");
                    }}
                  >
                    <span>QUẦN</span>
                    <ChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="shop-menu-nav-item sale"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openCatalog("", { minPrice: "", maxPrice: "500000" });
                    }}
                  >
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
                    onClick={() => setShopTheme((v) => (v === "dark" ? "light" : "dark"))}
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
                {user && (
                  <button
                    type="button"
                    className="shop-menu-logout-btn"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                  >
                    <LogOut size={16} />
                    <span>Đăng xuất tài khoản</span>
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {ordersRoute ? <CustomerLayout pathname={pathname} user={user} navigate={navigate}>
        {sessionChecking ? <CheckoutState title="Đang mở đơn hàng" message="Đang khôi phục phiên đăng nhập..." loading/> :
         sessionError ? <CheckoutState title="Chưa kết nối được tài khoản" message={sessionError} action="Thử lại" onAction={retrySession}/> :
         !user ? <CheckoutState title="Đăng nhập để xem đơn hàng" message="Đăng nhập để theo dõi trạng thái, thanh toán hoặc quản lý đơn đã đặt." action="Đăng nhập" onAction={() => openAuth()}/> :
         <OrdersPage key={user.id} route={ordersRoute} onNavigate={navigateOrders} onNotice={showNotice} onChanged={reloadNotifications}/>}
      </CustomerLayout> : checkoutPage ? (
        sessionChecking ? <CheckoutState title="Chuẩn bị đặt hàng" message="Đang khôi phục phiên đăng nhập..." loading/> :
        sessionError ? <CheckoutState title="Chưa kết nối được tài khoản" message={sessionError} action="Thử lại" onAction={retrySession}/> :
        !user ? <CheckoutState title="Đăng nhập để đặt hàng" message="Đăng nhập để sử dụng địa chỉ đã lưu và theo dõi đơn hàng." action="Đăng nhập" onAction={() => openAuth("checkout")}/> :
        cartError ? <CheckoutState title="Chưa tải được giỏ hàng" message={cartError} action="Thử lại giỏ hàng" onAction={loadCart}/> :
        cartLoading || cartOwner !== user.id ? <CheckoutState title="Chuẩn bị đặt hàng" message="Đang tải và đồng bộ giỏ hàng..." loading/> :
        <CheckoutPage key={user.id} cart={selection.cart} onShop={() => openCatalog("")} onCart={() => navigate('/gio-hang')} onOrders={() => navigateOrders()} VoucherWallet={CustomerVouchers}
          onPlaced={async (response, purchased) => {
            if (userRef.current?.id !== user.id) return;
            setCart(current => subtractPurchased(current, purchased)); reloadNotifications();
            try { const remaining = await api(endpoints.cart); if (userRef.current?.id === user.id) setCart(remaining); }
            catch { showNotice('Đơn đã tạo thành công. Chưa tải lại được giỏ hàng; vui lòng mở giỏ và thử lại.', 'error'); }
          }}/>
      ) : extraPage ? null : <main id="top">
        {sessionError && <div className="shop-connection" role="alert"><CircleAlert size={20} /><span>{sessionError}</span><button onClick={retrySession}>Thử lại</button></div>}
        {!catalogPage && <StorefrontHome products={products.content || []} onCatalog={openCatalog} onProduct={openProduct} imageSrc={imageSrc}/>}

        <CatalogSection
          catalogPage={catalogPage}
          products={products}
          categories={categories}
          filters={filters}
          setFilters={setFilters}
          chooseCategory={chooseCategory}
          filtersOpen={filtersOpen}
          setFiltersOpen={setFiltersOpen}
          loading={loading}
          catalogError={catalogError}
          setSearchInput={setSearchInput}
          wishlist={wishlist}
          openProduct={openProduct}
          addToCart={addToCart}
          toggleWishlist={toggleWishlist}
          loadProducts={loadProducts}
          openCatalog={openCatalog}
        />
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
            <b>GIAO HÀNG TOÀN QUỐC</b>
            <small>Đóng gói chỉn chu</small>
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
      {extraPage && !ordersRoute && <CustomerPageFrame account={accountPage} pathname={pathname} user={user} navigate={navigate}>
      {needsCustomer(pathname) && (sessionChecking || sessionError || !user) ? <CheckoutState title={sessionChecking ? 'Đang khôi phục tài khoản' : 'Đăng nhập để tiếp tục'} message={sessionError || 'Đang kiểm tra phiên đăng nhập...'} loading={sessionChecking} action={sessionError ? 'Thử lại' : undefined} onAction={retrySession}/> : <>
      {pathname === '/tai-khoan/voucher' && <CustomerVouchers/>}
      {!isKnownPath(pathname) && <CheckoutState title="Không tìm thấy trang" message="Đường dẫn không tồn tại." action="Về trang chủ" onAction={() => navigate('/')}/>}
      {pathname === '/thanh-toan' && <CheckoutState title="Kiểm tra thanh toán" message="Mở đơn hàng để kiểm tra trạng thái thanh toán được xác nhận từ cửa hàng." action="Xem đơn hàng" onAction={() => navigate('/don-hang')}/>}
      {productId && productError && <CheckoutState title="Chưa tải được sản phẩm" message={productError} action="Thử lại" onAction={() => setProductReload(value => value + 1)}/>}
      {productId && !selectedProduct && !productError && <CheckoutState title="Đang tải sản phẩm" loading/>}
      {productId && selectedProduct && (
          <ProductModal
            page
            key={productId}
            data={selectedProduct}
            user={user}
            onClose={() => navigate(safeReturn(window.history.state?.customerFrom, '/san-pham'))}
            onAdd={(variant, quantity) =>
              addToCart(selectedProduct.product, variant, quantity)
            }
            onBuyNow={(variant, quantity) => buyNow(selectedProduct.product, variant, quantity)}
            onLogin={() => openAuth()}
          />
      )}
      {cartOpen && (sessionChecking ? <CheckoutState title="Đang tải giỏ hàng" loading/> : sessionError || cartError ? <CheckoutState title="Chưa tải được giỏ hàng" message={sessionError || cartError} action="Thử lại" onAction={sessionError ? retrySession : loadCart}/> : cartLoading || user && cartOwner !== user.id ? <CheckoutState title="Đang đồng bộ giỏ hàng" loading/> :
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
      {wishlistOpen && (wishlistError ? <CheckoutState title="Chưa tải được yêu thích" message={wishlistError} action="Thử lại" onAction={loadWishlist}/> : wishlistLoading ? <CheckoutState title="Đang tải yêu thích" loading/> : <WishlistModal page items={wishlist} onClose={() => navigate('/tai-khoan')} onRemove={(item) => toggleWishlist(item)} onOpen={openProduct} />)}
      {addressesOpen && <AddressModal page onClose={() => navigate('/tai-khoan')} onNotice={showNotice} />}
      {notificationsOpen && <NotificationsModal page onClose={() => navigate('/tai-khoan')} onCount={setNotificationCount} />}
      {passwordOpen && <CustomerPassword initialMode={pathname === '/quen-mat-khau' ? 'forgot' : pathname === '/dat-lai-mat-khau' ? 'reset' : 'change'} onNavigate={navigate} onNotice={showNotice} />}
      </>}
      </CustomerPageFrame>}

      {/* Mobile Bottom Navigation Bar */}
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
  return account ? <CustomerLayout pathname={pathname} user={user} navigate={navigate}>{children}</CustomerLayout> : <main className="customer-standalone">{children}</main>;
}


export default App;
