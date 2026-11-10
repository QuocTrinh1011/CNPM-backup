import { showReturn, returnLabel, displayOrderLabel, deliveryLabel } from '../shared/utils/order-display';
import '../shared/styles/order-display.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStorefrontDialogs, useShopResource } from '../shared/hooks/storefront-hooks';
import AccountDropdown from '../features/customer/AccountDropdown';
import StorefrontHome from '../features/storefront/StorefrontHome';
import AddressModal from "../features/customer/CustomerAddresses";
import CheckoutPage, { CheckoutState } from "../features/storefront/CheckoutPage";
import PaymentQr from "../features/storefront/PaymentQr";
import CustomerLayout from '../features/customer/CustomerLayout';
import CustomerVouchers, { RewardSummary } from '../features/customer/CustomerVouchers';
import OrderReviews from '../features/customer/OrderReviews';
import RefundSummary from '../features/customer/RefundSummary';
import CustomerPassword from '../features/customer/CustomerPassword';
const SupportTickets=React.lazy(()=>import('../SupportTickets'));
import { useCartSelection, cartLineKey, canBuyLine, transferGuestSelection, subtractPurchased } from '../features/storefront/cart-selection';
import { useCustomerRouter, actionPaths, isAccountPath, needsCustomer, isKnownPath, safeReturn } from './routing/customer-routing';
import '../features/customer/styles/customer-pages.css';
export { default as AddressModal } from "../features/customer/CustomerAddresses";
import {
  api,
  currentApiBase,
  endpoints,
  refreshSession,
  signIn,
  signOut,
  signUp,
} from "../api/api";
import {
  ArrowLeft,
  ArrowUp, ArrowUpRight,
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
  Minus,
  Package,
  PackageOpen,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Sun,
  Moon,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  Trash2,
  Truck,
  KeyRound,
  UserRound,
  X,
} from "lucide-react";

const money = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
const date = (value) =>
  value
    ? new Date(value).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";
const csv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const surveyOptions = (value) => {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const discount = (product) =>
  product?.salePrice && product.salePrice < product.price
    ? Math.round((1 - product.salePrice / product.price) * 100)
    : 0;
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=85";
const imageSrc = (value) =>
  typeof value === "string" && value.trim() ? value : FALLBACK_IMAGE;
const protectImage = (event) => {
  event.currentTarget.onerror = null;
  event.currentTarget.src = FALLBACK_IMAGE;
};
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
const DEFAULT_ORDERS_ROUTE = { orderId: null, tab: "ALL", keyword: "", page: 0 };
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
  const loadWishlist = async () => {
    const request = ++wishlistRequest.current;
    if (!user) return;
    setWishlistLoading(true); setWishlistError('');
    try { const items = await api(endpoints.wishlist); if (request === wishlistRequest.current) setWishlist(items); }
    catch (error) { if (request === wishlistRequest.current) setWishlistError(error.message); }
    finally { if (request === wishlistRequest.current) setWishlistLoading(false); }
  };
  useEffect(() => { if (user) void loadWishlist(); return () => { wishlistRequest.current++; }; }, [user?.id, wishlistOpen]);
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
  }, []);

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
    return () => { catalogRequest.current++; };
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
  const focusSearch = () => {
    setMobileMenuOpen(false);
    if (checkoutPage || ordersRoute || extraPage) openCatalog("");
    window.setTimeout(() => {
      document.getElementById("catalog")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      searchRef.current?.focus();
    }, 0);
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
    return () => { productRequest.current++; };
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
            if (action === 'support') { navigate('/ho-tro'); return; }
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
        <CheckoutPage key={user.id} cart={selection.cart} onShop={() => openCatalog("")} onCart={() => navigate('/gio-hang')} onOrders={() => navigateOrders()}
          onPlaced={async (response, purchased) => {
            if (userRef.current?.id !== user.id) return;
            setCart(current => subtractPurchased(current, purchased)); reloadNotifications();
            try { const remaining = await api(endpoints.cart); if (userRef.current?.id === user.id) setCart(remaining); }
            catch { showNotice('Đơn đã tạo thành công. Chưa tải lại được giỏ hàng; vui lòng mở giỏ và thử lại.', 'error'); }
          }}/>
      ) : extraPage ? null : <main id="top">
        {sessionError && <div className="shop-connection" role="alert"><CircleAlert size={20} /><span>{sessionError}</span><button onClick={retrySession}>Thử lại</button></div>}
        {!catalogPage && <StorefrontHome products={products.content || []} onCatalog={openCatalog} onProduct={openProduct} imageSrc={imageSrc}/>}

        <section className="catalog-section" id="catalog">
          <div className="catalog-head">
            <div>
              <p className="kicker">{catalogPage ? 'TỦ ĐỒ NAM' : 'ĐƯỢC CHỌN CHO BẠN'}</p>
              <h2>
                Những món đồ <i>đáng có.</i>
              </h2>
              <p className="catalog-count" role="status" aria-live="polite" aria-atomic="true">
                {products.totalElements || 0} sản phẩm được tuyển chọn
              </p>
            </div>
            {!catalogPage && <button className="button button-light" onClick={() => openCatalog('')}>Xem tất cả <ArrowUpRight size={16}/></button>}
          </div>
          <div className="filter-bar">
            <div className="filter-pills">
              <button
                className={!filters.category ? "active" : ""}
                type="button"
                aria-pressed={!filters.category}
                onClick={() => chooseCategory("")}
              >
                TẤT CẢ
              </button>
              {categories.slice(0, 5).map((category) => (
                <button
                  className={filters.category === category ? "active" : ""}
                  type="button"
                  aria-pressed={filters.category === category}
                  key={category}
                  onClick={() => chooseCategory(category)}
                >
                  {category.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="filter-tools">
              <select
                aria-label="Sắp xếp sản phẩm"
                value={filters.sort}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    sort: event.target.value,
                    page: 0,
                  }))
                }
              >
                <option value="newest">MỚI NHẤT</option>
                <option value="price_asc">GIÁ TĂNG DẦN</option>
                <option value="price_desc">GIÁ GIẢM DẦN</option>
              </select>
              <button
                className="filter-toggle"
                type="button"
                aria-expanded={filtersOpen}
                aria-controls="shop-price-filters"
                aria-label={`${filtersOpen ? "Đóng" : "Mở"} bộ lọc giá`}
                onClick={() => setFiltersOpen((value) => !value)}
              >
                <SlidersHorizontal size={16} /> BỘ LỌC{" "}
                {(filters.minPrice || filters.maxPrice) && <span className="shop-filter-dot" aria-label="Có bộ lọc giá đang áp dụng" />}
                {filtersOpen ? <X size={15} /> : null}
              </button>
            </div>
          </div>
          {filtersOpen && (
            <div className="filter-panel" id="shop-price-filters">
              <button className="shop-filter-close" type="button" onClick={() => setFiltersOpen(false)}><X size={18} /> Đóng bộ lọc</button>
              <div className="price-quick-pills">
                <button
                  type="button"
                  className={`price-pill ${!filters.minPrice && !filters.maxPrice ? "active" : ""}`}
                  onClick={() => setFilters((current) => ({ ...current, minPrice: "", maxPrice: "", page: 0 }))}
                >
                  Tất cả mức giá
                </button>
                <button
                  type="button"
                  className={`price-pill ${!filters.minPrice && filters.maxPrice === "300000" ? "active" : ""}`}
                  onClick={() => setFilters((current) => ({ ...current, minPrice: "", maxPrice: "300000", page: 0 }))}
                >
                  Dưới 300.000₫
                </button>
                <button
                  type="button"
                  className={`price-pill ${filters.minPrice === "300000" && filters.maxPrice === "500000" ? "active" : ""}`}
                  onClick={() => setFilters((current) => ({ ...current, minPrice: "300000", maxPrice: "500000", page: 0 }))}
                >
                  300.000₫ – 500.000₫
                </button>
                <button
                  type="button"
                  className={`price-pill ${filters.minPrice === "500000" && filters.maxPrice === "1000000" ? "active" : ""}`}
                  onClick={() => setFilters((current) => ({ ...current, minPrice: "500000", maxPrice: "1000000", page: 0 }))}
                >
                  500.000₫ – 1.000.000₫
                </button>
                <button
                  type="button"
                  className={`price-pill ${filters.minPrice === "1000000" && !filters.maxPrice ? "active" : ""}`}
                  onClick={() => setFilters((current) => ({ ...current, minPrice: "1000000", maxPrice: "", page: 0 }))}
                >
                  Trên 1.000.000₫
                </button>
              </div>
              <label>
                GIÁ TỪ
                <input
                  type="number"
                  aria-label="Giá thấp nhất"
                  min="0"
                  value={filters.minPrice}
                  placeholder="0"
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      minPrice: event.target.value,
                      page: 0,
                    }))
                  }
                />
              </label>
              <span>—</span>
              <label>
                ĐẾN
                <input
                  type="number"
                  aria-label="Giá cao nhất"
                  min="0"
                  value={filters.maxPrice}
                  placeholder="Không giới hạn"
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      maxPrice: event.target.value,
                      page: 0,
                    }))
                  }
                />
              </label>
              <button
                aria-label="Xóa bộ lọc giá"
                type="button"
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    minPrice: "",
                    maxPrice: "",
                    page: 0,
                  }))
                }
              >
                XOÁ GIÁ
              </button>
            </div>
          )}
          {(filters.keyword || filters.category || filters.minPrice || filters.maxPrice) && <div className="shop-active-filters">
            <span>Đang xem: {[filters.keyword && `“${filters.keyword}”`, filters.category, filters.minPrice && `từ ${money(filters.minPrice)}`, filters.maxPrice && `đến ${money(filters.maxPrice)}`].filter(Boolean).join(" · ")}</span>
            <button type="button" onClick={() => { setSearchInput(""); setFilters(current => ({ ...current, keyword: "", category: "", minPrice: "", maxPrice: "", page: 0 })); }}>Xóa bộ lọc <X size={14}/></button>
          </div>}
          {loading ? (
            <div className="loading-grid">
              {[1, 2, 3, 4].map((item) => (
                <div className="skeleton" key={item} />
              ))}
            </div>
          ) : !catalogError ? (
            <div className="product-grid">
              {(catalogPage ? products.content : products.content?.slice(0, 4))?.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onOpen={() => openProduct(product)}
                  onAdd={() => addToCart(product, { size: csv(product.sizes)[0], color: csv(product.colors)[0] })}
                  isWishlisted={wishlist.some((item) => item.productId === product.id)}
                  onWishlist={() => toggleWishlist(product)}
                />
              ))}
            </div>
          ) : null}
          {!loading && catalogError ? (
            <div className="empty-state error-state">
              <CircleAlert size={34} />
              <h3>Chưa kết nối được cửa hàng</h3>
              <p>{catalogError}</p>
              <button className="button button-dark" onClick={loadProducts}>
                THỬ KẾT NỐI LẠI
              </button>
            </div>
          ) : (
            !loading &&
            !products.content?.length && (
              <div className="empty-state">
                <Search size={34} />
                <h3>Chưa tìm thấy sản phẩm</h3>
                <p>Thử xoá bớt bộ lọc hoặc tìm kiếm bằng từ khoá khác.</p>
                <button
                  className="button button-dark"
                  onClick={() => {
                    setSearchInput("");
                    setFilters({
                      keyword: "",
                      category: "",
                      minPrice: "",
                      maxPrice: "",
                      gender: "NAM",
                      sort: "newest",
                      page: 0,
                    });
                  }}
                >
                  XOÁ BỘ LỌC
                </button>
              </div>
            )
          )}
          {!loading && !catalogError && products.totalPages > 1 && (
            <div className="pagination">
              <button
                disabled={filters.page === 0}
                type="button"
                aria-label="Trang trước"
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    page: current.page - 1,
                  }))
                }
              >
                <ChevronRight size={17} className="rotate-180" aria-label="Trang trước" />
              </button>
              <span>
                TRANG {filters.page + 1} / {products.totalPages}
              </span>
              <button
                disabled={filters.page + 1 >= products.totalPages}
                type="button"
                aria-label="Trang sau"
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
              >
                <ChevronRight size={17} aria-label="Trang sau" />
              </button>
            </div>
          )}
        </section>
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
      {(pathname==='/ho-tro'||/^\/ho-tro\/\d+$/.test(pathname))&&<React.Suspense fallback={<p role="status">Đang tải hỗ trợ…</p>}><SupportTickets location={pathname+window.location.search} navigate={navigate}/></React.Suspense>}
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
            isWishlisted={wishlist.some(item => item.productId === selectedProduct.product.id)}
            onWishlist={() => toggleWishlist(selectedProduct.product)}
            onLogin={() => openAuth()}
            onNotice={showNotice}
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
      {wishlistOpen && (wishlistError ? <CheckoutState title="Chưa tải được yêu thích" message={wishlistError} action="Thử lại" onAction={loadWishlist}/> : wishlistLoading ? <CheckoutState title="Đang tải yêu thích" loading/> : <WishlistModal page items={wishlist} onClose={() => navigate('/tai-khoan')} onRemove={(item) => toggleWishlist(item)} onOpen={openProduct} onNotice={showNotice} />)}
      {addressesOpen && <AddressModal page onClose={() => navigate('/tai-khoan')} onNotice={showNotice} />}
      {notificationsOpen && <NotificationsModal page onClose={() => navigate('/tai-khoan')} onNotice={showNotice} onCount={setNotificationCount} onNavigate={navigate}/>}
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

