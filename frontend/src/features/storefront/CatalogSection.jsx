import React from "react";
import { ArrowUpRight, ChevronRight, X } from "lucide-react";
import { money } from "../../shared/utils/storefront-display";
import CatalogFilterPanel from "./catalog/CatalogFilterPanel";
import CatalogToolbar from "./catalog/CatalogToolbar";
import ProductGrid from "./catalog/ProductGrid";
import { pantsSubcategoryLabel } from "./catalog/pants-subcategories";

export default function CatalogSection({
  catalogPage,
  products,
  filters,
  setFilters,
  filtersOpen,
  setFiltersOpen,
  loading,
  catalogError,
  setSearchInput,
  wishlist,
  openProduct,
  openQuickView,
  toggleWishlist,
  loadProducts,
  openCatalog,
  goHome,
  onAddToCart,
  onBuyNow,
}) {
  const subCategoryLabel = pantsSubcategoryLabel(filters.subCategory);
  const catalogTitle = subCategoryLabel || filters.category || (filters.onSale ? "Sản phẩm ưu đãi" : "Tất cả sản phẩm");
  const activeFilters = [
    filters.keyword ? "“" + filters.keyword + "”" : null,
    filters.onSale ? "Sản phẩm đang ưu đãi" : null,
    subCategoryLabel || filters.category,
    filters.minPrice ? "từ " + money(filters.minPrice) : null,
    filters.maxPrice ? "đến " + money(filters.maxPrice) : null,
  ].filter(Boolean).join(" · ");

  return (
    <section
      className={"catalog-section " + (catalogPage ? "is-catalog-page" : "is-catalog-preview")}
      id="catalog"
    >
      <div className="catalog-head">
        <div>
          {catalogPage && (
            <nav className="catalog-breadcrumb" aria-label="Đường dẫn">
              <button type="button" onClick={goHome}>Trang chủ</button>
              <ChevronRight size={14} aria-hidden="true" />
              {filters.category ? (
                <>
                  <button type="button" onClick={() => openCatalog("")}>Sản phẩm</button>
                  <ChevronRight size={14} aria-hidden="true" />
                  <span aria-current="page">{subCategoryLabel || filters.category}</span>
                </>
              ) : (
                <span aria-current="page">Sản phẩm</span>
              )}
            </nav>
          )}
          <p className="kicker">{catalogPage ? "TỦ ĐỒ NAM" : "ĐƯỢC CHỌN CHO BẠN"}</p>
          <h2>{catalogPage ? catalogTitle : <>Những món đồ <i>đáng có.</i></>}</h2>
          {catalogPage && filters.keyword && (
            <p className="catalog-query">Kết quả tìm kiếm cho “{filters.keyword}”</p>
          )}
          <p className="catalog-count" role="status" aria-live="polite" aria-atomic="true">
            {products.totalElements || 0} sản phẩm được tuyển chọn
          </p>
        </div>
        {!catalogPage && (
          <button className="button button-light" onClick={() => openCatalog("")}>
            Xem tất cả <ArrowUpRight size={16} />
          </button>
        )}
      </div>

      <CatalogToolbar
        filters={filters}
        setFilters={setFilters}
        filtersOpen={filtersOpen}
        setFiltersOpen={setFiltersOpen}
      />
      {filtersOpen && (
        <CatalogFilterPanel
          filters={filters}
          setFilters={setFilters}
          setFiltersOpen={setFiltersOpen}
        />
      )}
      {activeFilters && (
        <div className="shop-active-filters">
          <span>Đang xem: {activeFilters}</span>
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setFilters(current => ({
                ...current,
                keyword: "",
                category: "",
                subCategory: "",
                minPrice: "",
                maxPrice: "",
                onSale: false,
                page: 0,
              }));
            }}
          >
            Xóa bộ lọc <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      <ProductGrid
        catalogPage={catalogPage}
        products={products}
        filters={filters}
        setFilters={setFilters}
        loading={loading}
        catalogError={catalogError}
        setSearchInput={setSearchInput}
        wishlist={wishlist}
        openProduct={openProduct}
        openQuickView={openQuickView}
        toggleWishlist={toggleWishlist}
        loadProducts={loadProducts}
        onAddToCart={onAddToCart}
        onBuyNow={onBuyNow}
      />
    </section>
  );
}
