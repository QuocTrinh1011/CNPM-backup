import React, { useCallback, useRef, useState } from "react";
import { Package, Plus, RefreshCw, Search, X } from "lucide-react";
import { useManagerFilters } from "../../shared/hooks/useManagerFilters";
import { useManagerList as useAdminList, useManagerList, useManagerReadPause } from "../../shared/hooks/useManagerResource";
import { adminApi, adminEndpoints } from "../../api/manager-api";
import { money, pageData } from "./manager-data";
import { ListError, PageControls, PanelLoading, PanelTitle, Table, ToolbarButton } from "./ManagerComponents";

const emptyProductForm = () => ({
  name: "",
  category: "",
  price: "",
  stock: 0,
  description: "",
  imageUrl: "",
  colors: "",
  colorImages: {},
});

const productColors = (value) => [...new Set(
  String(value || "").split(",").map((color) => color.trim()).filter(Boolean)
)];

const colorGalleryFor = (colors, existing = {}) => Object.fromEntries(
  productColors(colors).map((color) => {
    const images = Array.isArray(existing[color]) ? [...existing[color]] : [];
    return [color, images.length ? images : [""]];
  })
);

const galleryPayloadFor = (colors, gallery = {}) => Object.fromEntries(
  productColors(colors).flatMap((color) => {
    const images = (Array.isArray(gallery[color]) ? gallery[color] : [])
      .map((url) => String(url || "").trim())
      .filter(Boolean);
    return images.length ? [[color, images]] : [];
  })
);