function ProductCard({ product, onOpen, onAdd, isWishlisted, onWishlist }) {
  const sale = discount(product);
  return (
    <article className="product-card">
      <div className="product-image">
        <img
          src={imageSrc(product.imageUrl)}
          onError={protectImage}
          alt={product.name}
          loading="lazy"
        />
        <button type="button" className="product-image-open" aria-label={`Xem chi tiết ${product.name}`} onClick={onOpen} />
        <div className="product-labels">
          {product.badge && <span>{product.badge}</span>}
          {sale > 0 && <span className="sale-badge">-{sale}%</span>}
          {product.stock <= 0 && <span>HẾT HÀNG</span>}
        </div>
        <button
          className={isWishlisted ? "heart active" : "heart"}
          type="button"
          aria-label={isWishlisted ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"}
          onClick={onWishlist}
        >
          <Heart size={19} fill={isWishlisted ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="product-info">
        <div className="product-meta">
          <span>{product.category || "HÀNG NAM"}</span>
          {csv(product.colors).length > 1 && (
            <span className="product-colors-pill">
              {csv(product.colors).length} màu sắc
            </span>
          )}
          <span className={product.stock > 0 ? "" : "is-out-of-stock"}>{product.stock > 0 ? "CÒN HÀNG" : "HẾT HÀNG"}</span>
        </div>
        <h3><button type="button" onClick={onOpen}>{product.name}</button></h3>
        <div className="price-row">
          <strong>{money(product.salePrice || product.price)}</strong>
          {sale > 0 && <del>{money(product.price)}</del>}
        </div>
        <div className="product-card-actions">
          <button type="button" className="product-card-detail" aria-label={`Chi tiết ${product.name}`} onClick={onOpen}>Chi tiết <ArrowUpRight size={15}/></button>
          <button type="button" className="product-card-add" aria-label={`Thêm ${product.name} vào giỏ`} title={product.stock > 0 ? "Thêm vào giỏ" : "Hết hàng"} disabled={product.stock <= 0} onClick={onAdd}><Plus size={18}/></button>
        </div>
      </div>
    </article>
  );
}

const formatReviewDate = (val) => {
  if (!val) return "";
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "";
  }
};

function ProductModal({ page = false, data, user, onClose, onAdd, onBuyNow, isWishlisted, onWishlist, onLogin, onNotice }) {
  const product = data.product;
  const [size, setSize] = useState(
    csv(product.sizes)[1] || csv(product.sizes)[0] || "M",
  );
  const [color, setColor] = useState(csv(product.colors)[0] || "Đen");
  const [quantity, setQuantity] = useState(1);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [showAllFeedback, setShowAllFeedback] = useState(false);
  const purchaseLock = useRef(false);
  const [purchasing, setPurchasing] = useState(false);
  const purchase = async (buy = false) => {
    if (purchaseLock.current) return;
    purchaseLock.current = true; setPurchasing(true);
    try { await (buy && onBuyNow ? onBuyNow : onAdd)({ size, color }, quantity); if (!page) onClose(); }
    finally { purchaseLock.current = false; setPurchasing(false); }
  };
  const sale = discount(product);
  const submitFeedback = async (event) => {
    event.preventDefault();
    if (!user) return onLogin();
    window.history.pushState({},'', '/don-hang?tab=COMPLETED');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  const feedbackList = data.feedback || [];
  const feedbackCount = feedbackList.length;
  const avgRating = feedbackCount > 0
    ? (feedbackList.reduce((sum, f) => sum + (Number(f.rating) || 5), 0) / feedbackCount).toFixed(1)
    : null;
  const visibleFeedback = showAllFeedback ? feedbackList : feedbackList.slice(0, 3);
  return (
    <div
      className={page ? "customer-page-body" : "modal-backdrop"}
      onMouseDown={(event) => !page && event.target === event.currentTarget && onClose()}
    >
      <div className="product-modal">
        <button
          className="close-button"
          aria-label="Đóng chi tiết sản phẩm"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <div className="product-modal-image">
          <img
            src={imageSrc(product.imageUrl)}
            onError={protectImage}
            alt={product.name}
          />
          {product.badge && <span>{product.badge}</span>}
        </div>
        <div className="product-modal-content">
          {page && (
            <button
              type="button"
              className="back-link product-back-button"
              onClick={onClose}
              aria-label="Quay lại danh sách sản phẩm"
            >
              <ArrowLeft size={18} />
              <span>Quay lại</span>
            </button>
          )}
          <p className="kicker">
            {product.category || "HÀNG NAM"} / ANH LỚN SHOP
          </p>
          <h2>{product.name}</h2>
          <div className="modal-price">
            <strong>{money(product.salePrice || product.price)}</strong>
            {sale > 0 && (
              <>
                <del>{money(product.price)}</del>
                <em>Tiết kiệm {sale}%</em>
              </>
            )}
          </div>
          <p className="modal-description">
            {product.description ||
              "Thiết kế cân bằng giữa công năng và vẻ ngoài hiện đại, phù hợp cho tủ đồ hằng ngày."}
          </p>
          <div className="choice">
            <label>
              MÀU SẮC <b>{color}</b>
            </label>
            <div className="choice-row">
              {csv(product.colors).map((item) => (
                <button
                  className={
                    color === item ? "choice-chip active" : "choice-chip"
                  }
                  key={item}
                  onClick={() => setColor(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="choice">
            <label>
              KÍCH THƯỚC <b>{size}</b>
            </label>
            <div className="choice-row">
              {csv(product.sizes).map((item) => (
                <button
                  className={
                    size === item ? "choice-chip active" : "choice-chip"
                  }
                  key={item}
                  onClick={() => setSize(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="size-guide-link"
              onClick={() => setShowSizeGuide(true)}
            >
              Không chắc size? Xem bảng hướng dẫn kích thước <ChevronRight size={14} />
            </button>
          </div>
          <div className="product-quantity">
            <label>
              SỐ LƯỢNG <b>{quantity}</b>
            </label>
            <div className="quantity product-quantity-control">
              <button
                type="button"
                aria-label="Giảm số lượng sản phẩm"
                disabled={quantity <= 1}
                onClick={() =>
                  setQuantity((current) => Math.max(1, current - 1))
                }
              >
                <Minus size={17} />
              </button>
              <span>{quantity}</span>
              <button
                type="button"
                aria-label="Tăng số lượng sản phẩm"
                disabled={quantity >= product.stock}
                onClick={() =>
                  setQuantity((current) => Math.min(product.stock, current + 1))
                }
              >
                <Plus size={17} />
              </button>
            </div>
            <small>Còn {product.stock} sản phẩm trong kho</small>
          </div>
          <div className="product-modal-actions">
            <button
              className="button button-dark add-modal"
              disabled={!product.stock || purchasing}
              onClick={() => purchase()}
            >
              {product.stock
                ? `THÊM ${quantity} VÀO GIỎ`
                : "TẠM HẾT HÀNG"}
            </button>
            <button
              type="button"
              className="buy-now-btn"
              disabled={!product.stock || purchasing}
              onClick={() => purchase(true)}
            >
              MUA NGAY
            </button>
          </div>

          {showSizeGuide && (
            <div
              className="modal-backdrop"
              onClick={() => setShowSizeGuide(false)}
            >
              <div
                className="size-guide-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="size-guide-header">
                  <h3>Bảng Hướng Dẫn Kích Thước</h3>
                  <button
                    type="button"
                    className="close-button"
                    aria-label="Đóng bảng kích thước"
                    onClick={() => setShowSizeGuide(false)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="size-guide-table-wrap">
                  <table className="size-guide-table">
                    <thead>
                      <tr>
                        <th>Size</th>
                        <th>Chiều cao</th>
                        <th>Cân nặng</th>
                        <th>Vòng ngực</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><b>S</b></td>
                        <td>1m55 – 1m65</td>
                        <td>48 – 55 kg</td>
                        <td>86 – 90 cm</td>
                      </tr>
                      <tr>
                        <td><b>M</b></td>
                        <td>1m64 – 1m72</td>
                        <td>55 – 65 kg</td>
                        <td>90 – 94 cm</td>
                      </tr>
                      <tr>
                        <td><b>L</b></td>
                        <td>1m70 – 1m78</td>
                        <td>65 – 75 kg</td>
                        <td>94 – 98 cm</td>
                      </tr>
                      <tr>
                        <td><b>XL</b></td>
                        <td>1m75 – 1m85</td>
                        <td>75 – 85 kg</td>
                        <td>98 – 104 cm</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="size-guide-tip">
                  💡 <b>Gợi ý:</b> Nếu bạn ở giữa 2 size, hãy chọn size lớn hơn để có cảm giác mặc rộng rãi và thoải mái nhất.
                </p>
              </div>
            </div>
          )}
          <div className="product-details">
            <span>
              <ShieldCheck size={15} />{" "}
              {product.material || "Chất liệu chọn lọc"}
            </span>
            <span>
              <RefreshCw size={15} /> Đổi size trong 30 ngày
            </span>
            <span>
              <Truck size={15} /> Giao hàng toàn quốc
            </span>
          </div>
          <div className="feedback-section">
            <div className="feedback-heading">
              <div className="feedback-header-left">
                <h3>ĐÁNH GIÁ KHÁCH HÀNG</h3>
                <span className="feedback-count-badge">
                  {feedbackCount > 0 ? `(${feedbackCount})` : "Chưa có đánh giá"}
                </span>
              </div>
              {avgRating && (
                <div className="feedback-rating-summary">
                  <span className="feedback-avg-score">{avgRating}</span>
                  <div className="feedback-stars-summary" aria-label={`Đánh giá trung bình ${avgRating} trên 5`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={13}
                        className={i < Math.round(Number(avgRating)) ? "star-filled" : "star-empty"}
                      />
                    ))}
                  </div>
                  <span className="feedback-rating-scale">/ 5</span>
                </div>
              )}
            </div>

            {feedbackCount === 0 ? (
              <div className="feedback-empty-card">
                <div className="feedback-empty-icon">
                  <Star size={22} className="star-filled" />
                </div>
                <p className="feedback-empty-title">Chưa có đánh giá nào cho sản phẩm này</p>
                <span className="feedback-empty-subtitle">
                  Hãy là người đầu tiên trải nghiệm và chia sẻ cảm nhận!
                </span>
              </div>
            ) : (
              <div className="feedback-list">
                {visibleFeedback.map((item) => (
                  <div className="feedback-item" key={item.id}>
                    <div className="feedback-item-header">
                      <div className="feedback-avatar">
                        {(item.customerName || "K").trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="feedback-user-meta">
                        <div className="feedback-user-row">
                          <b className="feedback-author-name">{item.customerName || "Khách hàng"}</b>
                          <span className="feedback-verified-tag">
                            <Check size={11} strokeWidth={2.5} /> Đã mua hàng
                          </span>
                        </div>
                        <div className="feedback-rating-row">
                          <span className="feedback-item-stars" aria-label={`${item.rating} trên 5 sao`}>
                            {Array.from({ length: 5 }, (_, index) => (
                              <Star
                                key={index}
                                size={13}
                                className={index < item.rating ? "star-filled" : "star-empty"}
                              />
                            ))}
                          </span>
                          {item.createdAt && (
                            <span className="feedback-time">
                              {formatReviewDate(item.createdAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="feedback-comment">{item.comment || "Sản phẩm rất ổn."}</p>
                    {item.adminResponse && (
                      <section className="shop-feedback-reply" aria-label="Phản hồi của shop">
                        <div className="shop-reply-header">
                          <ShieldCheck size={13} className="shop-reply-badge-icon" />
                          <b>ANH LỚN SHOP trả lời</b>
                        </div>
                        <p className="shop-reply-text">{item.adminResponse}</p>
                      </section>
                    )}
                  </div>
                ))}
                {feedbackCount > 3 && (
                  <button
                    type="button"
                    className="feedback-toggle-btn"
                    onClick={() => setShowAllFeedback((prev) => !prev)}
                  >
                    {showAllFeedback
                      ? "Thu gọn đánh giá"
                      : `Xem thêm ${feedbackCount - 3} đánh giá khác`}
                  </button>
                )}
              </div>
            )}

            <form className="feedback-form" onSubmit={submitFeedback}>
              <div className="feedback-cta-card">
                <div className="feedback-cta-header">
                  <Star size={15} className="star-filled feedback-cta-icon" />
                  <small className="feedback-help">
                    Đánh giá từng sản phẩm trong đơn sau khi xác nhận đã nhận hàng.
                  </small>
                </div>
                <button type="submit" className="button feedback-submit-btn">
                  {!user ? "ĐĂNG NHẬP ĐỂ ĐÁNH GIÁ" : "ĐẾN ĐƠN HOÀN THÀNH ĐỂ ĐÁNH GIÁ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CartDrawer({ page = false, cart, onClose, onUpdate, updatingKeys = [], onCheckout, selection }) {
  const eligible = cart.items.filter(canBuyLine);
  const allSelected = eligible.length > 0 && eligible.every(item => selection?.selected.has(cartLineKey(item)));
  const selectAll = useRef(null);
  useEffect(() => { if (selectAll.current) selectAll.current.indeterminate = !allSelected && !!selection?.selected.size; }, [allSelected, selection?.selected.size]);

  return (
    <div
      className={page ? "customer-page-body customer-cart" : "drawer-backdrop"}
      onMouseDown={(event) => !page && event.target === event.currentTarget && onClose()}
    >
      <aside className="cart-drawer">
        <div className="drawer-head">
          <div>
            <p className="kicker">GIỎ HÀNG CỦA BẠN</p>
            <h2>{cart.itemCount || 0} sản phẩm</h2>
          </div>
          <button type="button" className="close-button" aria-label="Đóng giỏ hàng" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="cart-items">
          {selection && <label className="cart-select-all"><input ref={selectAll} type="checkbox" checked={allSelected} disabled={!eligible.length || !!updatingKeys.length} onChange={event => selection.all(event.target.checked)}/> Chọn tất cả ({eligible.length})</label>}
          {cart.items.length ? (
            cart.items.map((item) => (
              <div
                className={`cart-line${selection ? ' selectable' : ''}`}
                key={`${item.productId}-${item.size || ""}-${item.color || ""}`}
              >
                {selection && <input className="cart-line-checkbox" type="checkbox" aria-label={`Chọn ${item.name} ${item.color || ''} ${item.size || ''}`} checked={selection.selected.has(cartLineKey(item))} disabled={!canBuyLine(item) || !!updatingKeys.length} onChange={() => selection.toggle(item)}/>}
                <img
                  src={imageSrc(item.imageUrl)}
                  onError={protectImage}
                  alt={item.name}
                />
                <div className="cart-line-info">
                  <h3>{item.name}</h3>
                  <small>{money(item.unitPrice)}</small>
                  <small>{[item.color, item.size].filter(Boolean).join(' · ')}</small>
                  {!canBuyLine(item) && <small className="shop-field-error">{Number(item.stock) > 0 ? `Chỉ còn ${item.stock} sản phẩm. Vui lòng giảm số lượng.` : 'Sản phẩm đã hết hàng.'}</small>}
                  <div className="quantity">
                    <button
                      type="button"
                      aria-label={`Giảm số lượng ${item.name}`}
                      disabled={updatingKeys.includes(`${item.productId}|${item.size || ""}|${item.color || ""}`)}
                      onClick={() => onUpdate(item, item.quantity - 1)}
                    >
                      <Minus size={15} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      aria-label={`Tăng số lượng ${item.name}`}
                      disabled={
                        item.quantity >= item.stock ||
                        updatingKeys.includes(`${item.productId}|${item.size || ""}|${item.color || ""}`)
                      }
                      onClick={() => onUpdate(item, item.quantity + 1)}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
                <strong>{money(item.lineTotal)}</strong>
                <button
                  className="remove-line"
                  aria-label={`Xóa ${item.name} khỏi giỏ hàng`}
                  type="button"
                  disabled={updatingKeys.includes(`${item.productId}|${item.size || ""}|${item.color || ""}`)}
                  onClick={() => onUpdate(item, 0)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))
          ) : (
            <div className="drawer-empty">
              <PackageOpen size={38} />
              <h3>Giỏ hàng còn trống</h3>
              <p>Thêm một món đồ bạn thích để bắt đầu.</p>
            </div>
          )}
        </div>
        <div className="drawer-foot">
          <div className="subtotal">
            <span>TẠM TÍNH</span>
            <strong>{money(selection ? selection.cart.subtotal : cart.subtotal)}</strong>
          </div>
          <p>Kiểm tra sản phẩm và áp dụng mã giảm giá ở bước đặt hàng.</p>
          {selection && <p>Đã chọn {selection.cart.itemCount} sản phẩm ({selection.cart.items.length} phân loại).</p>}
          <button
            className="button button-dark"
            disabled={!(selection ? selection.cart.items.length : cart.items.length) || !!updatingKeys.length}
            onClick={onCheckout}
          >
            TIẾN HÀNH ĐẶT HÀNG <ArrowUpRight size={16} />
          </button>
          <button type="button" className="continue-shopping" onClick={onClose}>
            Tiếp tục mua sắm
          </button>
        </div>
      </aside>
    </div>
  );
}

function AuthModal({ page = false, mode, onModeChange, onClose, onAuthenticated, onNotice, onForgot }) {
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    age: "",
  });
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const submit = async (event) => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setAuthError("");
    setBusy(true);
    try {
      if (mode === "register") {
        await signUp({
          ...form,
          age: form.age === "" ? null : Number(form.age),
        });
        onNotice("Tạo tài khoản thành công.");
      }
      const data = await signIn({ email: form.email, password: form.password });
      if (alive.current) onAuthenticated(data.customer);
    } catch (error) {
      if (alive.current) setAuthError(error.message);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return (
    <div
      className={page ? "customer-page-body" : "modal-backdrop"}
      onMouseDown={(event) => !page && event.target === event.currentTarget && onClose()}
    >
      <div className="auth-modal">
        <button className="close-button" aria-label="Đóng đăng nhập" onClick={onClose}>
          <X size={20} />
        </button>
        <div className="auth-mark">
          AL<span>SHOP</span>
        </div>
        <p className="kicker">ANH LỚN SHOP</p>
        <h2>
          {mode === "login" ? "Chào mừng trở lại." : "Tạo tài khoản mới."}
        </h2>
        <p className="auth-subtitle">
          {mode === "login"
            ? "Đăng nhập để quản lý đơn hàng và lưu những món đồ yêu thích."
            : "Tham gia cộng đồng những người mặc đẹp theo cách riêng."}
        </p>
        <form onSubmit={submit}>
          {authError && <p className="auth-account-error" role="alert">{authError}</p>}
          {mode === "register" && (
            <>
              <label>
                HỌ VÀ TÊN
                <input
                  required
                  value={form.fullName}
                  onChange={(event) =>
                    setForm({ ...form, fullName: event.target.value })
                  }
                  placeholder="Nguyễn Minh Khang"
                />
              </label>
              <label>
                SỐ ĐIỆN THOẠI
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                  placeholder="09xx xxx xxx"
                />
              </label>
              <label>
                TUỔI <span className="optional-label">(không bắt buộc)</span>
                <input
                  type="number"
                  min="13"
                  max="120"
                  value={form.age}
                  onChange={(event) =>
                    setForm({ ...form, age: event.target.value })
                  }
                  placeholder="Ví dụ: 22"
                />
              </label>
            </>
          )}
          <label>
            EMAIL
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              placeholder="ban@email.com"
            />
          </label>
          <label>
            MẬT KHẨU
            <input
              type="password"
              required
              minLength="8"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              placeholder="Ít nhất 8 ký tự, gồm chữ và số"
            />
          </label>
          <button className="button button-dark" disabled={busy}>
            {busy
              ? "ĐANG XỬ LÝ..."
              : mode === "login"
                ? "ĐĂNG NHẬP →"
                : "TẠO TÀI KHOẢN →"}
          </button>
        </form>
        <div className="auth-switch">
          {mode === 'login' && <button type="button" onClick={onForgot}>Quên mật khẩu?</button>}
          {mode === "login" ? "Chưa có tài khoản?" : "Bạn đã có tài khoản?"}{" "}
          <button
            onClick={() =>
              onModeChange(mode === "login" ? "register" : "login")
            }
          >
            {mode === "login" ? "Đăng ký ngay" : "Đăng nhập"}
          </button>
        </div>
      </div>
    </div>
  );
}



const ORDER_TABS = [
  ["ALL", "Tất cả"], ["TO_PAY", "Chờ thanh toán"], ["TO_CONFIRM", "Chờ xác nhận"],
  ["TO_SHIP", "Đang xử lý"], ["TO_RECEIVE", "Đang giao"], ["TO_CONFIRM_RECEIPT", "Chờ nhận hàng"], ["COMPLETED", "Hoàn thành"],
  ["CANCELLED", "Đã hủy"], ["RETURN", "Đổi trả"],
];

export function OrdersPage({ route, onNavigate, onNotice, onChanged }) {
  const [reviewIntent, setReviewIntent] = useState(null);
  const [localRoute, setLocalRoute] = useState(route || DEFAULT_ORDERS_ROUTE);
  const activeRoute = route || localRoute;
  useEffect(() => {
    if (reviewIntent !== null && activeRoute.orderId !== reviewIntent) setReviewIntent(null);
  }, [activeRoute.orderId, reviewIntent]);
  const [searchInput, setSearchInput] = useState(activeRoute.keyword || "");
  const [orders, setOrders] = useState(null);
  const [detail, setDetail] = useState(null);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const move = next => { setReviewIntent(null); return onNavigate ? onNavigate(next) : setLocalRoute(next); };
  const load = useCallback(async (silent = false) => {
    const current = ++generation.current;
    if (!silent) { setError(""); if (activeRoute.orderId) setDetail(null); else { setOrders(null); setTotalElements(0); setTotalPages(0); } }
    try {
      if (activeRoute.orderId) {
        const result = await api(endpoints.order(activeRoute.orderId));
        if (current === generation.current) setDetail(result);
      } else {
        const result = await api(endpoints.orders({ page: activeRoute.page, size: 8, tab: activeRoute.tab, keyword: activeRoute.keyword }));
        if (current === generation.current) {
          setError('');
          setOrders(result.content || []);
          setTotalElements(result.totalElements || 0);
          setTotalPages(result.totalPages || 0);
        }
      }
    } catch (failure) {
      if (current === generation.current) setError(failure.message || "Không tải được đơn hàng.");
    }
  }, [activeRoute.orderId, activeRoute.page, activeRoute.tab, activeRoute.keyword]);
  useEffect(() => {
    void load();
    return () => { generation.current++; };
  }, [load]);
  useEffect(() => setSearchInput(activeRoute.keyword || ""), [activeRoute.keyword]);
  useEffect(() => {
    if (activeRoute.orderId || !orders?.some(order => order.paymentMethod === "PAYOS" && order.paymentStatus !== "PAID" && order.status !== "CANCELLED")) return;
    const timer = window.setInterval(() => { if (!document.hidden) void load(true); }, 15000);
    return () => window.clearInterval(timer);
  }, [activeRoute.orderId, orders, load]);
  const changeTab = tab => move({ ...activeRoute, orderId: null, tab, page: 0 });
  const submitSearch = event => { event.preventDefault(); move({ ...activeRoute, orderId: null, keyword: searchInput.trim().slice(0, 120), page: 0 }); };
  const openOrder = id => move({ ...activeRoute, orderId: id });
  const backToList = () => move({ ...activeRoute, orderId: null });
  const orderUpdated = async updated => {
    if (updated?.id === activeRoute.orderId) setDetail(updated);
    await load(true);
    onChanged?.();
  };
  const receiptConfirmed = updated => {
    if (updated?.status !== 'COMPLETED') return;
    ++generation.current;
    setError('');
    setDetail(updated);
    if (activeRoute.orderId !== updated.id) move({ ...activeRoute, orderId: updated.id });
    setReviewIntent(updated.id);
    Promise.resolve().then(() => onChanged?.()).catch(() => {});
  };

  return <section className="shop-orders-page" aria-labelledby="shop-orders-title">
    <div className="shop-orders-heading">
      <div><p className="kicker">TÀI KHOẢN / ĐƠN HÀNG</p><h1 id="shop-orders-title">Đơn hàng của tôi</h1><p>Theo dõi thanh toán, giao hàng và các yêu cầu đổi trả.</p></div>
      {activeRoute.orderId && <button type="button" className="button button-light" onClick={backToList}><ArrowLeft size={16}/> Quay lại danh sách</button>}
    </div>

    {!activeRoute.orderId ? <>
      <form className="shop-orders-search" role="search" onSubmit={submitSearch}>
        <Search size={18} aria-hidden="true"/><input type="search" maxLength={120} aria-label="Tìm đơn hàng" placeholder="Tìm theo mã đơn hoặc tên sản phẩm" value={searchInput} onChange={event => setSearchInput(event.target.value)}/>
        {searchInput && <button type="button" aria-label="Xóa nội dung tìm kiếm" onClick={() => { setSearchInput(""); move({ ...activeRoute, keyword: "", page: 0 }); }}><X size={17}/></button>}
        <button className="button button-dark" type="submit"><Search size={16}/> Tìm đơn</button>
      </form>
      <nav className="shop-order-tabs" aria-label="Lọc đơn hàng">
        {ORDER_TABS.map(([key, label]) => <button type="button" key={key} className={activeRoute.tab === key ? "active" : ""} aria-current={activeRoute.tab === key ? "page" : undefined} onClick={() => changeTab(key)}>{label}</button>)}
      </nav>
      <div className="shop-orders-result-count" role="status" aria-live="polite">{orders !== null && !error ? `${totalElements} đơn hàng` : ''}</div>
      {error ? <div className="shop-inline-error" role="alert"><p>{error}</p><button className="button button-light" onClick={() => load()}>Thử lại</button></div> : orders === null ? <div className="shop-orders-loading" role="status">Đang tải đơn hàng...</div> : orders.length ? <div className="shop-order-cards">
        {orders.map(order => <article className="shop-order-card" key={order.id}>
          <header><div><b>Mã đơn #{order.orderCode}</b><time dateTime={order.createdAt}>{date(order.createdAt)}</time></div><div className="shop-order-badges"><Status value={order.status} order={order}/>{order.paymentMethod === "PAYOS" ? <span className={order.paymentStatus === "PAID" ? "shop-payment-label is-paid" : "shop-payment-label"}>{order.paymentStatus === "PAID" ? "Đã thanh toán" : "Chưa thanh toán"}</span> : <span className="shop-payment-label">Thanh toán khi nhận hàng</span>}</div></header>
          <div className="shop-order-products">{(order.items || []).slice(0, 3).map((item, index) => <div className="shop-order-product" key={`${item.productId}-${item.size || ""}-${item.color || ""}-${index}`}><img src={imageSrc(item.imageUrl)} onError={protectImage} alt=""/><div><b>{item.name}</b><small>{[item.size, item.color].filter(Boolean).join(" · ") || "Phân loại tiêu chuẩn"} · SL: {item.quantity}</small></div><strong>{money(item.lineTotal)}</strong></div>)}{(order.items?.length || 0) > 3 && <p className="shop-order-more">Còn {order.items.length - 3} sản phẩm khác</p>}</div>
          <footer><span>{order.items?.length || 0} sản phẩm</span><div><span>Thành tiền</span><strong>{money(order.totalAmount)}</strong><ReceiptAction order={order} onChanged={receiptConfirmed} onNotice={onNotice}/>{order.status === 'COMPLETED' && <button type="button" className="button button-light review-card-btn" onClick={() => openOrder(order.id)}><Star size={14}/> Đánh giá</button>}<button type="button" className="button button-dark" onClick={() => openOrder(order.id)}>Chi tiết đơn <ChevronRight size={16}/></button></div></footer>
        </article>)}
      </div> : <div className="shop-orders-empty"><PackageOpen size={38}/><h2>{activeRoute.keyword ? "Không tìm thấy đơn phù hợp" : activeRoute.tab === "ALL" ? "Bạn chưa có đơn hàng" : "Chưa có đơn trong mục này"}</h2><p>{activeRoute.keyword ? "Thử mã đơn hoặc tên sản phẩm khác." : "Đơn hàng của bạn sẽ xuất hiện tại đây sau khi đặt hàng."}</p>{(activeRoute.keyword || activeRoute.tab !== "ALL") && <button className="button button-light" onClick={() => move({ ...DEFAULT_ORDERS_ROUTE })}>Xem tất cả đơn hàng</button>}</div>}
      {!error && totalPages > 1 && <nav className="shop-orders-pagination" aria-label="Phân trang đơn hàng"><button type="button" className="button button-light" disabled={activeRoute.page === 0 || orders === null} onClick={() => move({ ...activeRoute, page: activeRoute.page - 1 })}>Trang trước</button><span>Trang {activeRoute.page + 1} / {totalPages}</span><button type="button" className="button button-light" disabled={activeRoute.page + 1 >= totalPages || orders === null} onClick={() => move({ ...activeRoute, page: activeRoute.page + 1 })}>Trang sau</button></nav>}
    </> : error ? <div className="shop-inline-error" role="alert"><p>{error}</p><button className="button button-light" onClick={() => load()}>Thử lại</button></div> : detail ? <div className="shop-order-detail-page"><OrderView order={detail} onNotice={onNotice} onPaymentChanged={() => load(true)} onChanged={orderUpdated} onReceiptConfirmed={receiptConfirmed} autoReview={reviewIntent === detail.id} onReviewOpened={() => setReviewIntent(null)}/></div> : <div className="shop-orders-loading" role="status">Đang tải chi tiết đơn hàng...</div>}
  </section>;
}

// Kept as an export for existing callers/tests; the order history itself is no longer a dialog.
export function OrdersModal({ onNotice, onChanged }) {
  return <OrdersPage onNotice={onNotice} onChanged={onChanged}/>;
}
export function ReceiptAction({ order, onChanged, onNotice }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  const confirm = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const updated = await api(`/api/orders/${order.id}/confirm-receipt`, { method: 'PATCH' });
      if (updated?.status !== 'COMPLETED') throw new Error('Đơn chưa được xác nhận hoàn thành. Vui lòng thử lại.');
      setOpen(false); onNotice?.('Đã xác nhận nhận hàng thành công. Bạn có thể đánh giá sản phẩm ngay.'); await onChanged?.(updated);
    } catch (failure) { setError(failure.message || 'Không xác nhận được. Vui lòng thử lại.'); }
    finally { lock.current = false; setBusy(false); }
  };
  if (order.status !== 'DELIVERED' || (order.returnStatus || 'NONE') !== 'NONE') return null;
  return <><button type="button" className="button button-light" disabled={busy} onClick={() => { setError(''); setOpen(true); }}>Đã nhận hàng</button>
    {open && <div className="modal-backdrop"><section className="wide-modal shop-receipt-dialog" role="dialog" aria-modal="true" aria-label="Xác nhận đã nhận hàng">
      <button type="button" className="close-button" aria-label="Đóng xác nhận nhận hàng" disabled={busy} onClick={() => setOpen(false)}><X size={20}/></button>
      <h2>Xác nhận đã nhận hàng</h2><p>Bạn đã nhận đủ sản phẩm của đơn #{order.orderCode}? Đơn sẽ chuyển sang Hoàn thành.</p>
      {error && <p role="alert" className="shop-inline-error">{error}</p>}
      <div className="order-actions"><button type="button" className="button button-light" disabled={busy} onClick={() => setOpen(false)}>Quay lại</button><button type="button" className="button button-dark" disabled={busy} onClick={confirm}>{busy ? 'Đang xác nhận...' : 'Xác nhận đã nhận'}</button></div>
    </section></div>}
  </>;
}
export function OrderView({ order, onNotice, onChanged, onPaymentChanged, onReceiptConfirmed, autoReview, onReviewOpened }) {
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(order.paymentStatus === "PAID");
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const actionLock = useRef(false);
  const [hasOrderReview, setHasOrderReview] = useState(null);
  useEffect(() => setHasOrderReview(null), [order.id]);
  useEffect(() => setPaid(order.paymentStatus === "PAID"), [order.id, order.paymentStatus]);
  const cancellableStatuses = ["PENDING_PAYMENT", "PENDING", "CONFIRMED", "PREPARING"];
  const cancel = () => { setAction('cancel'); setReason(''); setActionError(''); };
  const requestReturn = () => { setAction('return'); setReason(''); setActionError(''); };
  const submitAction = async event => {
    event.preventDefault();
    if (actionLock.current) return;
    if (!reason.trim()) { setActionError('Vui lòng nhập lý do.'); return; }
    actionLock.current = true; setBusy(true); setActionError('');
    try {
      const updated = await api(action === 'cancel' ? endpoints.cancelOrder(order.id) : endpoints.returnOrder(order.id), { method: action === 'cancel' ? 'PATCH' : 'POST', body: { reason: reason.trim() } });
      if (action === 'cancel' && updated.status !== 'CANCELLED') { setPaid(updated.paymentStatus === 'PAID'); setActionError('Đơn đã được thanh toán nên chưa thể hủy. Vui lòng tải lại trạng thái đơn.'); onPaymentChanged?.(); return; }
      setAction(null); onNotice?.(action === 'cancel' ? 'Đã hủy đơn hàng.' : 'Đã gửi yêu cầu đổi/trả.'); await onChanged?.(updated);
    } catch (error) { setActionError(error.message); }
    finally { actionLock.current = false; setBusy(false); }
  };
  return (
    <div className="order-view">
      <a className="back-link" href={`/ho-tro?orderId=${order.id}&new=1`}>Yêu cầu hỗ trợ đơn hàng này</a>
      {order.status === 'COMPLETED' && <OrderReviews key={order.id} order={order} autoOpen={autoReview} onAutoOpened={onReviewOpened} onReviewStatus={setHasOrderReview}/>}
      {action && <form className="shop-reason-form" onSubmit={submitAction}><h3>{action === 'cancel' ? 'Hủy đơn hàng' : 'Yêu cầu đổi/trả'}</h3><label>Lý do<textarea autoFocus required maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label>{actionError && <p role="alert" className="shop-inline-error">{actionError}</p>}<div className="order-actions"><button type="button" className="button button-light" disabled={busy} onClick={() => setAction(null)}>Quay lại</button><button className="button button-dark" disabled={busy}>{busy ? 'Đang gửi...' : 'Xác nhận'}</button></div></form>}
      <div className="order-view-head">
        <div>
          <p className="kicker">MÃ ĐƠN #{order.orderCode}</p>
          <h3>{date(order.createdAt)}</h3>
        </div>
        <Status value={order.status} order={order} />
      </div>
      {showReturn(order) && <p className="order-address"><b>Trạng thái giao hàng:</b> {deliveryLabel(order, { DELIVERED: 'Đã giao', COMPLETED: 'Đã nhận hàng' })}</p>}
      <div className="order-progress">
        <span className="done">ĐẶT HÀNG</span>
        <i
          className={
            ["CONFIRMED", "SHIPPED", "DELIVERED", "COMPLETED"].includes(
              order.status,
            )
              ? "done"
              : ""
          }
        />
        <span
          className={
            ["SHIPPED", "DELIVERING", "DELIVERED", "COMPLETED"].includes(order.status)
              ? "done"
              : ""
          }
        >
          ĐANG GIAO
        </span>
        <i
          className={
            order.status === "COMPLETED" ? "done" : ""
          }
        />
        <span
          className={
            order.status === "COMPLETED" ? "done" : ""
          }
        >
          ĐÃ NHẬN
        </span>
      </div>
      {order.items?.map((item) => (
        <div className="order-item" key={`${item.productId}-${item.size || ""}-${item.color || ""}`}>
          <img
            src={imageSrc(item.imageUrl)}
            onError={protectImage}
            alt={item.name}
          />
          <div>
            <b>{item.name}</b>
            <small>Số lượng: {item.quantity} · {item.size || "Không chọn size"} · {item.color || "Không chọn màu"}</small>
          </div>
          <strong>{money(item.lineTotal)}</strong>
        </div>
      ))}
      {order.discountAmount > 0 && <div className="order-total"><span>GIẢM GIÁ {order.voucherCode ? `(${order.voucherCode})` : ""}</span><strong>-{money(order.discountAmount)}</strong></div>}
      <div className="order-total"><span>TỔNG ĐƠN HÀNG</span><strong>{money(order.totalAmount)}</strong></div>
      <RefundSummary refund={order.refund}/>
      <p className="shop-order-payment-method"><b>Phương thức thanh toán:</b> {order.paymentMethod === "PAYOS" ? "Quét mã QR PayOS" : "Thanh toán khi nhận hàng"}</p>
      {order.paymentMethod === "PAYOS" && <p className={paid ? "shop-payment-label is-paid" : "shop-payment-label"}>Trạng thái thanh toán: {paid ? "Đã thanh toán" : "Chưa thanh toán"}</p>}
      {order.paymentMethod === "PAYOS" && <PaymentQr orderId={order.id} onPaid={order.paymentStatus === "PAID" ? undefined : () => { setPaid(true); onNotice?.("Thanh toán thành công!"); onPaymentChanged?.(); }} />}
      {order.trackingCode && <p className="order-address"><b>Mã theo dõi</b><br />{order.trackingCode}</p>}
      {order.status === "CANCELLED" && <p className="order-address order-cancel-reason"><b>Lý do hủy đơn</b><br />{order.cancelReason?.trim() || "Chưa có lý do hủy"}</p>}
      {(order.returnStatus || "NONE") !== "NONE" && <p className="order-address"><b>Đổi/trả hàng: {returnLabel(order.returnStatus)}</b><br />{order.returnReason}</p>}
      {!!order.returnHistory?.length && <section className="order-address" aria-label="Lịch sử đổi trả"><b>Lịch sử xử lý đổi trả</b><ol className="return-history">{order.returnHistory.map((entry,index)=><li key={index}><b>{returnLabel(entry.status)}</b><small>{date(entry.createdAt)}</small><p>{entry.note || 'Không có ghi chú'}</p></li>)}</ol></section>}
      <p className="order-address">
        <b>Địa chỉ giao hàng</b>
        <br />
        {order.deliveryAddress}
      </p>
      {order.status === 'COMPLETED' && hasOrderReview === true && <p className="order-address">Đơn đã xác nhận nhận hàng và đã đánh giá sản phẩm nên không thể yêu cầu đổi trả.</p>}
      <div className="order-actions">{!busy && !action && <ReceiptAction order={order} onChanged={onReceiptConfirmed || onChanged} onNotice={onNotice}/>} {cancellableStatuses.includes(order.status) && <button type="button" className="button button-light" disabled={busy} onClick={cancel}>{busy ? "ĐANG HỦY..." : "HỦY ĐƠN"}</button>}{(order.status === 'DELIVERED' || (order.status === 'COMPLETED' && hasOrderReview === false)) && (order.returnStatus || "NONE") === "NONE" && <button type="button" className="button button-light" disabled={busy} onClick={requestReturn}>YÊU CẦU ĐỔI/TRẢ</button>}</div>
    </div>
  );
}
function WishlistModal({ page = false, items, onClose, onRemove, onOpen, onNotice }) {
  return <div className={page ? "customer-page-body" : "modal-backdrop"}><div className="wide-modal wishlist-modal"><button className="close-button" aria-label="Đóng yêu thích" onClick={onClose}><X size={20} /></button><p className="kicker">TÀI KHOẢN / YÊU THÍCH</p><h2>Món đồ bạn thích.</h2>{items.length ? <div className="wishlist-grid">{items.map((item) => <article className="wishlist-card" key={item.productId}><button className="wishlist-image" onClick={() => onOpen({ id: item.productId })}><img src={imageSrc(item.imageUrl)} onError={protectImage} alt={item.name} /></button><div className="wishlist-card-content"><b>{item.name}</b><small>{item.category || "HÀNG NAM"}</small><strong>{money(item.salePrice || item.price)}</strong></div><button className="wishlist-remove" onClick={() => onRemove({ id: item.productId })}>Bỏ thích</button></article>)}</div> : <div className="empty-state compact"><Heart size={34} /><h3>Chưa có món đồ yêu thích</h3><p>Chạm vào biểu tượng trái tim để lưu sản phẩm.</p></div>}</div></div>;
}



function NotificationsModal({ page = false, onClose, onNotice, onCount,onNavigate }) {
  const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const { data, error: listError, load } = useShopResource(endpoints.notifications);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { if (data) onCount(data.unreadCount || 0); }, [data, onCount]);
  const read = async item => {
    if (lock.current) return;
    if(item?.readAt){if(item.supportTicketId)onNavigate?.(`/ho-tro/${item.supportTicketId}`);return;}
    lock.current = true; setBusy(true); setError('');
    try { await api(item ? endpoints.notificationRead(item.id) : endpoints.notificationsReadAll, { method: 'PATCH' }); await load(); if(alive.current&&item?.supportTicketId)onNavigate?.(`/ho-tro/${item.supportTicketId}`); }
    catch (cause) { setError(cause.message); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div className={page ? 'customer-page-body' : 'modal-backdrop'}><section className="wide-modal notification-modal">
    {!page && <button className="close-button" aria-label="Đóng thông báo" onClick={onClose}><X size={20}/></button>}
    <div className="notification-head"><div><p className="kicker">TÀI KHOẢN / CẬP NHẬT</p><h2>Thông báo</h2></div><button className="back-link" disabled={busy || !data?.unreadCount} onClick={() => read()}>ĐÁNH DẤU ĐÃ ĐỌC</button></div>
    {error && <p role="alert" className="shop-inline-error">{error}</p>}
    {listError ? <div className="shop-inline-error" role="alert">{listError}<button className="button button-light" onClick={load}>Thử lại</button></div> : !data ? <p role="status">Đang tải thông báo...</p> : data.items.length ? <div className="notification-list">{data.items.map(item => <button disabled={busy} className={item.readAt ? 'notification-item read' : 'notification-item'} key={item.id} onClick={() => read(item)}><Bell size={18}/><span><b>{item.title}</b><small>{item.content}</small><em>{date(item.createdAt)}</em></span></button>)}</div> : <div className="empty-state compact"><Bell size={34}/><h3>Chưa có thông báo</h3><p>Các cập nhật về đơn hàng sẽ xuất hiện ở đây.</p></div>}
  </section></div>;
}


function Status({ value, order }) {
  const labels = {
    PENDING_PAYMENT: "Chờ thanh toán",
    PENDING: "Chờ xác nhận",
    CONFIRMED: "Đã xác nhận",
    PREPARING: "Đang chuẩn bị",
    SHIPPED: "Đang giao",
    DELIVERING: "Đang giao",
    DELIVERED: "Đã giao — chờ bạn xác nhận",
    COMPLETED: "Hoàn tất",
    CANCELLED: "Đã huỷ",
  };
  return (
    <span className={`status-pill ${showReturn(order) ? "return-requested" : String(value).toLowerCase()}`}>
      {order ? displayOrderLabel(order, labels) : labels[value] || value}
    </span>
  );
}

function ProfileModal({ page = false, user, onClose, onUser, onLogout, onOpenOrders, onOpenWishlist, onOpenNotifications, onOpenSurveys, onOpenAddresses, onOpenPassword, onNotice }) {
  const [form, setForm] = useState({
    fullName: user?.fullName || "",
    phone: user?.phone || "",
    age: user?.age ?? "",
    preferences: user?.preferences || "",
  });
  const [busy, setBusy] = useState(false);
  const saveLock = useRef(false);
  const save = async (event) => {
    event.preventDefault();
    if (saveLock.current) return;
    saveLock.current = true;
    setBusy(true);
    try {
      const updated = await api(endpoints.profile, {
        method: "PUT",
        body: { ...form, age: form.age === "" ? null : Number(form.age) },
      });
      onUser(updated);
      onNotice("Đã lưu thông tin cá nhân.");
      onClose();
    } catch (error) {
      onNotice(error.message, "error");
    } finally {
      saveLock.current = false;
      setBusy(false);
    }
  };
  return (
    <div className={page ? "customer-page-body" : "modal-backdrop"}>
      <div className="profile-modal">
        <button className="close-button" aria-label="Đóng hồ sơ" onClick={onClose}>
          <X size={20} />
        </button>
        <div className="profile-cover">
          <span>{user?.fullName?.slice(0, 1) || "H"}</span>
        </div>
        <p className="kicker">TÀI KHOẢN CỦA BẠN</p>
        <h2>{user?.fullName}</h2>
        <p className="profile-email">{user?.email}</p>
        <form onSubmit={save}>
          <label>
            HỌ VÀ TÊN
            <input
              required
              value={form.fullName}
              onChange={(event) =>
                setForm({ ...form, fullName: event.target.value })
              }
            />
          </label>
          <label>
            SỐ ĐIỆN THOẠI
            <input
              value={form.phone}
              onChange={(event) =>
                setForm({ ...form, phone: event.target.value })
              }
            />
          </label>
          <label>
            TUỔI <span className="optional-label">(không bắt buộc)</span>
            <input
              type="number"
              min="13"
              max="120"
              value={form.age}
              onChange={(event) =>
                setForm({ ...form, age: event.target.value })
              }
              placeholder="Ví dụ: 22"
            />
          </label>
          <label>
            PHONG CÁCH ƯA THÍCH
            <textarea
              value={form.preferences}
              onChange={(event) =>
                setForm({ ...form, preferences: event.target.value })
              }
              placeholder="Ví dụ: tối giản, màu trung tính, form relaxed..."
            />
          </label>
          <button className="button button-dark" disabled={busy}>
            {busy ? "ĐANG LƯU..." : "LƯU THAY ĐỔI"}
          </button>
        </form>
        <button className="profile-survey-link account-menu-primary" onClick={onOpenOrders}>
          <span>Đơn hàng của tôi</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
        <button className="profile-survey-link" onClick={onOpenWishlist}>
          <span>Sản phẩm yêu thích</span>
          <Heart size={16} aria-hidden="true" />
        </button>
        <button className="profile-survey-link" onClick={onOpenNotifications}>
          <span>Thông báo</span>
          <Bell size={16} aria-hidden="true" />
        </button>
        <button className="profile-survey-link" onClick={onOpenSurveys}>
          <span>Khảo sát phong cách</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
        <button className="profile-survey-link" onClick={onOpenAddresses}>
          <span>Quản lý địa chỉ giao hàng</span>
          <MapPin size={16} aria-hidden="true" />
        </button>
        <button className="profile-survey-link" onClick={onOpenPassword}>
          <span>Đổi hoặc quên mật khẩu</span>
          <KeyRound size={16} aria-hidden="true" />
        </button>
        <button className="logout-link" onClick={onLogout}>
          Đăng xuất khỏi tài khoản
        </button>
      </div>
    </div>
  );
}

function SurveyModal({ page = false, surveyId, onNavigate, user, onClose, onLogin, onNotice }) {
  const { data: surveys, error: listError, load } = useShopResource(user ? endpoints.mySurveys : endpoints.surveys);
  const [survey, setSurvey] = useState(null);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const completed = survey?.completed || surveys?.find?.(item => String(item.id) === String(surveyId))?.completed;
  useEffect(() => {
    if (!page) return;
    let alive = true;
    setSurvey(null); setAnswers({}); setDetailError('');
    if (!surveyId) { setDetailLoading(false); return; }
    setDetailLoading(true);
    api(endpoints.survey(surveyId)).then(value => { if (alive) setSurvey(value); }).catch(error => { if (alive) setDetailError(error.message); }).finally(() => { if (alive) setDetailLoading(false); });
    return () => { alive = false; };
  }, [surveyId, retry, page]);
  const submit = async (event) => {
    event.preventDefault();
    if (!user) return onLogin();
    if (busy) return;
    if (survey.questions.some(question => question.required && (!answers[question.id] || Array.isArray(answers[question.id]) && !answers[question.id].length))) return onNotice('Vui lòng trả lời các câu hỏi bắt buộc.', 'error');
    setBusy(true);
    try {
      const result = await api(endpoints.surveyResponses(survey.id), {
        method: "POST",
        body: {
          answers: Object.entries(answers).filter(([questionId]) => survey.questions.some(q => q.id === Number(questionId))).map(([questionId, value]) => ({
            questionId: Number(questionId),
            value: Array.isArray(value) ? JSON.stringify(value) : value,
          })),
        },
      });
      onNotice(result.voucher ? `Bạn đã nhận voucher ${result.voucher.code}!` : "Cảm ơn bạn đã chia sẻ gu thời trang!");
      if(result.voucher) onNavigate('/tai-khoan/voucher'); else onClose();
    } catch (error) {
      onNotice(error.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={page ? "customer-page-body" : "modal-backdrop"}>
      <div className="survey-modal">
        <button className="close-button" aria-label="Đóng khảo sát" onClick={onClose}>
          <X size={20} />
        </button>
        {detailLoading ? <p role="status">Đang tải khảo sát...</p> : detailError ? <div role="alert">{detailError}<button onClick={() => setRetry(value => value + 1)}>Thử lại</button></div> : !survey ? (
          <>
            <p className="kicker">ANH LỚN SHOP / KHẢO SÁT</p>
            <h2>
              Chọn đúng gu,
              <br />
              <i>mặc đúng mình.</i>
            </h2>
            <p>
              Chia sẻ một chút về phong cách của bạn để những gợi ý lần sau trở
              nên riêng tư hơn.
            </p>
            {listError ? <div className="shop-inline-error" role="alert">{listError}<button className="button button-light" onClick={load}>Thử lại</button></div> : surveys === null ? (
              <div className="modal-loading">Đang tải khảo sát...</div>
            ) : surveys.length ? (
              <div className="survey-list">
                {surveys.map((item) => (
                  <button
                    key={item.id}
                    disabled={item.completed}
                    className={item.completed ? "completed" : ""}
                    onClick={() => { if (page) onNavigate(`/khao-sat/${item.id}`); else { setAnswers({}); setSurvey(item); } }}
                  >
                    <span><ArrowUpRight size={18} aria-hidden="true" /></span>
                    <div>
                      <b>{item.title}</b>
                      <small>{item.description}</small>
                      <RewardSummary reward={item.reward}/>
                    </div>
                    <em>{item.completed ? "ĐÃ HOÀN THÀNH" : "BẮT ĐẦU"}</em>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state compact">
                <h3>Chưa có khảo sát mới</h3>
              </div>
            )}
          </>
        ) : (
          <>
            <button className="back-link" onClick={() => page ? onNavigate('/khao-sat') : setSurvey(null)}>
              <ArrowLeft size={15} /> Các khảo sát
            </button>
            <p className="kicker">KHẢO SÁT / {survey.title}</p>
            <h2>{survey.title}</h2>
            <p>{survey.description}</p>
            <RewardSummary reward={survey.reward}/>
            <form className="survey-form" onSubmit={submit}>
              {completed && (
                <div className="survey-completed-note">
                  Bạn đã hoàn thành khảo sát này. Cảm ơn bạn đã chia sẻ cùng Anh Lớn Shop.
                </div>
              )}
              {survey.questions?.map((question) => (
                <fieldset className="survey-question" key={question.id} disabled={busy || completed}>
                  <legend>{question.text} {question.required ? "*" : "(không bắt buộc)"}</legend>
                  {["SINGLE", "SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(question.type) ? surveyOptions(question.optionsJson).map(option => {
                    const multiple = question.type === "MULTIPLE_CHOICE";
                    const selected = Array.isArray(answers[question.id]) ? answers[question.id] : [];
                    return <label className="survey-choice" key={option}>
                      <input type={multiple ? "checkbox" : "radio"} name={`question-${question.id}`} required={!multiple && question.required} checked={multiple ? selected.includes(option) : answers[question.id] === option} onChange={e => setAnswers(current => ({ ...current, [question.id]: multiple ? (e.target.checked ? [...selected, option] : selected.filter(v => v !== option)) : option }))} />
                      <span>{option}</span>
                    </label>;
                  }) : <textarea aria-label={question.text} required={question.required} maxLength={4000} value={answers[question.id] || ""} onChange={e => setAnswers(current => ({ ...current, [question.id]: e.target.value }))} placeholder="Câu trả lời của bạn..." />}
                </fieldset>
              ))}
              <button className="button button-dark" disabled={busy || completed}>
                {busy ? "ĐANG GỬI..." : <>GỬI CÂU TRẢ LỜI <ArrowUpRight size={16} /></>}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
export default App;
