import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, PackageCheck, Truck, X, Search } from 'lucide-react';
import { adminApi } from '../../api/manager-api';
import { useManagerList } from '../../shared/hooks/useManagerResource';
import { managerQuery } from '../../shared/hooks/useManagerFilters';
import './stock-receiving.css';

const money = value =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
const localDateTime = value => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const today = () => localDateTime(new Date());
const newLine = () => ({ productId: '', quantity: '1', unitCost: '' });
const dateLabel = value =>
  value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';

export default function StockReceiving() {
  const [supplierId, setSupplierId] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [supplierError, setSupplierError] = useState('');
  const [supplierForm, setSupplierForm] = useState(null);
  const [supplierBusy, setSupplierBusy] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [productError, setProductError] = useState('');
  const [receivedAt, setReceivedAt] = useState(today);
  const [note, setNote] = useState('');
  const [lines, setLines] = useState([newLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [detailId, setDetailId] = useState(null);

  const loadSuppliers = useCallback(async () => {
    try {
      const result = await adminApi(
        '/api/manager/suppliers?active=true&page=0&size=100&sort=name&desc=false',
      );
      setSuppliers(result.content || []);
      setSupplierError('');
    } catch (failure) {
      setSupplierError(failure.message);
    }
  }, []);
  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const query = managerQuery({
        q: productSearch.trim(),
        page: 0,
        size: 100,
        sort: 'name',
        desc: 'false',
        active: 'true',
      });
      adminApi(`/api/manager/products?${query}`, { signal: controller.signal })
        .then(result => {
          setProducts(result.content || []);
          setProductError('');
        })
        .catch(failure => {
          if (failure.name !== 'AbortError') setProductError(failure.message);
        });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [productSearch]);

  const historyEndpoint = useCallback(
    () => `/api/manager/stock-receipts?page=0&size=20&revision=${revision}`,
    [revision],
  );
  const {
    data: history,
    loading: historyLoading,
    error: historyError,
    load: reloadHistory,
  } = useManagerList(historyEndpoint);
  const reportEndpoint = useCallback(
    () => `/api/manager/reports/inventory-expenses?year=${encodeURIComponent(year)}`,
    [year, revision],
  );
  const {
    data: report,
    loading: reportLoading,
    error: reportError,
    load: reloadReport,
  } = useManagerList(reportEndpoint);
  const detailEndpoint = useCallback(() => `/api/manager/stock-receipts/${detailId}`, [detailId]);
  const {
    data: detail,
    loading: detailLoading,
    error: detailError,
  } = useManagerList(detailEndpoint, { enabled: detailId !== null });

  const totalCost = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const quantity = Number(line.quantity) || 0;
        const unitCost = Number(line.unitCost) || 0;
        return sum + quantity * unitCost;
      }, 0),
    [lines],
  );

  const updateLine = (index, patch) =>
    setLines(current =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    );
  const addLine = () => setLines(current => [...current, newLine()]);
  const removeLine = index =>
    setLines(current => current.filter((_, lineIndex) => lineIndex !== index));

  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    setError('');
    setNotice('');
    const chosen = lines.map(line => Number(line.productId));
    if (!supplierId) {
      setError('Hãy chọn nhà cung cấp.');
      return;
    }
    if (lines.length === 0) {
      setError('Thêm ít nhất một sản phẩm vào phiếu nhập.');
      return;
    }
    if (
      lines.some(
        line =>
          !line.productId ||
          Number(line.quantity) < 1 ||
          line.unitCost === '' ||
          Number(line.unitCost) < 0,
      )
    ) {
      setError('Chọn sản phẩm, nhập số lượng dương và đơn giá nhập cho từng dòng.');
      return;
    }
    if (new Set(chosen).size !== chosen.length) {
      setError('Mỗi sản phẩm chỉ nhập một dòng trong một phiếu.');
      return;
    }
    setSaving(true);
    try {
      const result = await adminApi('/api/manager/stock-receipts', {
        method: 'POST',
        body: {
          supplierId: Number(supplierId),
          receivedAt: new Date(receivedAt).toISOString(),
          note: note.trim() || null,
          items: lines.map(line => ({
            productId: Number(line.productId),
            quantity: Number(line.quantity),
            unitCost: Number(line.unitCost),
          })),
        },
      });
      setNotice(
        `Đã xác nhận ${result.receiptCode}; đã cộng tồn kho và ghi nhận ${money(result.totalCost)} chi phí nhập hàng.`,
      );
      setLines([newLine()]);
      setNote('');
      setReceivedAt(today());
      setRevision(value => value + 1);
      await Promise.all([reloadHistory(true), reloadReport(true)]);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSaving(false);
    }
  };

  const createSupplier = async event => {
    event.preventDefault();
    if (supplierBusy) return;
    setSupplierBusy(true);
    setSupplierError('');
    try {
      const saved = await adminApi('/api/manager/suppliers', {
        method: 'POST',
        body: { ...supplierForm, active: true },
      });
      await loadSuppliers();
      setSupplierId(String(saved.id));
      setSupplierForm(null);
    } catch (failure) {
      setSupplierError(failure.message);
    } finally {
      setSupplierBusy(false);
    }
  };

  return (
    <section className="admin-panel stock-receiving-page">
      <div className="stock-page-heading">
        <div>
          <span className="stock-kicker">
            <PackageCheck size={15} /> KHO HÀNG
          </span>
          <h2>Nhập kho</h2>
          <p>
            Tạo phiếu nhập theo nhà cung cấp. Xác nhận phiếu sẽ cộng tồn kho và ghi lại giá trị hàng
            nhập.
          </p>
        </div>
      </div>

      <section className="stock-expense-card" aria-labelledby="stock-expense-title">
        <div className="stock-section-heading">
          <div>
            <h3 id="stock-expense-title">Chi phí nhập hàng theo quý</h3>
            <p>Thống kê theo ngày nhận hàng, tính từ các phiếu đã xác nhận.</p>
          </div>
          <label>
            Năm{' '}
            <input
              type="number"
              min="2000"
              max={new Date().getFullYear() + 1}
              value={year}
              onChange={event => setYear(event.target.value)}
            />
          </label>
        </div>
        {reportError && (
          <p className="stock-error" role="alert">
            {reportError}
            <button type="button" className="admin-action" onClick={() => reloadReport()}>
              Tải lại
            </button>
          </p>
        )}
        <div className="stock-table-scroll">
          <table className="stock-quarter-table">
            <thead>
              <tr>
                <th>Năm {report?.year || year}</th>
                <th>Q1</th>
                <th>Q2</th>
                <th>Q3</th>
                <th>Q4</th>
                <th>Cả năm</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Tổng chi nhập kho</th>
                {[1, 2, 3, 4].map(q => (
                  <td key={q}>
                    {reportLoading && !report
                      ? '…'
                      : money(report?.quarters?.find(row => row.quarter === q)?.totalCost)}
                  </td>
                ))}
                <td>
                  <strong>{reportLoading && !report ? '…' : money(report?.totalCost)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <small className="stock-note">
          Đây là giá trị hàng nhận theo phiếu, chưa trừ hàng trả nhà cung cấp và chưa tính chi phí
          vận hành. Chỉ số này chưa phải lợi nhuận.
        </small>
      </section>

      <div className="stock-work-grid">
        <form className="stock-form-card" onSubmit={submit}>
          <div className="stock-section-heading">
            <div>
              <h3>
                <Truck size={18} /> Phiếu nhập mới
              </h3>
              <p>Phiếu được xác nhận ngay khi lưu.</p>
            </div>
          </div>
          <div className="stock-form-meta">
            <label>
              Nhà cung cấp
              <select
                required
                value={supplierId}
                onChange={event => setSupplierId(event.target.value)}
              >
                <option value="">Chọn nhà cung cấp</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.code} · {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="admin-action"
              onClick={() => {
                setSupplierError('');
                setSupplierForm({
                  code: '',
                  name: '',
                  email: '',
                  phone: '',
                  address: '',
                  notes: '',
                });
              }}
            >
              + Thêm nhà cung cấp
            </button>
            <label>
              Ngày nhận
              <input
                type="datetime-local"
                required
                value={receivedAt}
                onChange={event => setReceivedAt(event.target.value)}
              />
            </label>
          </div>
          {supplierError && (
            <p className="stock-error" role="alert">
              {supplierError}
            </p>
          )}

          <div className="stock-product-search">
            <Search size={16} />
            <input
              aria-label="Tìm sản phẩm nhập kho"
              placeholder="Tìm sản phẩm theo tên..."
              value={productSearch}
              onChange={event => setProductSearch(event.target.value)}
            />
          </div>
          {productError && (
            <p className="stock-error" role="alert">
              {productError}
            </p>
          )}
          <div className="stock-lines">
            {lines.length === 0 && (
              <p className="stock-empty-lines">Chưa có sản phẩm. Bấm “Thêm sản phẩm” để bắt đầu.</p>
            )}
            {lines.map((line, index) => (
              <div className="stock-line" key={index}>
                <label className="stock-line-product">
                  <span>Sản phẩm</span>
                  <select
                    required
                    value={line.productId}
                    onChange={event => {
                      const product = products.find(row => row.id === Number(event.target.value));
                      updateLine(index, {
                        productId: event.target.value,
                        productName: product?.name || '',
                        productStock: product?.stock ?? 0,
                      });
                    }}
                  >
                    <option value="">Chọn sản phẩm</option>
                    {line.productId &&
                      !products.some(product => product.id === Number(line.productId)) && (
                        <option value={line.productId}>
                          {line.productName} · Tồn {line.productStock}
                        </option>
                      )}
                    {products.map(product => (
                      <option
                        key={product.id}
                        value={product.id}
                        disabled={lines.some(
                          (other, otherIndex) =>
                            otherIndex !== index && Number(other.productId) === product.id,
                        )}
                      >
                        {product.name} · Tồn {product.stock}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Số lượng</span>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={line.quantity}
                    onChange={event => updateLine(index, { quantity: event.target.value })}
                  />
                </label>
                <label>
                  <span>Đơn giá nhập</span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitCost}
                    onChange={event => updateLine(index, { unitCost: event.target.value })}
                    placeholder="VND"
                  />
                </label>
                <div className="stock-line-total">
                  <span>Thành tiền</span>
                  <strong>
                    {money((Number(line.quantity) || 0) * (Number(line.unitCost) || 0))}
                  </strong>
                </div>
                <button
                  type="button"
                  className="stock-remove-line"
                  aria-label={`Xóa dòng ${index + 1}`}
                  disabled={saving}
                  onClick={() => removeLine(index)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="admin-action stock-add-line" onClick={addLine}>
            <Plus size={16} /> Thêm sản phẩm
          </button>
          <label className="stock-note-field">
            Ghi chú
            <textarea
              rows="2"
              maxLength={2000}
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="Số hóa đơn nhà cung cấp, ghi chú nhận hàng..."
            />
          </label>
          {error && (
            <p className="stock-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="stock-success" role="status">
              {notice}
            </p>
          )}
          <div className="stock-submit-row">
            <span>
              Tổng phiếu <strong>{money(totalCost)}</strong>
            </span>
            <button
              className="admin-primary"
              disabled={saving || suppliers.length === 0 || products.length === 0}
            >
              {saving ? 'Đang lưu...' : 'Xác nhận nhập kho'}
            </button>
          </div>
          <small className="stock-note">
            Tồn kho hiện được theo dõi theo tổng sản phẩm; số lượng chưa tách riêng theo size/màu.
          </small>
        </form>

        <section className="stock-history-card">
          <div className="stock-section-heading">
            <div>
              <h3>Lịch sử phiếu nhập</h3>
              <p>{history?.totalElements ?? 0} phiếu</p>
            </div>
            <button type="button" className="admin-action" onClick={() => reloadHistory()}>
              Tải lại
            </button>
          </div>
          {historyError && (
            <p className="stock-error" role="alert">
              {historyError}
            </p>
          )}
          {historyLoading && !history ? (
            <p role="status">Đang tải phiếu nhập...</p>
          ) : (
            <div className="stock-history-list">
              {!history?.content?.length ? (
                <p className="stock-empty">Chưa có phiếu nhập nào.</p>
              ) : (
                history.content.map(receipt => (
                  <button
                    type="button"
                    className="stock-history-row"
                    key={receipt.id}
                    onClick={() => setDetailId(receipt.id)}
                  >
                    <span className="stock-history-icon">
                      <PackageCheck size={18} />
                    </span>
                    <span className="stock-history-main">
                      <strong>{receipt.receiptCode}</strong>
                      <small>
                        {dateLabel(receipt.receivedAt)} · {receipt.supplierName} ·{' '}
                        {receipt.itemCount} dòng
                      </small>
                    </span>
                    <b>{money(receipt.totalCost)}</b>
                  </button>
                ))
              )}
            </div>
          )}
        </section>
      </div>

      {supplierForm && (
        <div
          className="admin-dialog-backdrop"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !supplierBusy) setSupplierForm(null);
          }}
        >
          <form className="admin-dialog stock-supplier-dialog" onSubmit={createSupplier}>
            <div className="stock-section-heading">
              <div>
                <h3>Thêm nhà cung cấp</h3>
                <p>Thông tin được lưu vào danh bạ nhà cung cấp.</p>
              </div>
              <button
                type="button"
                className="admin-action"
                aria-label="Đóng"
                onClick={() => setSupplierForm(null)}
              >
                <X size={17} />
              </button>
            </div>
            <label>
              Mã nhà cung cấp
              <input
                required
                maxLength={40}
                value={supplierForm.code}
                onChange={event =>
                  setSupplierForm(current => ({
                    ...current,
                    code: event.target.value.toUpperCase(),
                  }))
                }
              />
            </label>
            <label>
              Tên nhà cung cấp
              <input
                required
                maxLength={150}
                value={supplierForm.name}
                onChange={event =>
                  setSupplierForm(current => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <div className="stock-supplier-two">
              <label>
                Số điện thoại
                <input
                  maxLength={30}
                  value={supplierForm.phone}
                  onChange={event =>
                    setSupplierForm(current => ({ ...current, phone: event.target.value }))
                  }
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  maxLength={255}
                  value={supplierForm.email}
                  onChange={event =>
                    setSupplierForm(current => ({ ...current, email: event.target.value }))
                  }
                />
              </label>
            </div>
            <label>
              Địa chỉ
              <input
                maxLength={1000}
                value={supplierForm.address}
                onChange={event =>
                  setSupplierForm(current => ({ ...current, address: event.target.value }))
                }
              />
            </label>
            {supplierError && (
              <p className="stock-error" role="alert">
                {supplierError}
              </p>
            )}
            <div className="admin-dialog-actions">
              <button
                type="button"
                className="admin-action"
                disabled={supplierBusy}
                onClick={() => setSupplierForm(null)}
              >
                Hủy
              </button>
              <button className="admin-primary" disabled={supplierBusy}>
                {supplierBusy ? 'Đang lưu...' : 'Lưu nhà cung cấp'}
              </button>
            </div>
          </form>
        </div>
      )}

      {detailId !== null && (
        <div
          className="admin-dialog-backdrop"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setDetailId(null);
          }}
        >
          <section
            className="admin-dialog stock-receipt-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-detail-title"
          >
            <div className="stock-section-heading">
              <div>
                <h3 id="stock-detail-title">Chi tiết phiếu nhập</h3>
                <p>{detail?.receiptCode || 'Đang tải...'}</p>
              </div>
              <button
                type="button"
                className="admin-action"
                aria-label="Đóng"
                onClick={() => setDetailId(null)}
              >
                <X size={17} />
              </button>
            </div>
            {detailLoading ? (
              <p role="status">Đang tải...</p>
            ) : detailError ? (
              <p className="stock-error" role="alert">
                {detailError}
              </p>
            ) : (
              detail && (
                <>
                  <p>
                    <b>Nhà cung cấp:</b> {detail.supplierCode} · {detail.supplierName}
                  </p>
                  <p>
                    <b>Ngày nhận:</b> {dateLabel(detail.receivedAt)}
                  </p>
                  <div className="stock-table-scroll">
                    <table className="stock-items-table">
                      <thead>
                        <tr>
                          <th>Sản phẩm</th>
                          <th>SL</th>
                          <th>Đơn giá</th>
                          <th>Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.items.map(item => (
                          <tr key={item.id}>
                            <td>{item.productName}</td>
                            <td>{item.quantity}</td>
                            <td>{money(item.unitCost)}</td>
                            <td>{money(item.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th colSpan="3">Tổng phiếu</th>
                          <th>{money(detail.totalCost)}</th>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {detail.note && (
                    <p>
                      <b>Ghi chú:</b> {detail.note}
                    </p>
                  )}
                </>
              )
            )}
          </section>
        </div>
      )}
    </section>
  );
}
