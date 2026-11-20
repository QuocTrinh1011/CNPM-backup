export const GUEST_CART_KEY = "anh-lon-shop-guest-cart";

export const emptyCart = () => ({ items: [], subtotal: 0, itemCount: 0 });

export const readGuestCart = () => {
  if (typeof window === "undefined") return emptyCart();
  try {
    const value = JSON.parse(window.localStorage.getItem(GUEST_CART_KEY) || "null");
    return value?.items ? value : emptyCart();
  } catch {
    return emptyCart();
  }
};

export const saveGuestCart = (value) => {
  if (typeof window !== "undefined") window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(value));
};

export const clearGuestCart = () => {
  if (typeof window !== "undefined") window.localStorage.removeItem(GUEST_CART_KEY);
};
