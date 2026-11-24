import { useState, useEffect, useRef } from "react";
import { api, endpoints } from "../../../api/api";

const CATALOG_PAGE_SIZE = 30;
const CATALOG_FETCH_PAGE_SIZE = 48;
const isDiscountedProduct = product => {
  const price = Number(product?.price);
  const salePrice = Number(product?.salePrice);
  return Number.isFinite(price) && Number.isFinite(salePrice) && salePrice > 0 && salePrice < price;
};

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
      subCategory: isCatalog ? params.get("subCategory") || "" : "",
      minPrice: isCatalog ? params.get("minPrice") || "" : "",
      maxPrice: isCatalog ? params.get("maxPrice") || "" : "",
      onSale: isCatalog && params.get("onSale") === "true",
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
      let result;
      if (filters.onSale) {
        const firstPage = await api(endpoints.catalog({ ...filters, page: 0, size: CATALOG_FETCH_PAGE_SIZE }));
        const pages = [firstPage];
        const pageCount = Math.max(1, Number(firstPage.totalPages) || 1);
        for (let page = 1; page < pageCount; page += 1) {
          if (requestId !== catalogRequest.current) return;
          pages.push(await api(endpoints.catalog({ ...filters, page, size: CATALOG_FETCH_PAGE_SIZE })));
        }

        const discountedProducts = pages
          .flatMap(catalogResult => Array.isArray(catalogResult.content) ? catalogResult.content : [])
          .filter(isDiscountedProduct);
        const totalPages = Math.ceil(discountedProducts.length / CATALOG_PAGE_SIZE);
        const start = filters.page * CATALOG_PAGE_SIZE;
        const content = discountedProducts.slice(start, start + CATALOG_PAGE_SIZE);
        result = {
          ...firstPage,
          content,
          totalElements: discountedProducts.length,
          totalPages,
          number: filters.page,
          size: CATALOG_PAGE_SIZE,
          numberOfElements: content.length,
          first: filters.page === 0,
          last: filters.page >= totalPages - 1,
          empty: content.length === 0,
        };
      } else {
        result = await api(endpoints.catalog(filters));
      }
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
  }, [catalogPage, filters.keyword, filters.category, filters.subCategory, filters.minPrice, filters.maxPrice, filters.onSale, filters.sort, filters.page]);
  useEffect(() => {
    if (!catalogPage || window.location.pathname !== "/san-pham") return;
    const params = new URLSearchParams();
    if (filters.keyword) params.set("keyword", filters.keyword);
    if (filters.category) params.set("category", filters.category);
    if (filters.subCategory) params.set("subCategory", filters.subCategory);
    if (filters.minPrice) params.set("minPrice", filters.minPrice);
    if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
    if (filters.onSale) params.set("onSale", "true");
    if (filters.sort !== "newest") params.set("sort", filters.sort);
    if (filters.page > 0) params.set("page", String(filters.page));
    const query = params.toString();
    window.history.replaceState({}, "", `/san-pham${query ? `?${query}` : ""}`);
  }, [catalogPage, filters.keyword, filters.category, filters.subCategory, filters.minPrice, filters.maxPrice, filters.onSale, filters.sort, filters.page]);
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
