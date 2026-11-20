import React from 'react';

export function DirectoryFilters({ kind, filters, change }) {
  return (
      <div className="internal-filters">
        <label>
          Tìm kiếm
          <input
            value={filters.q}
            placeholder="Nhập từ khóa cần tìm..."
            onChange={(e) => change('q', e.target.value)}
          />
        </label>

        {kind !== 'accounts' && (
          <>
            <label>
              Trạng thái
              <select value={filters.active} onChange={(e) => change('active', e.target.value)}>
                <option value="">Tất cả</option>
                <option value="true">Hoạt động</option>
                <option value="false">Ngừng hoạt động</option>
              </select>
            </label>
            <label>
              Sắp xếp
              <select value={filters.sort} onChange={(e) => change('sort', e.target.value)}>
                {(kind === 'products'
                  ? ['name', 'createdAt', 'price', 'stock']
                  : ['name', 'createdAt']
                ).map((k) => (
                  <option key={k} value={k}>
                    {{ name: 'Tên', createdAt: 'Ngày tạo', price: 'Giá', stock: 'Tồn kho' }[k]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Thứ tự
              <select value={filters.desc} onChange={(e) => change('desc', e.target.value)}>
                <option value="false">Tăng dần</option>
                <option value="true">Giảm dần</option>
              </select>
            </label>
          </>
        )}

        {kind === 'products' && (
          <>
            {Object.entries({
              category: 'Danh mục',
              minPrice: 'Giá từ',
              maxPrice: 'Giá đến',
            }).map(([k, label]) => (
              <label key={k}>
                {label}
                <input
                  type={k === 'category' ? 'text' : 'number'}
                  min="0"
                  onChange={(e) => change(k, e.target.value)}
                />
              </label>
            ))}
            <label>
              Tồn kho
              <select onChange={(e) => change('stock', e.target.value)}>
                <option value="">Tất cả</option>
                <option value="IN_STOCK">Còn hàng</option>
                <option value="OUT">Hết hàng</option>
              </select>
            </label>
          </>
        )}
      </div>
  );
}