export default function Products({ notify, readOnly = false }) {
  const [filters,changeFilters]=useManagerFilters({q:'',category:'',minPrice:'',maxPrice:'',stock:'ALL',active:'true',sort:'createdAt',direction:'DESC',page:'0'});
  const endpoint=useCallback(()=>adminEndpoints.products(filters),[filters]);
  const { data:previousData, load, loading, error,stale } = useAdminList(endpoint,{keepPreviousData:true});
  const data=stale?null:previousData;
  const search=filters.q,setSearch=value=>changeFilters({q:value});
  const selectedCategory=filters.category,setSelectedCategory=value=>changeFilters({category:value});
  const {data:categoryData}=useManagerList(useCallback(()=>'/api/manager/products/categories',[]));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const productWriteLock = useRef(false);
  const [editing, setEditing] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = [
    filters.minPrice,
    filters.maxPrice,
    filters.stock !== 'ALL',
    filters.active === 'false',
    filters.sort !== 'createdAt',
    filters.direction !== 'DESC',
  ].filter(Boolean).length;
  useManagerReadPause(dialogOpen || !!confirmArchive);
  const [form, setForm] = useState(emptyProductForm);
  const colorsInForm = productColors(form.colors);

  const changeColors = (colors) => setForm((current) => ({
    ...current,
    colors,
    colorImages: colorGalleryFor(colors, current.colorImages),
  }));

  const changeColorImage = (color, index, value) => setForm((current) => {
    const images = [...(current.colorImages[color] || [])];
    images[index] = value;
    return { ...current, colorImages: { ...current.colorImages, [color]: images } };
  });

  const addColorImage = (color) => setForm((current) => ({
    ...current,
    colorImages: {
      ...current.colorImages,
      [color]: [...(current.colorImages[color] || []), ""],
    },
  }));

  const removeColorImage = (color, index) => setForm((current) => ({
    ...current,
    colorImages: {
      ...current.colorImages,
      [color]: (current.colorImages[color] || []).filter((_, imageIndex) => imageIndex !== index),
    },
  }));

  const openAdd = () => {
    setEditing(null);
    setForm(emptyProductForm());
    setDialogOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product.id);
    setForm({
      name: product.name,
      category: product.category || "",
      price: product.price,
      stock: product.stock,
      description: product.description || "",
      imageUrl: product.imageUrl || "",
      colors: product.colors || "",
      colorImages: colorGalleryFor(product.colors, product.colorImages || {}),
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditing(null);
  };

  const save = async (event) => {
    event.preventDefault();
    if(productWriteLock.current)return;
    productWriteLock.current=true;
    setSaving(true);
    try {
      await adminApi(
        editing ? adminEndpoints.product(editing) : "/api/manager/products",
        {
          method: editing ? "PUT" : "POST",
          body: {
            ...form,
            colors: productColors(form.colors).join(","),
            colorImages: galleryPayloadFor(form.colors, form.colorImages),
            price: Number(form.price),
            stock: Number(form.stock),
          },
        }
      );
      setForm(emptyProductForm());
      setEditing(null);
      setDialogOpen(false);
      notify(editing ? "Đã cập nhật sản phẩm." : "Đã thêm sản phẩm mới.");
      load();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      productWriteLock.current=false;
      setSaving(false);
    }
  };

  const archive = async (id) => {
    if(productWriteLock.current)return;
    productWriteLock.current=true;setSaving(true);
    try {
      await adminApi(adminEndpoints.product(id), { method: "DELETE" });
      notify("Đã ẩn sản phẩm.");
      setConfirmArchive(null);
      load();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      productWriteLock.current=false;setSaving(false);
    }
  };

  const products = pageData(data);
  const categories = Array.isArray(categoryData)?categoryData:[];
  const filteredProducts = products;

  if (loading && !previousData) return <PanelLoading />;
  if (error)
    return (
      <div className="admin-panel">
        <ListError message={error} onRetry={load} />
      </div>
    );
  return (
    <div className="admin-panel">
      <PanelTitle title="Danh mục sản phẩm" subtitle="Quản lý catalog và tồn kho." />

      {categories.length > 0 && (
        <div className="admin-category-pills" role="tablist" aria-label="Lọc theo danh mục">
          <button
            type="button"
            className={`admin-category-pill ${!selectedCategory ? "active" : ""}`}
            onClick={() => setSelectedCategory("")}
          >
            Tất cả danh mục
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`admin-category-pill ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat === selectedCategory ? "" : cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="admin-table-toolbar">
        <div className="admin-search-wrap">
          <Search size={15} className="admin-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="admin-search-input"
            placeholder="Tìm theo tên hoặc danh mục..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="admin-search-clear"
              onClick={() => setSearch("")}
            >
              <X size={13} />
            </button>
          )}
        </div>
        <div className="admin-toolbar-actions">
          <ToolbarButton
            active={filtersOpen}
            count={activeFilterCount}
            onClick={() => setFiltersOpen((value) => !value)}
            aria-controls="manager-product-filters"
          >
            Bộ lọc
          </ToolbarButton>
          <span className="admin-toolbar-count">
            {data?.totalElements ?? filteredProducts.length} sản phẩm
          </span>
          {!readOnly && <button
            type="button"
            className="admin-primary admin-btn-with-icon"
            onClick={openAdd}
          >
            <Plus size={16} /> Thêm sản phẩm
          </button>}
        </div>
      </div>

      <div className={`manager-advanced-filters${filtersOpen ? " is-open" : ""}`} id="manager-product-filters">
        <label>Giá từ<input type="number" min="0" value={filters.minPrice} onChange={e=>changeFilters({minPrice:e.target.value})}/></label>
        <label>Giá đến<input type="number" min="0" value={filters.maxPrice} onChange={e=>changeFilters({maxPrice:e.target.value})}/></label>
        <label>Tồn kho<select value={filters.stock} onChange={e=>changeFilters({stock:e.target.value})}><option value="ALL">Tất cả</option><option value="AVAILABLE">Còn hàng</option><option value="OUT">Hết hàng</option></select></label>
        <label>Hiển thị<select value={filters.active} onChange={e=>changeFilters({active:e.target.value})}><option value="true">Đang bán</option><option value="false">Đã ẩn</option><option value="ALL">Tất cả</option></select></label>
        <label>Sắp xếp<select value={filters.sort} onChange={e=>changeFilters({sort:e.target.value})}><option value="createdAt">Ngày tạo</option><option value="name">Tên</option><option value="price">Giá</option><option value="stock">Tồn kho</option></select></label>
        <label>Thứ tự<select value={filters.direction} onChange={e=>changeFilters({direction:e.target.value})}><option value="DESC">Giảm dần</option><option value="ASC">Tăng dần</option></select></label>
      </div>
      <Table className="manager-product-table" headers={readOnly ? ["Sản phẩm", "Danh mục", "Giá", "Tồn kho"] : ["Sản phẩm", "Danh mục", "Giá", "Tồn kho", ""]}>
        {filteredProducts.map((product) => (
          <tr key={product.id}>
            <td>
              <div className="admin-product-cell">
                {product.imageUrl ? (
                  <img
                    className="admin-product-thumb"
                    src={product.imageUrl}
                    alt={product.name}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <div className="admin-product-thumb-placeholder">
                    <Package size={16} />
                  </div>
                )}
                <div>
                  <b>{product.name}</b>
                  {product.description && (
                    <small className="admin-product-desc-snippet">
                      {product.description.slice(0, 45)}
                      {product.description.length > 45 ? "..." : ""}
                    </small>
                  )}
                </div>
              </div>
            </td>
            <td>
              <span className="admin-category-tag">{product.category || "—"}</span>
            </td>
            <td>
              <b>{money(product.salePrice || product.price)}</b>
            </td>
            <td>
              <span
                className={`admin-stock-badge ${
                  product.stock <= 0
                    ? "out-of-stock"
                    : product.stock < 5
                    ? "low-stock"
                    : "in-stock"
                }`}
              >
                <i className="admin-stock-dot" />
                {product.stock <= 0 ? "Hết hàng" : product.stock < 5 ? `Sắp hết (${product.stock})` : `Còn (${product.stock})`}
              </span>
            </td>
            {!readOnly && (
              <td>
                <div className="admin-table-row-actions">
                  <button
                    type="button"
                    className="admin-action"
                    onClick={() => openEdit(product)}
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="admin-action danger-text"
                    onClick={() => setConfirmArchive(product)}
                  >
                    Ẩn
                  </button>
                </div>
              </td>
            )}
          </tr>
        ))}
      </Table>

      <PageControls page={Number(filters.page)||0} totalPages={data?.totalPages||0} totalElements={data?.totalElements} onPage={page=>changeFilters({page:String(page)})}/>
      {/* Dialogue Thêm / Chỉnh sửa sản phẩm */}
      {dialogOpen && (
        <div
          className="admin-dialog-backdrop"
          onClick={closeDialog}
        >
          <div
            className="admin-dialog admin-product-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-dialog-header">
              <div className="admin-dialog-header-title">
                <Package size={20} className="admin-dialog-icon" />
                <h2 id="product-dialog-title">
                  {editing ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}
                </h2>
              </div>
              <button
                type="button"
                className="admin-dialog-close"
                aria-label="Đóng"
                disabled={saving}
                onClick={closeDialog}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={save} className="admin-dialog-form">
              <div className="admin-form-grid">
                <div className="admin-form-group span-2">
                  <label htmlFor="prod-name">TÊN SẢN PHẨM *</label>
                  <input
                    id="prod-name"
                    required
                    placeholder="Ví dụ: Áo polo dệt kim Merino"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="prod-category">DANH MỤC *</label>
                  <input
                    id="prod-category"
                    required
                    list="category-suggestions"
                    placeholder="Ví dụ: Áo polo, Áo thun..."
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                  <datalist id="category-suggestions">
                    <option value="Áo thun" />
                    <option value="Áo khoác" />
                    <option value="Áo polo" />
                    <option value="Quần" />
                    <option value="Phụ kiện" />
                  </datalist>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="prod-price">GIÁ BÁN (VNĐ) *</label>
                  <input
                    id="prod-price"
                    required
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="Ví dụ: 350000"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="prod-stock">TỒN KHO *</label>
                  <input
                    id="prod-stock"
                    required
                    type="number"
                    min="0"
                    placeholder="Ví dụ: 50"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="prod-image">URL HÌNH ẢNH</label>
                  <input
                    id="prod-image"
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  />
                </div>

                {form.imageUrl && (
                  <div className="admin-form-group span-2 admin-image-preview-group">
                    <span className="admin-preview-label">Xem trước ảnh:</span>
                    <div className="admin-image-preview">
                      <img
                        src={form.imageUrl}
                        alt="Preview"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                        onLoad={(e) => { e.currentTarget.style.display = "block"; }}
                      />
                    </div>
                  </div>
                )}

                <div className="admin-form-group span-2">
                  <label htmlFor="prod-colors">MÀU SẮC (phân cách bằng dấu phẩy)</label>
                  <input
                    id="prod-colors"
                    type="text"
                    placeholder="Ví dụ: Đen, Trắng, Xanh denim"
                    value={form.colors}
                    onChange={(event) => changeColors(event.target.value)}
                  />
                  <small>Mỗi màu là một tùy chọn riêng cho khách hàng.</small>
                </div>

                {colorsInForm.map((color, colorIndex) => {
                  const images = form.colorImages[color] || [];
                  return (
                    <section className="admin-form-group span-2 admin-color-gallery" key={color} aria-labelledby={`prod-color-title-${colorIndex}`}>
                      <div className="admin-color-gallery-heading">
                        <h3 id={`prod-color-title-${colorIndex}`}>{color}</h3>
                        {images.length < 6 && (
                          <button
                            type="button"
                            className="admin-action"
                            onClick={() => addColorImage(color)}
                          >
                            Thêm ảnh cho màu {color}
                          </button>
                        )}
                      </div>
                      {images.length === 0 && <small>Chưa có ảnh cho màu này.</small>}
                      {images.map((url, imageIndex) => (
                        <div className="admin-color-gallery-item" key={`${color}-${imageIndex}`}>
                          <label htmlFor={`prod-color-image-${colorIndex}-${imageIndex}`}>
                            URL ảnh {color} {imageIndex + 1}
                          </label>
                          <input
                            id={`prod-color-image-${colorIndex}-${imageIndex}`}
                            type="text"
                            inputMode="url"
                            pattern="https://[^ ]+|/(?!/).*"
                            placeholder="https://... hoặc /uploads/..."
                            title="Nhập URL HTTPS hoặc đường dẫn cùng máy chủ bắt đầu bằng /"
                            value={url}
                            onChange={(event) => changeColorImage(color, imageIndex, event.target.value)}
                          />
                          <button
                            type="button"
                            className="admin-action danger-text"
                            aria-label={`Xóa ảnh ${color} ${imageIndex + 1}`}
                            onClick={() => removeColorImage(color, imageIndex)}
                          >
                            Xóa
                          </button>
                          {url && (
                            <img
                              className="admin-color-gallery-preview"
                              src={url}
                              alt={`Ảnh xem trước màu ${color} ${imageIndex + 1}`}
                              onError={(event) => { event.currentTarget.style.display = "none"; }}
                              onLoad={(event) => { event.currentTarget.style.display = "block"; }}
                            />
                          )}
                        </div>
                      ))}
                    </section>
                  );
                })}

                <div className="admin-form-group span-2">
                  <label htmlFor="prod-desc">MÔ TẢ CHI TIẾT</label>
                  <textarea
                    id="prod-desc"
                    rows={3}
                    placeholder="Chất liệu, kiểu dáng, hướng dẫn bảo quản..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="admin-dialog-actions">
                <button
                  type="button"
                  className="admin-dialog-cancel"
                  disabled={saving}
                  onClick={closeDialog}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="admin-primary admin-btn-with-icon"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={15} className="admin-spin" /> Đang lưu...
                    </>
                  ) : editing ? (
                    "Cập nhật sản phẩm"
                  ) : (
                    "Tạo sản phẩm mới"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation dialog when archiving product */}
      {confirmArchive && (
        <div
          className="admin-dialog-backdrop"
          onClick={() => setConfirmArchive(null)}
        >
          <div
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Xác nhận ẩn sản phẩm</h2>
            <p>
              Bạn có chắc chắn muốn ẩn sản phẩm <b>{confirmArchive.name}</b> khỏi storefront không?
            </p>
            <div className="admin-dialog-actions">
              <button
                type="button"
                className="admin-dialog-cancel"
                disabled={saving}
                onClick={() => setConfirmArchive(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="admin-danger-button"
                disabled={saving}
                onClick={() => archive(confirmArchive.id)}
              >
                Xác nhận ẩn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
