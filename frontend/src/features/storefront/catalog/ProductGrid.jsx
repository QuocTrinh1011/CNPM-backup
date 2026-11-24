import React from "react";
import { ChevronRight, CircleAlert, Search } from "lucide-react";
import { ProductCard } from "../ProductDetails";

export default function ProductGrid({ catalogPage, products, filters, setFilters, loading, catalogError, setSearchInput, wishlist, openProduct, openQuickView, toggleWishlist, loadProducts, onAddToCart, onBuyNow }) {
  return <>
    {loading ? (
      <div className="loading-grid" role="status" aria-label="Đang tải sản phẩm">
        {[1, 2, 3, 4].map(item => <div className="skeleton" key={item} />)}
      </div>
    ) : !catalogError ? (
      <div className="product-grid">
        {(catalogPage ? products.content : products.content?.slice(0, 4))?.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            onOpen={() => openProduct(product)}
            onQuickView={() => openQuickView(product)}
            isWishlisted={wishlist.some(item => item.productId === product.id)}
            onWishlist={() => toggleWishlist(product)}
            onAddToCart={onAddToCart}
            onBuyNow={onBuyNow}
          />
        ))}
      </div>
    ) : null}

    {!loading && catalogError ? (
      <div className="empty-state error-state">
        <CircleAlert size={34} />
        <h3>Chưa kết nối được cửa hàng</h3>
        <p>{catalogError}</p>
        <button className="button button-dark" onClick={loadProducts}>THỬ KẾT NỐI LẠI</button>
      </div>
    ) : (
      !loading && !products.content?.length && (
        <div className="empty-state">
          <Search size={34} />
          <h3>Chưa tìm thấy sản phẩm</h3>
          <p>Thử xoá bớt bộ lọc hoặc tìm kiếm bằng từ khoá khác.</p>
          <button
            className="button button-dark"
            onClick={() => {
              setSearchInput("");
              setFilters({ keyword: "", category: "", subCategory: "", minPrice: "", maxPrice: "", onSale: false, gender: "NAM", sort: "newest", page: 0 });
            }}
          >
            XOÁ BỘ LỌC
          </button>
        </div>
      )
    )}

    {!loading && !catalogError && products.totalPages > 1 && (
      <nav className="pagination" aria-label="Phân trang sản phẩm">
        <button
          disabled={filters.page === 0}
          type="button"
          aria-label="Trang trước"
          onClick={() => setFilters(current => ({ ...current, page: current.page - 1 }))}
        >
          <ChevronRight size={17} className="rotate-180" aria-hidden="true" />
        </button>
        <span aria-live="polite">TRANG {filters.page + 1} / {products.totalPages}</span>
        <button
          disabled={filters.page + 1 >= products.totalPages}
          type="button"
          aria-label="Trang sau"
          onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))}
        >
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </nav>
    )}
  </>;
}
