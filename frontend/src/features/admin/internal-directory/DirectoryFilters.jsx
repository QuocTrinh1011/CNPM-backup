import React, { useState } from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';

const SORT_LABELS = {
  name: 'Tên',
  code: 'Mã nhà cung cấp',
  createdAt: 'Ngày tạo',
  price: 'Giá bán',
  stock: 'Tồn kho',
};

export function DirectoryFilters({ kind, filters, change, clear, suppliers = [] }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  if (kind === 'accounts') {
    return (
      <div className="internal-filters internal-directory-filters">
        <label>
          Tìm kiếm tài khoản
          <input
            type="search"
            value={filters.q}
            placeholder="Nhập tên, email hoặc số điện thoại..."
            onChange={(event) => change('q', event.target.value)}
          />
        </label>
        {filters.q && <button type="button" className="internal-filter-clear" onClick={clear}><RotateCcw size={14} /> Xóa tìm kiếm</button>}
      </div>
    );
  }

  const sortOptions = kind === 'products'
    ? ['name', 'createdAt', 'price', 'stock']
    : ['code', 'name', 'createdAt'];
  const filterKeys = kind === 'products'
    ? ['category', 'supplierId', 'minPrice', 'maxPrice', 'stock', 'active']
    : ['code', 'email', 'phone', 'address', 'active'];
  const activeFilterCount = filterKeys.filter((key) => filters[key] !== '').length;
  const defaultSort = kind === 'products' ? 'createdAt' : 'name';
  const hasFilters = activeFilterCount > 0 || Boolean(filters.q)
    || filters.sort !== defaultSort || filters.desc !== 'false';
  const keywordPlaceholder = kind === 'products'
    ? 'Tên hoặc mã sản phẩm...'
    : 'Tên, mã, email, điện thoại hoặc địa chỉ...';

  return (
    <section className="internal-filters internal-directory-filters" aria-label={`Tìm kiếm ${kind === 'products' ? 'sản phẩm' : 'nhà cung cấp'}`}>
      <div className="internal-directory-filter-toolbar">
        <label className="internal-directory-keyword">
          Tìm kiếm
          <input
            type="search"
            value={filters.q}
            placeholder={keywordPlaceholder}
            onChange={(event) => change('q', event.target.value)}
          />
        </label>
        <label>
          Sắp xếp theo
          <select value={filters.sort} onChange={(event) => change('sort', event.target.value)}>
            {sortOptions.map((key) => <option key={key} value={key}>{SORT_LABELS[key]}</option>)}
          </select>
        </label>
        <label>
          Thứ tự
          <select value={filters.desc} onChange={(event) => change('desc', event.target.value)}>
            <option value="false">Tăng dần</option>
            <option value="true">Giảm dần</option>
          </select>
        </label>
        <div className="internal-directory-filter-actions">
          <button
            type="button"
            className="internal-filter-advanced-toggle"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            <SlidersHorizontal size={15} />
            {advancedOpen ? 'Ẩn bộ lọc nâng cao' : 'Tìm kiếm nâng cao'}
            {activeFilterCount > 0 && <span className="internal-filter-count">{activeFilterCount}</span>}
          </button>
          {hasFilters && <button type="button" className="internal-filter-clear" onClick={clear}><RotateCcw size={14} /> Xóa bộ lọc</button>}
        </div>
      </div>

      {advancedOpen && (
        <div className="internal-directory-advanced" aria-label="Bộ lọc nâng cao">
          {kind === 'products' ? (
            <>
              <label>
                Loại sản phẩm
                <input
                  value={filters.category}
                  maxLength={120}
                  placeholder="Nhập tên loại sản phẩm"
                  onChange={(event) => change('category', event.target.value)}
                />
              </label>
              <label>
                Nhà cung cấp
                <select value={filters.supplierId} onChange={(event) => change('supplierId', event.target.value)}>
                  <option value="">Tất cả nhà cung cấp</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.code} · {supplier.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Giá từ
                <input type="number" min="0" step="1000" value={filters.minPrice} placeholder="0" onChange={(event) => change('minPrice', event.target.value)} />
              </label>
              <label>
                Giá đến
                <input type="number" min="0" step="1000" value={filters.maxPrice} placeholder="Không giới hạn" onChange={(event) => change('maxPrice', event.target.value)} />
              </label>
              <label>
                Tồn kho
                <select value={filters.stock} onChange={(event) => change('stock', event.target.value)}>
                  <option value="">Tất cả</option>
                  <option value="IN_STOCK">Còn hàng</option>
                  <option value="OUT">Hết hàng</option>
                </select>
              </label>
              <label>
                Trạng thái sản phẩm
                <select value={filters.active} onChange={(event) => change('active', event.target.value)}>
                  <option value="">Tất cả</option>
                  <option value="true">Đang kinh doanh</option>
                  <option value="false">Ngừng kinh doanh</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <label>
                Mã nhà cung cấp
                <input value={filters.code} maxLength={40} placeholder="VD: NCC-001" onChange={(event) => change('code', event.target.value)} />
              </label>
              <label>
                Email
                <input type="search" value={filters.email} maxLength={255} placeholder="Email liên hệ" onChange={(event) => change('email', event.target.value)} />
              </label>
              <label>
                Số điện thoại
                <input type="search" value={filters.phone} maxLength={30} placeholder="Số điện thoại liên hệ" onChange={(event) => change('phone', event.target.value)} />
              </label>
              <label>
                Địa chỉ
                <input type="search" value={filters.address} maxLength={1000} placeholder="Địa chỉ nhà cung cấp" onChange={(event) => change('address', event.target.value)} />
              </label>
              <label>
                Trạng thái
                <select value={filters.active} onChange={(event) => change('active', event.target.value)}>
                  <option value="">Tất cả</option>
                  <option value="true">Hoạt động</option>
                  <option value="false">Ngừng hoạt động</option>
                </select>
              </label>
            </>
          )}
        </div>
      )}
    </section>
  );
}
