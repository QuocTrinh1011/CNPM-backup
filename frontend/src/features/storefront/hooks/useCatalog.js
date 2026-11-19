import { useState, useEffect, useRef } from "react";
import { api, endpoints } from "../../../api/api";
export default function useCatalog(showNotice) {
  const [products, setProducts] = useState({
    content: [],
    totalElements: 0,
    totalPages: 0,
    number: 0
  });
  const [catalogPage, setCatalogPage] = useState(() => typeof window !== "undefined" && window.location.pathname === "/san-pham");
  const [filters, setFilters] = useState(() => {
    const isCatalog = typeof window !== "undefined" && window.location.pathname === "/san-pham";
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    return {
      keyword: isCatalog ? params.get("keyword") || "" : "",
      category: isCatalog ? params.get("category") || "" : "",
      minPrice: isCatalog ? params.get("minPrice") || "" : "",
      maxPrice: isCatalog ? params.get("maxPrice") || "" : "",
      gender: "NAM",
      sort: isCatalog && ["newest", "price_asc", "price_desc"].includes(params.get("sort")) ? params.get("sort") : "newest",
      page: isCatalog ? Math.max(0, Number.parseInt(params.get("page") || "0", 10) || 0) : 0
    };
  });
  const [searchInput, setSearchInput] = useState(() => window.location.pathname === "/san-pham" ? new URLSearchParams(window.location.search).get("keyword") || "" : "");
  const [catalogError, setCatalogError] = useState("");
  const [loading, setLoading] = useState(true);
  const catalogRequest = useRef(0);
  const loadProducts = async () => {
    const requestId = ++catalogRequest.current;
    setLoading(true);
    try {
      setCatalogError("");
      const result = await api(endpoints.catalog(filters));
      if (requestId === catalogRequest.current) setProducts(result);
    } catch (error) {
      if (requestId !== catalogRequest.current) return;
      const message = error.message === "Failed to fetch" ? "Không kết nối được với máy chủ. Hãy khởi động backend rồi bấm thử lại." : error.message;
      setCatalogError(message);
      showNotice(message, "error");
    } finally {
      if (requestId === catalogRequest.current) setLoading(false);
    }
  };
  useEffect(() => {
    loadProducts();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Invalidate the pending catalog request when the tracked query changes.
      catalogRequest.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- The effect intentionally tracks only catalog query fields; loadProducts is recreated each render and would refetch on unrelated state updates.
  }, [catalogPage, filters.keyword, filters.category, filters.minPrice, filters.maxPrice, filters.sort, filters.page]);
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
  return {
    products,
    catalogPage,
    setCatalogPage,
    filters,
    setFilters,
    searchInput,
    setSearchInput,
    catalogError,
    loading,
    loadProducts
  };
}
