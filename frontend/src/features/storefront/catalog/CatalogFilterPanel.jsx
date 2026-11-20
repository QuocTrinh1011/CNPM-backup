import React from "react";
import { X } from "lucide-react";
import { money } from "../../../shared/utils/storefront-display";

export default function CatalogFilterPanel({ filters, setFilters, setFiltersOpen }) {
  const setPriceRange = (minPrice, maxPrice) =>
    setFilters(current => ({ ...current, minPrice, maxPrice, page: 0 }));

  return (
    <div className="filter-panel" id="shop-price-filters" role="group" aria-label="Bộ lọc giá">
      <button className="shop-filter-close" type="button" onClick={() => setFiltersOpen(false)}>
        <X size={18} /> Đóng bộ lọc
      </button>
      <div className="price-quick-pills">
        <button type="button" className={`price-pill ${!filters.minPrice && !filters.maxPrice ? "active" : ""}`} onClick={() => setPriceRange("", "")}>
          Tất cả mức giá
        </button>
        <button type="button" className={`price-pill ${!filters.minPrice && filters.maxPrice === "300000" ? "active" : ""}`} onClick={() => setPriceRange("", "300000")}>
          Dưới 300.000₫
        </button>
        <button type="button" className={`price-pill ${filters.minPrice === "300000" && filters.maxPrice === "500000" ? "active" : ""}`} onClick={() => setPriceRange("300000", "500000")}>
          300.000₫ – 500.000₫
        </button>
        <button type="button" className={`price-pill ${filters.minPrice === "500000" && filters.maxPrice === "1000000" ? "active" : ""}`} onClick={() => setPriceRange("500000", "1000000")}>
          500.000₫ – 1.000.000₫
        </button>
        <button type="button" className={`price-pill ${filters.minPrice === "1000000" && !filters.maxPrice ? "active" : ""}`} onClick={() => setPriceRange("1000000", "")}>
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
          onChange={event => setFilters(current => ({ ...current, minPrice: event.target.value, page: 0 }))}
        />
      </label>
      <span aria-hidden="true">—</span>
      <label>
        ĐẾN
        <input
          type="number"
          aria-label="Giá cao nhất"
          min="0"
          value={filters.maxPrice}
          placeholder="Không giới hạn"
          onChange={event => setFilters(current => ({ ...current, maxPrice: event.target.value, page: 0 }))}
        />
      </label>
      <button type="button" aria-label="Xóa bộ lọc giá" onClick={() => setPriceRange("", "")}>
        XOÁ GIÁ
      </button>
      {(filters.minPrice || filters.maxPrice) && <span className="filter-range-summary">{filters.minPrice ? `Từ ${money(filters.minPrice)}` : "Không giới hạn"} – {filters.maxPrice ? money(filters.maxPrice) : "Không giới hạn"}</span>}
    </div>
  );
}
