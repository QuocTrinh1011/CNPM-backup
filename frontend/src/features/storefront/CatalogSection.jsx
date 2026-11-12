import React from "react";
import { ArrowUpRight, ChevronRight, CircleAlert, Search, SlidersHorizontal, X } from "lucide-react";
import { csv, money } from "../../shared/utils/storefront-display";
import { ProductCard } from "./ProductDetails";

export default function CatalogSection({ catalogPage, products, categories, filters, setFilters, chooseCategory, filtersOpen, setFiltersOpen, loading, catalogError, setSearchInput, wishlist, openProduct, addToCart, toggleWishlist, loadProducts, openCatalog }) {
  return (
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
  );
}
