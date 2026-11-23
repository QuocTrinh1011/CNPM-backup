import React from "react";
import { SlidersHorizontal, X } from "lucide-react";

export default function CatalogToolbar({ filters, setFilters, filtersOpen, setFiltersOpen }) {
  return (
    <div className="filter-bar" role="group" aria-label="Sắp xếp và lọc sản phẩm">
      <div className="filter-tools">
        <select
          aria-label="Sắp xếp sản phẩm"
          value={filters.sort}
          onChange={event => setFilters(current => ({ ...current, sort: event.target.value, page: 0 }))}
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
          onClick={() => setFiltersOpen(value => !value)}
        >
          <SlidersHorizontal size={16} /> BỘ LỌC{" "}
          {(filters.minPrice || filters.maxPrice) && <span className="shop-filter-dot" aria-label="Có bộ lọc giá đang áp dụng" />}
          {filtersOpen ? <X size={15} /> : null}
        </button>
      </div>
    </div>
  );
}
