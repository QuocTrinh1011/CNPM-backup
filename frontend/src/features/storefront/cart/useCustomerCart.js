import { useState, useRef } from "react";
import { api, endpoints } from "../../../api/api";
import { readGuestCart, saveGuestCart, clearGuestCart } from "./guest-cart-storage";
import { useCartSelection, transferGuestSelection } from "../cart-selection";
export default function useCustomerCart({
  user,
  sessionChecking,
  sessionError,
  cartOpen,
  showNotice
}) {
  const [cart, setCart] = useState(() => readGuestCart());
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState("");
  const [cartOwner, setCartOwner] = useState(null);
  const cartLoad = useRef(null);
  const userRef = useRef(user);
  userRef.current = user;
  const cartUpdateLocks = useRef(new Set());
  const [updatingCartKeys, setUpdatingCartKeys] = useState([]);
  const selection = useCartSelection({
    owner: user ? `customer-${user.id}` : 'guest',
    cart,
    ready: !sessionChecking && !sessionError && !cartLoading && !cartError && (!user || cartOwner === user.id),
    initialize: cartOpen
  });
  const loadCart = async () => {
    const customerId = user?.id;
    if (!customerId) return;
    if (cartLoad.current?.customerId === customerId) return cartLoad.current.promise;
    const task = {
      customerId
    };
    cartLoad.current = task;
    setCartLoading(true);
    setCartError("");
    const current = () => userRef.current?.id === customerId && cartLoad.current === task;
    task.promise = (async () => {
      try {
        const serverCart = await api(endpoints.cart);
        if (!current()) return;
        if (!Array.isArray(serverCart?.items)) throw new Error("Dữ liệu giỏ hàng không hợp lệ. Vui lòng thử lại.");
        const guest = readGuestCart();
        let next = serverCart;
        if (guest.items.length) {
          const merged = serverCart.items.map(item => ({
            ...item
          }));
          guest.items.forEach(item => {
            const found = merged.find(value => value.productId === item.productId && value.size === item.size && value.color === item.color);
            if (found) found.quantity += item.quantity;else merged.push({
              ...item
            });
          });
          next = await api(endpoints.cart, {
            method: "PUT",
            body: {
              items: merged.map(({
                productId,
                quantity,
                size,
                color
              }) => ({
                productId,
                quantity,
                size,
                color
              }))
            }
          });
          if (!Array.isArray(next?.items)) throw new Error("Chưa đồng bộ được giỏ hàng. Vui lòng thử lại.");
          if (current()) transferGuestSelection(customerId);
          if (JSON.stringify(readGuestCart()) === JSON.stringify(guest)) clearGuestCart();
        }
        if (current()) {
          setCart(next);
          setCartOwner(customerId);
        }
      } catch (error) {
        if (current()) setCartError(error.message || "Không tải được giỏ hàng. Vui lòng thử lại.");
      } finally {
        if (current()) {
          setCartLoading(false);
          cartLoad.current = null;
        }
      }
    })();
    return task.promise;
  };
  const localCart = (product, quantity = 1, variant = {}) => {
    const existing = cart.items.find(item => item.productId === product.id && item.size === variant.size && item.color === variant.color);
    const items = existing ? cart.items.map(item => item.productId === product.id && item.size === variant.size && item.color === variant.color ? {
      ...item,
      quantity: item.quantity + quantity,
      lineTotal: Number(item.unitPrice) * (item.quantity + quantity)
    } : item) : [...cart.items, {
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      unitPrice: product.salePrice || product.price,
      quantity,
      lineTotal: Number(product.salePrice || product.price) * quantity,
      stock: product.stock,
      size: variant.size,
      color: variant.color
    }];
    const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
    const nextCart = {
      items,
      subtotal,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0)
    };
    setCart(nextCart);
    saveGuestCart(nextCart);
    return nextCart;
  };
  const addToCart = async (product, variant = {}, quantity = 1) => {
    const requestedQuantity = Math.max(1, Number(quantity) || 1);
    const existing = cart.items.find(item => item.productId === product.id && item.size === variant.size && item.color === variant.color);
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
        body: {
          productId: product.id,
          quantity: requestedQuantity,
          ...variant
        }
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
    const sameLine = item => item.productId === line.productId && item.size === line.size && item.color === line.color;
    if (nextQuantity > line.stock) {
      showNotice(`Sản phẩm chỉ còn ${line.stock} sản phẩm trong kho.`, "error");
      return;
    }
    if (!user) {
      const items = cart.items.filter(item => !sameLine(item));
      const nextItems = nextQuantity < 1 ? items : cart.items.map(item => sameLine(item) ? {
        ...item,
        quantity: nextQuantity,
        lineTotal: Number(item.unitPrice) * nextQuantity
      } : item);
      const nextCart = {
        items: nextItems,
        subtotal: nextItems.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0),
        itemCount: nextItems.reduce((sum, item) => sum + item.quantity, 0)
      };
      setCart(nextCart);
      saveGuestCart(nextCart);
    } else {
      const updateKey = `${line.productId}|${line.size || ""}|${line.color || ""}`;
      if (cartUpdateLocks.current.has(updateKey)) return;
      cartUpdateLocks.current.add(updateKey);
      setUpdatingCartKeys(current => [...current, updateKey]);
      try {
        setCart(await api(endpoints.cart, {
          method: "PUT",
          body: {
            items: cart.items.map(item => ({
              productId: item.productId,
              quantity: sameLine(item) ? nextQuantity : item.quantity,
              size: item.size,
              color: item.color
            })).filter(item => item.quantity > 0)
          }
        }));
      } catch (error) {
        showNotice(error.message, "error");
      } finally {
        cartUpdateLocks.current.delete(updateKey);
        setUpdatingCartKeys(current => current.filter(key => key !== updateKey));
      }
    }
  };
  return {
    cart,
    setCart,
    cartLoading,
    setCartLoading,
    cartError,
    setCartError,
    cartOwner,
    setCartOwner,
    cartLoad,
    userRef,
    updatingCartKeys,
    loadCart,
    addToCart,
    updateCart,
    selection
  };
}
