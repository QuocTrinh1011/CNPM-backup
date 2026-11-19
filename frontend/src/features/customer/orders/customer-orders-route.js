export const readOrdersRoute = () => {
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

export const ordersHref = ({ orderId = null, tab = "ALL", keyword = "", page = 0 } = {}) => {
  const params = new URLSearchParams();
  if (tab !== "ALL") params.set("tab", tab);
  if (keyword) params.set("keyword", keyword);
  if (page > 0) params.set("page", String(page));
  const query = params.toString();
  return `/don-hang${orderId ? `/${orderId}` : ""}${query ? `?${query}` : ""}`;
};
